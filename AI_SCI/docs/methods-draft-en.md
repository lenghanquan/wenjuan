# Methods draft (Applied Intelligence) — Direction 1

> Working draft for the manuscript. Replace demo numbers with final experimental tables.

## 1. Problem setting

We study low-quality and synthetic response detection for **login-free campus health surveys** distributed via share links / QR codes. Without account anchors, response sets are vulnerable to random answering, straight-lining, repeated submissions, and LLM-generated option patterns. The operational goal is not only detection accuracy, but **reducing bias in group portrait statistics** (option shares) after filtering.

## 2. System and data plane

The Zhihui Qingjian platform collects structured single/multiple-choice responses with privacy-preserving metadata:

- behavior: `startedAt`, `submittedAt`, `durationMs`, per-item change counts;
- weak propagation / batch: `shareId`, `responseBatchId`, hashed IP/UA, session fingerprint;
- auxiliary items: attention checks and honeypot trap options (roles hidden from respondents);
- labels: human review labels and experimental synthetic injection markers.

Detection runs **offline**; scores can be written back for portrait filtering (`quality=high|suspect|all`).

## 3. Multi-view detection

### 3.1 Answer view

Encode option selections as multi-hot vectors. Combine rule heuristics (too-fast, straight-lining, always-first-option, failed attention/honeypot) with Isolation Forest anomaly scores.

### 3.2 Behavior view

Score duration per item and revision activity. Extremely short completions are down-weighted.

### 3.3 Batch / weak-propagation view

Score burst arrivals under the same `shareId` and repeated device hashes within short windows.

### 3.4 Fusion

Late fusion of view scores (default weights 0.4 / 0.35 / 0.25). Ablation removes each view.

### 3.5 Supervised / semi-supervised variant

With sparse human labels (and synthetic markers in controlled contamination), we train a Random Forest on handcrafted features (rule/behavior/batch scores, duration, attention/honeypot flags, answer summary stats). Optional **self-training** adds high-confidence unlabeled predictions.

## 4. Contamination protocol

Into a clean response set we inject synthetic rows at rates \(r \in \{0.05,0.10,0.20\}\) using strategies:

- random option sampling;
- straight / always-first patterns;
- LLM-like mid-option templates (API optional; template fallback offline).

Injected rows are marked `isSynthetic` and excluded from “clean” portrait baselines.

## 5. Metrics

- Detection: Precision, Recall, F1 against synthetic/human low-quality labels.
- Downstream: L1 distance of option-share vectors vs clean distribution, before/after filtering; bias reduction; top-option rank preservation.
- Harm: false positives on genuine low-engagement but valid respondents (when human labels available).

## 6. Ethics

Only HMAC hashes of IP/UA are stored. Respondents consent to de-identified technical signals used for quality protection. Health content is non-diagnostic.

## 7. Reproducibility

Scripts under `AI_SCI/scripts/`:

```bash
python make_demo_bundle.py
python run_ablation.py --in data/raw/demo_export.json
python detect_supervised.py --in data/synthetic/ablation_r0.2.json --semi
python plot_ablation.py
```
