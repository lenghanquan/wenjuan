"""
Evaluate detection quality and portrait bias reduction.

Assumes contaminated bundle where isSynthetic marks injected noise,
and 'clean' distribution is computed from non-synthetic rows.
"""
from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

from _common import RESULTS, ensure_dirs, load_json, save_json


def option_shares(responses: list[dict], question_id: str | None = None) -> dict[str, float]:
    """Aggregate first question (or given id) option shares."""
    counts: Counter = Counter()
    total = 0
    for r in responses:
        answers = r.get("answers") or []
        if not answers:
            continue
        if question_id:
            ans = next((a for a in answers if a.get("questionId") == question_id), None)
        else:
            ans = answers[0]
        if not ans:
            continue
        val = ans.get("answer")
        opts = val if isinstance(val, list) else [val]
        for o in opts:
            counts[str(o)] += 1
            total += 1
    if total == 0:
        return {}
    return {k: v / total for k, v in counts.items()}


def l1_bias(p: dict[str, float], q: dict[str, float]) -> float:
    keys = set(p) | set(q)
    return sum(abs(p.get(k, 0.0) - q.get(k, 0.0)) for k in keys)


def prf(y_true: list[int], y_pred: list[int]) -> dict:
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    return {"precision": prec, "recall": rec, "f1": f1, "tp": tp, "fp": fp, "fn": fn}


def main() -> None:
    ensure_dirs()
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="Contaminated JSON bundle")
    ap.add_argument("--scores", required=True, help="Detector score JSON")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    bundle = load_json(Path(args.data))
    scores = {r["responseId"]: r for r in load_json(Path(args.scores)).get("results") or []}
    responses = bundle["responses"]

    y_true, y_pred = [], []
    kept_high = []
    for r in responses:
        rid = r.get("_id")
        s = scores.get(rid) or {}
        is_bad = 1 if r.get("isSynthetic") or r.get("label") in ("synthetic", "low_quality") else 0
        pred = 1 if s.get("isSuspectedLowQuality") else 0
        y_true.append(is_bad)
        y_pred.append(pred)
        if not pred:
            kept_high.append(r)

    clean = [r for r in responses if not r.get("isSynthetic")]
    raw_all = responses
    p_clean = option_shares(clean)
    p_raw = option_shares(raw_all)
    p_filt = option_shares(kept_high)

    report = {
        "n": len(responses),
        "n_synthetic": sum(y_true),
        "detection": prf(y_true, y_pred),
        "portrait": {
            "l1_raw_vs_clean": l1_bias(p_raw, p_clean),
            "l1_filtered_vs_clean": l1_bias(p_filt, p_clean),
            "bias_reduction": l1_bias(p_raw, p_clean) - l1_bias(p_filt, p_clean),
            "clean_shares": p_clean,
            "raw_shares": p_raw,
            "filtered_shares": p_filt,
            "rank_clean": max(p_clean, key=p_clean.get) if p_clean else None,
            "rank_raw": max(p_raw, key=p_raw.get) if p_raw else None,
            "rank_filtered": max(p_filt, key=p_filt.get) if p_filt else None,
        },
    }
    out = Path(args.out) if args.out else RESULTS / "eval_report.json"
    save_json(out, report)
    print(json_dumps_brief(report))
    print(f"Wrote {out}")


def json_dumps_brief(report: dict) -> str:
    d = report["detection"]
    p = report["portrait"]
    return (
        f"F1={d['f1']:.3f} P={d['precision']:.3f} R={d['recall']:.3f} | "
        f"L1 raw={p['l1_raw_vs_clean']:.3f} filt={p['l1_filtered_vs_clean']:.3f} "
        f"reduction={p['bias_reduction']:.3f}"
    )


if __name__ == "__main__":
    main()
