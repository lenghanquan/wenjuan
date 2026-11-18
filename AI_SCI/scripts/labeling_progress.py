"""Summarize labeling coverage for a field export JSON."""
from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

from _common import RESULTS, ensure_dirs, load_json, save_json


def main() -> None:
    ensure_dirs()
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    bundle = load_json(Path(args.inp))
    responses = [r for r in bundle.get("responses") or [] if not r.get("isSynthetic")]
    labels = Counter((r.get("label") or "unlabeled") for r in responses)
    suspected = sum(1 for r in responses if r.get("isSuspectedLowQuality") is True)
    with_duration = sum(1 for r in responses if r.get("durationMs") is not None)
    att_fail = sum(1 for r in responses if r.get("attentionFailed") is True)
    honey = sum(1 for r in responses if r.get("honeypotTriggered") is True)

    n = len(responses)
    labeled = n - labels.get("unlabeled", 0) - labels.get(None, 0)
    # Counter key for missing label is "unlabeled" via `or`
    unlabeled = labels.get("unlabeled", 0)

    report = {
        "surveyId": (bundle.get("survey") or {}).get("_id"),
        "title": (bundle.get("survey") or {}).get("title"),
        "n_real": n,
        "unlabeled": unlabeled,
        "labeled": n - unlabeled,
        "label_counts": dict(labels),
        "suspected_auto": suspected,
        "with_duration": with_duration,
        "duration_coverage": (with_duration / n) if n else 0.0,
        "attention_failed": att_fail,
        "honeypot_triggered": honey,
        "ready_for_supervised": (n - unlabeled) >= 50 and labels.get("normal", 0) >= 20,
        "ready_for_ablation_clean_base": n >= 100 and with_duration >= int(0.8 * n),
    }

    out = Path(args.out) if args.out else RESULTS / "labeling_progress.json"
    save_json(out, report)

    print(f"Real responses: {n}")
    print(f"Labeled: {n - unlabeled} | Unlabeled: {unlabeled}")
    print(f"Labels: {dict(labels)}")
    print(f"Auto suspected: {suspected} | attention_fail: {att_fail} | honeypot: {honey}")
    print(f"Duration coverage: {report['duration_coverage']:.1%}")
    print(f"Ready supervised? {report['ready_for_supervised']} | Ready ablation base? {report['ready_for_ablation_clean_base']}")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
