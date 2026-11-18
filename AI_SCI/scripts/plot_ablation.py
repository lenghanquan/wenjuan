"""Render ablation figures for Applied Intelligence draft."""
from __future__ import annotations

import argparse
from pathlib import Path

from _common import RESULTS, ensure_dirs, load_json


def main() -> None:
    ensure_dirs()
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", default=str(RESULTS / "ablation_table.json"))
    ap.add_argument("--outdir", default=str(RESULTS / "figures"))
    args = ap.parse_args()

    try:
        import matplotlib.pyplot as plt
    except ImportError as e:
        raise SystemExit("matplotlib required: pip install matplotlib") from e

    table = load_json(Path(args.inp))
    rows = table.get("rows") or []
    if not rows:
        raise SystemExit("No rows in ablation table")

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    rates = sorted({r["rate"] for r in rows})
    modes = []
    for r in rows:
        if r["mode"] not in modes:
            modes.append(r["mode"])

    # Figure 1: F1 by mode for each rate
    fig, ax = plt.subplots(figsize=(9, 4.5))
    x = range(len(modes))
    width = 0.8 / max(len(rates), 1)
    for i, rate in enumerate(rates):
        vals = []
        for m in modes:
            hit = next((r for r in rows if r["rate"] == rate and r["mode"] == m), None)
            vals.append(hit["f1"] if hit else 0.0)
        offset = (i - (len(rates) - 1) / 2) * width
        ax.bar([xi + offset for xi in x], vals, width=width, label=f"rate={rate}")
    ax.set_xticks(list(x))
    ax.set_xticklabels(modes, rotation=30, ha="right")
    ax.set_ylabel("F1")
    ax.set_ylim(0, 1.05)
    ax.set_title("Detection F1 by view (ablation)")
    ax.legend()
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    f1_path = outdir / "fig_f1_ablation.png"
    fig.savefig(f1_path, dpi=160)
    plt.close(fig)

    # Figure 2: bias reduction for multiview vs answer-only
    fig, ax = plt.subplots(figsize=(6.5, 4))
    for mode, style in [("answer", "o-"), ("multiview", "s-"), ("answer+behavior", "^-")]:
        xs, ys = [], []
        for rate in rates:
            hit = next((r for r in rows if r["rate"] == rate and r["mode"] == mode), None)
            if hit:
                xs.append(rate)
                ys.append(hit["bias_reduction"])
        if xs:
            ax.plot(xs, ys, style, label=mode)
    ax.axhline(0, color="#999", lw=1)
    ax.set_xlabel("Contamination rate")
    ax.set_ylabel("Portrait L1 bias reduction")
    ax.set_title("Downstream portrait bias reduction")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    bias_path = outdir / "fig_bias_reduction.png"
    fig.savefig(bias_path, dpi=160)
    plt.close(fig)

    print(f"Wrote {f1_path}")
    print(f"Wrote {bias_path}")


if __name__ == "__main__":
    main()
