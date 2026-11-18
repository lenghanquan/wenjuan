"""
Run ablation across contamination rates and detector views.

Produces data/results/ablation_table.json suitable for Applied Intelligence tables.
"""
from __future__ import annotations

import argparse
import copy
import subprocess
import sys
from pathlib import Path

from _common import RESULTS, SYN, ensure_dirs, load_json, save_json
from detect_baselines import encode_answers, isolation_forest_scores, rule_score
from detect_multiview import batch_scores, behavior_score
from eval_portrait_bias import option_shares, l1_bias, prf
from inject_synthetic import inject


def score_variant(bundle: dict, mode: str, threshold: float = 0.55) -> list[dict]:
    survey = bundle["survey"]
    responses = bundle["responses"]
    X = encode_answers(survey, responses)
    if_scores = isolation_forest_scores(X)
    batch = batch_scores(responses)

    out = []
    for i, r in enumerate(responses):
        ans_rule, _ = rule_score(r, survey)
        ans = 0.55 * ans_rule + 0.45 * float(if_scores[i])
        beh, _ = behavior_score(r)
        bat, _ = batch[i]

        if mode == "answer":
            score = ans
        elif mode == "behavior":
            score = beh
        elif mode == "batch":
            score = bat
        elif mode == "answer+behavior":
            score = 0.55 * ans + 0.45 * beh
        elif mode == "answer+batch":
            score = 0.6 * ans + 0.4 * bat
        elif mode == "behavior+batch":
            score = 0.55 * beh + 0.45 * bat
        else:  # full multiview
            score = 0.4 * ans + 0.35 * beh + 0.25 * bat

        out.append({
            "responseId": r.get("_id"),
            "qualityScore": float(score),
            "isSuspectedLowQuality": float(score) < threshold,
            "isSynthetic": bool(r.get("isSynthetic")),
            "label": r.get("label"),
        })
    return out


def evaluate(bundle: dict, scored: list[dict]) -> dict:
    scores = {r["responseId"]: r for r in scored}
    responses = bundle["responses"]
    y_true, y_pred = [], []
    kept = []
    for r in responses:
        rid = r.get("_id")
        s = scores.get(rid) or {}
        bad = 1 if r.get("isSynthetic") or r.get("label") in ("synthetic", "low_quality") else 0
        pred = 1 if s.get("isSuspectedLowQuality") else 0
        y_true.append(bad)
        y_pred.append(pred)
        if not pred:
            kept.append(r)
    clean = [r for r in responses if not r.get("isSynthetic")]
    p_clean = option_shares(clean)
    p_raw = option_shares(responses)
    p_filt = option_shares(kept)
    return {
        "detection": prf(y_true, y_pred),
        "portrait": {
            "l1_raw_vs_clean": l1_bias(p_raw, p_clean),
            "l1_filtered_vs_clean": l1_bias(p_filt, p_clean),
            "bias_reduction": l1_bias(p_raw, p_clean) - l1_bias(p_filt, p_clean),
            "rank_preserved": (
                (max(p_clean, key=p_clean.get) if p_clean else None)
                == (max(p_filt, key=p_filt.get) if p_filt else None)
            ),
        },
    }


MODES = [
    "answer",
    "behavior",
    "batch",
    "answer+behavior",
    "answer+batch",
    "behavior+batch",
    "multiview",
]


def main() -> None:
    ensure_dirs()
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True, help="Clean export JSON")
    ap.add_argument("--rates", default="0.05,0.1,0.2")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    clean = load_json(Path(args.inp))
    rates = [float(x) for x in args.rates.split(",") if x.strip()]
    rows = []

    for rate in rates:
        contaminated = inject(copy.deepcopy(clean), rate, ["random", "straight", "llm"], args.seed + int(rate * 1000))
        syn_path = SYN / f"ablation_r{rate}.json"
        save_json(syn_path, contaminated)
        for mode in MODES:
            scored = score_variant(contaminated, mode)
            metrics = evaluate(contaminated, scored)
            rows.append({
                "rate": rate,
                "mode": mode,
                "n": contaminated["count"],
                "n_injected": contaminated["injection"]["n_injected"],
                **metrics["detection"],
                **metrics["portrait"],
            })
            print(
                f"rate={rate:.2f} mode={mode:16s} "
                f"F1={metrics['detection']['f1']:.3f} "
                f"Δbias={metrics['portrait']['bias_reduction']:.3f}"
            )

    table = {
        "source": str(args.inp),
        "seed": args.seed,
        "modes": MODES,
        "rates": rates,
        "rows": rows,
    }
    out = Path(args.out) if args.out else RESULTS / "ablation_table.json"
    save_json(out, table)

    # Markdown preview for paper draft
    md_lines = [
        "| rate | mode | P | R | F1 | L1_raw | L1_filt | bias↓ | rank_ok |",
        "|------|------|---|---|----|--------|---------|-------|---------|",
    ]
    for r in rows:
        md_lines.append(
            f"| {r['rate']:.2f} | {r['mode']} | {r['precision']:.3f} | {r['recall']:.3f} | "
            f"{r['f1']:.3f} | {r['l1_raw_vs_clean']:.3f} | {r['l1_filtered_vs_clean']:.3f} | "
            f"{r['bias_reduction']:.3f} | {r['rank_preserved']} |"
        )
    md_path = RESULTS / "ablation_table.md"
    md_path.write_text("\n".join(md_lines) + "\n", encoding="utf-8")
    print(f"Wrote {out}")
    print(f"Wrote {md_path}")


if __name__ == "__main__":
    main()
