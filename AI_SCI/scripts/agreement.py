"""
Compute simple label agreement between two JSON exports/lists.

Input format option A: two progress-style maps
  {"labels": {"respId": "normal", ...}}

Option B: two full export bundles with response.label fields
"""
from __future__ import annotations

import argparse
from pathlib import Path

from _common import RESULTS, ensure_dirs, load_json, save_json


def labels_from_bundle(path: Path) -> dict[str, str]:
    obj = load_json(path)
    if "labels" in obj and isinstance(obj["labels"], dict):
        return {str(k): str(v) for k, v in obj["labels"].items()}
    out = {}
    for r in obj.get("responses") or []:
        if r.get("label"):
            out[str(r.get("_id"))] = str(r.get("label"))
    return out


def cohen_kappa(y1: list[str], y2: list[str]) -> float:
    # simple multi-class kappa
    from collections import Counter

    n = len(y1)
    if n == 0:
        return 0.0
    agree = sum(1 for a, b in zip(y1, y2) if a == b) / n
    c1 = Counter(y1)
    c2 = Counter(y2)
    cats = set(c1) | set(c2)
    pe = sum((c1[c] / n) * (c2[c] / n) for c in cats)
    if abs(1 - pe) < 1e-12:
        return 1.0
    return (agree - pe) / (1 - pe)


def main() -> None:
    ensure_dirs()
    ap = argparse.ArgumentParser()
    ap.add_argument("--a", required=True, help="Rater A export or labels JSON")
    ap.add_argument("--b", required=True, help="Rater B export or labels JSON")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    la = labels_from_bundle(Path(args.a))
    lb = labels_from_bundle(Path(args.b))
    common = sorted(set(la) & set(lb))
    y1 = [la[i] for i in common]
    y2 = [lb[i] for i in common]
    agree = sum(1 for a, b in zip(y1, y2) if a == b) / len(common) if common else 0.0
    kappa = cohen_kappa(y1, y2)
    conflicts = [
        {"id": i, "a": la[i], "b": lb[i]}
        for i in common
        if la[i] != lb[i]
    ]

    report = {
        "n_common": len(common),
        "agreement": agree,
        "cohen_kappa": kappa,
        "n_conflicts": len(conflicts),
        "conflicts_preview": conflicts[:50],
    }
    out = Path(args.out) if args.out else RESULTS / "label_agreement.json"
    save_json(out, report)
    print(f"n={len(common)} agreement={agree:.3f} kappa={kappa:.3f} conflicts={len(conflicts)}")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
