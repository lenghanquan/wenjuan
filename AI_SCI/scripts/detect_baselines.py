"""
Baseline detectors on contaminated export JSON.

Outputs scores to data/results/ for ablation comparison.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np

from _common import RESULTS, ensure_dirs, load_json, save_json


def encode_answers(survey: dict, responses: list[dict]) -> np.ndarray:
    questions = survey.get("questions") or []
    rows = []
    for r in responses:
        ans_map = {a["questionId"]: a["answer"] for a in r.get("answers") or []}
        vec = []
        for q in questions:
            qid = q.get("questionUniqueId") or str(q.get("_id", ""))
            opts = q.get("options") or []
            val = ans_map.get(qid)
            for opt in opts:
                if isinstance(val, list):
                    vec.append(1.0 if opt in val else 0.0)
                else:
                    vec.append(1.0 if val == opt else 0.0)
        rows.append(vec if vec else [0.0])
    # pad
    width = max(len(x) for x in rows)
    return np.array([x + [0.0] * (width - len(x)) for x in rows], dtype=float)


def rule_score(r: dict, survey: dict | None = None) -> tuple[float, list[str]]:
    reasons = []
    duration = r.get("durationMs")
    n_q = max(1, len(r.get("answers") or []))
    score = 1.0
    # ~0.5s per question is unrealistically fast for thoughtful survey filling
    if duration is not None and duration < max(1200, 500 * n_q):
        score -= 0.5
        reasons.append("too_fast")
    answers = [a.get("answer") for a in r.get("answers") or []]
    flat = []
    for a in answers:
        if isinstance(a, list):
            flat.extend(a)
        else:
            flat.append(a)
    if flat and len(set(map(str, flat))) == 1 and len(flat) >= 3:
        score -= 0.4
        reasons.append("straight_line")

    # Always picking the first listed option across items (common bot / straight pattern)
    if survey:
        ans_map = {a.get("questionId"): a.get("answer") for a in r.get("answers") or []}
        first_hits = 0
        comparable = 0
        for q in survey.get("questions") or []:
            opts = q.get("options") or []
            if not opts:
                continue
            qid = q.get("questionUniqueId") or str(q.get("_id", ""))
            val = ans_map.get(qid)
            comparable += 1
            if isinstance(val, list):
                if val == [opts[0]] or (len(val) == 1 and val[0] == opts[0]):
                    first_hits += 1
            elif val == opts[0]:
                first_hits += 1
        if comparable >= 3 and first_hits == comparable:
            score -= 0.35
            reasons.append("always_first_option")

    if r.get("attentionFailed") is True:
        score -= 0.45
        reasons.append("attention_failed")
    if r.get("honeypotTriggered") is True:
        score -= 0.45
        reasons.append("honeypot_triggered")

    return max(0.0, min(1.0, score)), reasons


def isolation_forest_scores(X: np.ndarray) -> np.ndarray:
    try:
        from sklearn.ensemble import IsolationForest
    except ImportError:
        return np.ones(len(X))
    if len(X) < 5:
        return np.ones(len(X))
    clf = IsolationForest(random_state=42, contamination="auto")
    clf.fit(X)
    # decision_function: higher = more normal -> map to 0-1
    raw = clf.decision_function(X)
    mn, mx = raw.min(), raw.max()
    if mx - mn < 1e-9:
        return np.ones(len(X))
    return (raw - mn) / (mx - mn)


def main() -> None:
    ensure_dirs()
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    bundle = load_json(Path(args.inp))
    survey = bundle["survey"]
    responses = bundle["responses"]
    X = encode_answers(survey, responses)
    if_scores = isolation_forest_scores(X)

    results = []
    for i, r in enumerate(responses):
        rs, reasons = rule_score(r, survey)
        blended = 0.55 * rs + 0.45 * float(if_scores[i])
        results.append({
            "responseId": r.get("_id"),
            "qualityScore": blended,
            "isSuspectedLowQuality": blended < 0.55,
            "detectionReasons": reasons + (["isolation_outlier"] if if_scores[i] < 0.35 else []),
            "modelVersion": "baseline_v0",
            "isSynthetic": bool(r.get("isSynthetic")),
            "label": r.get("label"),
        })

    out = {
        "modelVersion": "baseline_v0",
        "source": str(args.inp),
        "results": results,
    }
    path = Path(args.out) if args.out else RESULTS / "baseline_scores.json"
    save_json(path, out)
    n_flag = sum(1 for x in results if x["isSuspectedLowQuality"])
    print(f"Scored {len(results)}, flagged {n_flag} -> {path}")


if __name__ == "__main__":
    main()
