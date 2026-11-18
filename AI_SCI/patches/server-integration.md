# Server integration checklist

## Done (P0)

- [x] Extend `ResponseSchema` with quality / behavior / batch fields
- [x] Persist `shareId` on `Survey` (same as URL id)
- [x] `POST /api/submitResponse` accepts client timing metadata; stores HMAC ip/ua
- [x] `GET /api/stats/:surveyId?quality=all|high|suspect`
- [x] `GET /api/export/:surveyId` JSON export for Python (auth required)
- [x] Filling page collects `startedAt`, `durationMs`, `questionEvents`, fingerprint

## Done (P1)

- [x] Admin labeling page `/pages/quality-admin.html`
- [x] Soft rate-limit by `ipHash` / fingerprint + `shareId` window
- [x] Consent checkbox on survey page
- [x] Writeback API `POST /api/surveys/:id/quality-scores`
- [x] List API `GET /api/surveys/:id/responses`
- [x] Ablation script `scripts/run_ablation.py`

## Done (P2)

- [x] Stronger supervised / semi-supervised detector (`detect_supervised.py`)
- [x] Attention / honeypot item roles on create + server-side eval
- [x] Paper figures from `plot_ablation.py`
- [x] English Methods draft

## Done (P3 tooling/docs)

- [x] Real-study protocol + labeling guide + submission checklist
- [x] `labeling_progress.py` / `dataset_card.py` / `build_train_set.py` / `agreement.py`
- [x] `run_field_pipeline.ps1`
- [x] Export API supports `?labeledOnly=1` + `labelCounts`

## Still human / field work

- [ ] Collect real campus labeled set (ethics approved)
- [ ] Replace demo contamination numbers with field results
- [ ] Manuscript polish + submit to Applied Intelligence
