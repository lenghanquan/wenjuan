"""
Build a training-oriented bundle from a field export.

Keeps real responses; optionally drops unlabeled; writes feature-ready JSON.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from _common import RAW, ensure_dirs, load_json, save_json


def main() -> None:
    ensure_dirs()
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--labeled-only", action="store_true", help="Drop unlabeled real rows")
    ap.add_argument("--drop-uncertain", action="store_true")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    bundle = load_json(Path(args.inp))
    survey = bundle.get("survey") or {}
    kept = []
    for r in bundle.get("responses") or []:
        if r.get("isSynthetic"):
            continue
        label = r.get("label")
        if args.labeled_only and not label:
            continue
        if args.drop_uncertain and label == "uncertain":
            continue
        kept.append(r)

    out_bundle = {
        "survey": survey,
        "responses": kept,
        "count": len(kept),
        "build": {
            "labeled_only": args.labeled_only,
            "drop_uncertain": args.drop_uncertain,
            "source": str(args.inp),
        },
    }
    out = Path(args.out) if args.out else RAW / "train_set.json"
    save_json(out, out_bundle)
    print(f"Kept {len(kept)} real responses -> {out}")


if __name__ == "__main__":
    main()
