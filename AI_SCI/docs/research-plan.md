# Research plan — Direction 1

## Problem

Campus health surveys shared by link/QR allow anonymous submission. Without account anchors, the response set is polluted by:

- random answering
- straight-lining
- duplicate / scripted submissions
- LLM-generated option patterns

Goal: detect suspected low-quality responses **without over-flagging genuine low-engagement respondents**, and show that filtering reduces bias in **group portrait statistics** (option percentages).

## Views (features)

1. **Answer view**: response vector patterns (entropy, straight-line ratio, rare option combos, speed-adjusted inconsistency).
2. **Behavior view**: `durationMs`, per-question change counts, inter-item timing (when available).
3. **Batch / weak-propagation view**: same `shareId`, arrival bursts, hash collisions in short windows (not a full referral tree in v1).

Fusion: late fusion / stacking of view scores vs single-view baselines.

## Baselines

- Rule heuristics (too-fast, straight-line)
- Isolation Forest / robust PCA on answer encodings
- Optional IRT residual scoring when item counts allow

## Primary metrics

| Metric | Why |
|--------|-----|
| Precision / Recall / F1 | detection quality vs synthetic + labeled set |
| False positive on “slow but valid” | protect low-engagement genuine users |
| Portrait bias Δ | |p̂_filtered − p_clean| vs |p̂_raw − p_clean| |
| Rank preservation | argmax option before/after filter |

## Contamination protocol

Inject at rates 5% / 10% / 20%:

- `random`: uniform over options
- `straight`: same index / same option repeatedly
- `llm`: prompt an LLM to fill Likert-like choices (template fallback if no API)

Mark `isSynthetic`, `injectionStrategy`, `injectionBatch`.

## Scope for Applied Intelligence

Emphasize **algorithm + ablation + real-problem metric (portrait bias)**. System is the data plane, not the paper contribution.
