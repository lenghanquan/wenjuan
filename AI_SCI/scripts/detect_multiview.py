"""
Multi-view scoring: answer + behavior + batch (weak propagation).

v0 late-fusion for Applied Intelligence ablation scaffold.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

from _common import RESULTS, ensure_dirs, load_json, save_json
from detect_baselines import encode_answers, isolation_forest_scores, rule_score


def behavior_score(r: dict) -> tuple[float, list[str]]:
    reasons = []
    score = 1.0
    d = r.get("durationMs")
    n_q = max(1, len(r.get("answers") or []))
    if d is None:
        return 0.5, ["missing_duration"]
    per_q = d / n_q
    if per_q < 600:
        score -= 0.55
        reasons.append("behavior_too_fast")
    elif per_q > 180000:
        score -= 0.15
        reasons.append("behavior_extremely_slow")
    changes = sum((e.get("changeCount") or 0) for e in r.get("questionEvents") or [])
    if changes == 0 and n_q >= 3 and per_q < 2500:
        score -= 0.2
        reasons.append("no_revisions_fast")
    return max(0.0, min(1.0, score)), reasons


def batch_scores(responses: list[dict]) -> list[tuple[float, list[str]]]:
    by_share_hour = defaultdict(list)
    for i, r in enumerate(responses):
        share = r.get("shareId") or "unknown"
        submitted = str(r.get("submittedAt") or r.get("createdAt") or "")[:13]
        by_share_hour[(share, submitted)].append(i)

    burst_ids = set()
    for key, idxs in by_share_hour.items():
        if len(idxs) >= 8:
            burst_ids.update(idxs)

    hash_counts = Counter(r.get("ipHash") or "" for r in responses)
    out = []
    for i, r in enumerate(responses):
        score = 1.0
        reasons = []
        if i in burst_ids:
            score -= 0.4
            reasons.append("batch_burst")
        iph = r.get("ipHash") or ""
        if iph and hash_counts[iph] >= 3:
            score -= 0.45
            reasons.append("hash_repeat")
        out.append((max(0.0, min(1.0, score)), reasons))
    return out


def main() -> None:
    ensure_dirs()
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", default=None)
    ap.add_argument("--w-answer", type=float, default=0.4)
    ap.add_argument("--w-behavior", type=float, default=0.35)
    ap.add_argument("--w-batch", type=float, default=0.25)
    args = ap.parse_args()

    bundle = load_json(Path(args.inp))
    survey = bundle["survey"]
    responses = bundle["responses"]
    X = encode_answers(survey, responses)
    if_scores = isolation_forest_scores(X)
    batch = batch_scores(responses)

    results = []
    for i, r in enumerate(responses):
        ans_rule, ans_reasons = rule_score(r, survey)
        ans = 0.55 * ans_rule + 0.45 * float(if_scores[i])
        beh, beh_reasons = behavior_score(r)
        bat, bat_reasons = batch[i]
        fused = args.w_answer * ans + args.w_behavior * beh + args.w_batch * bat
        reasons = ans_reasons + beh_reasons + bat_reasons
        results.append({
            "responseId": r.get("_id"),
            "viewScores": {"answer": ans, "behavior": beh, "batch": bat},
            "qualityScore": fused,
            "isSuspectedLowQuality": fused < 0.55,
            "detectionReasons": reasons,
            "modelVersion": "multiview_v0",
            "isSynthetic": bool(r.get("isSynthetic")),
            "label": r.get("label"),
        })

    out = {
        "modelVersion": "multiview_v0",
        "weights": {
            "answer": args.w_answer,
            "behavior": args.w_behavior,
            "batch": args.w_batch,
        },
        "source": str(args.inp),
        "results": results,
    }
    path = Path(args.out) if args.out else RESULTS / "multiview_scores.json"
    save_json(path, out)
    print(f"Multiview scored {len(results)} -> {path}")


if __name__ == "__main__":
    main()
