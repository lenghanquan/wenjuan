"""
Supervised / semi-supervised response quality detector.

Uses labeled rows (isSynthetic / label / human labels) when available,
otherwise falls back to synthetic flags in contaminated bundles.
Self-training expands labels to unlabeled rows (semi-supervised).
"""
from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

import numpy as np

from _common import RESULTS, ensure_dirs, load_json, save_json
from detect_baselines import encode_answers, rule_score
from detect_multiview import batch_scores, behavior_score


def ground_truth(r: dict) -> int | None:
    if r.get("isSynthetic") or r.get("label") in ("synthetic", "low_quality"):
        return 1
    if r.get("label") == "normal":
        return 0
    return None


def feature_row(r: dict, survey: dict, ans_enc: np.ndarray, beh: float, bat: float, rule: float) -> list[float]:
    n_q = max(1, len(r.get("answers") or []))
    duration = float(r.get("durationMs") or 0.0)
    changes = float(sum((e.get("changeCount") or 0) for e in r.get("questionEvents") or []))
    feats = [
        rule,
        beh,
        bat,
        duration,
        duration / n_q,
        changes,
        1.0 if r.get("attentionFailed") is True else 0.0,
        1.0 if r.get("honeypotTriggered") is True else 0.0,
        1.0 if r.get("attentionPassed") is True else 0.0,
        float(np.mean(ans_enc)) if len(ans_enc) else 0.0,
        float(np.std(ans_enc)) if len(ans_enc) else 0.0,
    ]
    return feats


def train_predict(X: np.ndarray, y: np.ndarray, labeled_mask: np.ndarray, semi: bool) -> tuple[np.ndarray, dict]:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler

    Xl = X[labeled_mask]
    yl = y[labeled_mask]
    meta = {"n_labeled": int(labeled_mask.sum()), "semi": semi, "model": "rf"}

    if len(Xl) < 4 or len(set(yl.tolist())) < 2:
        # Not enough labels → heuristic probability from rule features (col0)
        probs = 1.0 - np.clip(X[:, 0], 0, 1)
        meta["model"] = "rule_fallback"
        return probs, meta

    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    Xls = Xs[labeled_mask]

    clf = RandomForestClassifier(
        n_estimators=120,
        max_depth=6,
        random_state=42,
        class_weight="balanced",
    )
    clf.fit(Xls, yl)

    if semi:
        # Self-training: add high-confidence unlabeled predictions
        proba = clf.predict_proba(Xs)[:, 1] if hasattr(clf, "predict_proba") else clf.predict(Xs).astype(float)
        unlabeled = ~labeled_mask
        conf_pos = unlabeled & (proba >= 0.9)
        conf_neg = unlabeled & (proba <= 0.1)
        if conf_pos.any() or conf_neg.any():
            y2 = y.copy()
            y2[conf_pos] = 1
            y2[conf_neg] = 0
            mask2 = labeled_mask | conf_pos | conf_neg
            clf.fit(Xs[mask2], y2[mask2])
            meta["self_trained_extra"] = int(conf_pos.sum() + conf_neg.sum())
        meta["model"] = "rf_self_training"

    if hasattr(clf, "predict_proba"):
        probs = clf.predict_proba(Xs)[:, list(clf.classes_).index(1)] if 1 in list(clf.classes_) else 1.0 - clf.predict_proba(Xs)[:, 0]
    else:
        probs = clf.predict(Xs).astype(float)

    # Also fit a linear model for coefficient interpretability (stored in meta)
    try:
        lr = LogisticRegression(max_iter=500, class_weight="balanced")
        lr.fit(Xls, yl)
        meta["lr_coef"] = lr.coef_[0].tolist()
    except Exception:
        pass

    return np.asarray(probs, dtype=float), meta


def main() -> None:
    ensure_dirs()
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", default=None)
    ap.add_argument("--semi", action="store_true", help="Enable self-training")
    ap.add_argument("--threshold", type=float, default=0.5)
    args = ap.parse_args()

    bundle = load_json(Path(args.inp))
    survey = bundle["survey"]
    responses = bundle["responses"]
    X_ans = encode_answers(survey, responses)
    batch = batch_scores(responses)

    feats = []
    y = []
    labeled_mask = []
    for i, r in enumerate(responses):
        rule, _ = rule_score(r, survey)
        beh, _ = behavior_score(r)
        bat, _ = batch[i]
        feats.append(feature_row(r, survey, X_ans[i], beh, bat, rule))
        gt = ground_truth(r)
        y.append(0 if gt is None else gt)
        labeled_mask.append(gt is not None)

    X = np.asarray(feats, dtype=float)
    y_arr = np.asarray(y, dtype=int)
    mask = np.asarray(labeled_mask, dtype=bool)

    # For contaminated demos, all synthetics are labeled; hold out 30% labels to simulate sparse human labels
    rng = np.random.default_rng(42)
    if mask.sum() >= 8:
        lab_idx = np.where(mask)[0]
        drop = rng.choice(lab_idx, size=max(1, int(0.3 * len(lab_idx))), replace=False)
        # keep synthetics partially unlabeled to stress semi-supervised
        for j in drop:
            if responses[j].get("isSynthetic"):
                mask[j] = False

    probs, meta = train_predict(X, y_arr, mask, semi=args.semi)
    # qualityScore high = trustworthy
    quality = 1.0 - probs

    results = []
    for i, r in enumerate(responses):
        results.append({
            "responseId": r.get("_id"),
            "qualityScore": float(quality[i]),
            "isSuspectedLowQuality": bool(probs[i] >= args.threshold),
            "detectionReasons": ["supervised_model"],
            "modelVersion": "supervised_v1_semi" if args.semi else "supervised_v1",
            "isSynthetic": bool(r.get("isSynthetic")),
            "label": r.get("label"),
            "badProb": float(probs[i]),
        })

    out = {
        "modelVersion": results[0]["modelVersion"] if results else "supervised_v1",
        "meta": meta,
        "featureNames": [
            "rule", "behavior", "batch", "duration", "per_q", "changes",
            "attention_failed", "honeypot", "attention_passed", "ans_mean", "ans_std",
        ],
        "source": str(args.inp),
        "results": results,
    }
    path = Path(args.out) if args.out else RESULTS / ("supervised_semi_scores.json" if args.semi else "supervised_scores.json")
    save_json(path, out)
    n_flag = sum(1 for x in results if x["isSuspectedLowQuality"])
    print(f"Supervised scored {len(results)}, flagged {n_flag}, model={meta.get('model')} -> {path}")


if __name__ == "__main__":
    main()
