# AI_SCI — Direction 1: Anonymous Response Quality Detection

Target journal: **Applied Intelligence** (Springer, hybrid).

Research focus: detect low-quality / synthetic responses on campus health surveys that allow **login-free** submission via share link / QR code, then measure how filtering improves **portrait statistics** (option shares).

## Relation to main app

| Layer | Location | Role |
|-------|----------|------|
| Product (collect + portrait) | `../server.js`, `../public/` | P0 metadata capture, export, quality filter on stats |
| Experiments (detect + eval) | `AI_SCI/scripts/` | Offline Python: inject, detect, ablate, bias metrics |

Detection models stay **offline**. Node only stores signals and scores.

## Quick experiment flow

1. Collect real responses (with P0 metadata) via the running app.
2. `python scripts/export_responses.py --survey-id <id>`
3. `python scripts/inject_synthetic.py --rate 0.1 --strategies random,straight,llm`
4. `python scripts/detect_baselines.py` then `detect_multiview.py`
5. `python scripts/writeback_scores.py` (optional) or keep scores in `data/results/`
6. `python scripts/eval_portrait_bias.py` — report P/R/F1 + portrait bias reduction

## Directory

```
AI_SCI/
  docs/           research plan, schema notes, ethics
  schemas/        JSON field contracts
  scripts/        offline experiment pipeline
  notebooks/      optional plotting
  data/           gitignored raw / synthetic / results
  patches/        integration checklist vs server.js
```

## Setup (Python)

```bash
cd AI_SCI
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Copy `../.env` or set `MONGODB_URI` for export/writeback scripts.

## Status

- [x] Research scaffold
- [x] P0 schema + submit metadata in main app
- [x] Export API `/api/export/:surveyId`
- [x] Stats quality filter `?quality=all|high|suspect`
- [x] Admin labeling UI `/pages/quality-admin.html`
- [x] Soft submit rate-limit
- [x] Ablation runner `scripts/run_ablation.py` → `data/results/ablation_table.md`
- [x] Attention / honeypot question roles (hidden from fillers)
- [x] Supervised / semi-supervised detector `detect_supervised.py`
- [x] Ablation figures `plot_ablation.py` → `data/results/figures/`
- [x] English Methods draft `docs/methods-draft-en.md`
- [x] Real-study protocol / labeling / submission checklists (P3 docs)
- [x] `labeling_progress.py` / `dataset_card.py` / `build_train_set.py` / `agreement.py`
- [x] Windows field pipeline `scripts/run_field_pipeline.ps1`

## Document map (human study → submission)

| Doc | Purpose |
|-----|---------|
| `docs/THIS_WEEK.md` | What to do this week |
| `docs/real-study-protocol.md` | 6-week field protocol |
| `docs/ethics-application-zh.md` | IRB application draft |
| `docs/informed-consent-zh.md` | Full consent text |
| `docs/recruitment-zh.md` | Recruit messages |
| `docs/data-management-plan-zh.md` | DMP |
| `docs/labeling-guide.md` | How to label |
| `docs/paper-outline-zh.md` | Abstract + outline |
| `docs/cover-letter-en.md` | Cover letter draft |
| `docs/submission-checklist.md` | Pre-submit checks |
| `docs/methods-draft-en.md` | English Methods |

## Start here (human study)

1. Read `docs/THIS_WEEK.md` and `docs/real-study-protocol.md`
2. Fill ethics forms (`ethics-application-zh.md`) and recruit (`recruitment-zh.md`)
3. Collect field data with attention + honeypot items
4. Label in `/pages/quality-admin.html`
5. Run:

```powershell
cd AI_SCI
.\scripts\run_field_pipeline.ps1 -InputJson .\data\raw\field_export.json
```

## Demo ablation + supervised (not for paper numbers)

```bash
python scripts/make_demo_bundle.py
python scripts/run_ablation.py --in data/raw/demo_export.json --rates 0.05,0.1,0.2
python scripts/plot_ablation.py
python scripts/detect_supervised.py --in data/synthetic/ablation_r0.2.json --semi
python scripts/eval_portrait_bias.py --data data/synthetic/ablation_r0.2.json --scores data/results/supervised_semi_scores.json
```
