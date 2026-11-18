"""Generate a lightweight dataset card (markdown) from an export bundle."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime
from pathlib import Path

from _common import RESULTS, ensure_dirs, load_json


def main() -> None:
    ensure_dirs()
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    bundle = load_json(Path(args.inp))
    survey = bundle.get("survey") or {}
    responses = bundle.get("responses") or []
    real = [r for r in responses if not r.get("isSynthetic")]
    synth = [r for r in responses if r.get("isSynthetic")]

    labels = Counter((r.get("label") or "unlabeled") for r in real)
    genders = Counter((r.get("userInfo") or {}).get("gender") or "NA" for r in real)
    n_q = len(survey.get("questions") or [])
    roles = Counter((q.get("role") or "normal") for q in survey.get("questions") or [])

    durations = [r.get("durationMs") for r in real if isinstance(r.get("durationMs"), (int, float))]
    dur_line = "n/a"
    if durations:
        import statistics

        dur_line = (
            f"n={len(durations)}, median={statistics.median(durations):.0f}ms, "
            f"mean={statistics.mean(durations):.0f}ms"
        )

    md = f"""# Dataset Card — Zhihui Qingjian Response Quality

- Generated: {datetime.utcnow().isoformat()}Z
- Source file: `{args.inp}`
- Survey id: `{survey.get("_id")}`
- Title: {survey.get("title")}

## Summary

| Item | Value |
|------|-------|
| Real responses | {len(real)} |
| Synthetic (if any in file) | {len(synth)} |
| Questions | {n_q} |
| Question roles | {dict(roles)} |
| Share id | `{survey.get("shareId")}` |

## Labels (real only)

{dict(labels)}

## Demographics (self-reported categories)

Gender: {dict(genders)}

## Behavior coverage

Duration stats: {dur_line}

## Intended uses

- Train/evaluate low-quality & synthetic response detectors
- Measure portrait statistic bias before/after filtering

## Out-of-scope

- Clinical diagnosis
- Re-identification of individuals

## Ethical notes

- IP/UA stored as HMAC hashes only (when collected via app)
- Respondents shown quality-signal consent on filling page
- Replace this paragraph with IRB approval ID before submission
"""

    out = Path(args.out) if args.out else RESULTS / "dataset_card.md"
    out.write_text(md, encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
