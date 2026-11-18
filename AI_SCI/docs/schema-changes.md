# Schema changes (P0)

Authoritative runtime schemas live in `server.js`. JSON contracts in `AI_SCI/schemas/` mirror them for experiments.

## Survey

| Field | Type | Notes |
|-------|------|-------|
| `shareId` | String | Stable id embedded in share URL (`?id=` value) |
| `shareLink` | String | Path `/pages/survey.html?id=<shareId>` |
| `creator` | ObjectId | Propagation weak signal: who created the link |

## Response (new / extended)

### Timing & behavior

| Field | Type |
|-------|------|
| `startedAt` | Date |
| `submittedAt` | Date |
| `durationMs` | Number |
| `questionEvents` | `[{ questionId, firstAnswerAt, lastAnswerAt, changeCount }]` |

### Propagation / batch

| Field | Type |
|-------|------|
| `shareId` | String |
| `parentShareId` | String (optional, v1 usually empty) |
| `responseBatchId` | String (server-assigned day+share bucket) |

### Privacy-preserving device signals

| Field | Type |
|-------|------|
| `ipHash` | String (HMAC-SHA256, raw IP never stored) |
| `uaHash` | String |
| `sessionFingerprint` | String (client-provided opaque hash) |

### Quality / experiment

| Field | Type |
|-------|------|
| `qualityScore` | Number 0–1 (higher = more trustworthy) |
| `isSuspectedLowQuality` | Boolean |
| `detectionReasons` | [String] |
| `modelVersion` | String |
| `detectedAt` | Date |
| `label` | `normal` \| `low_quality` \| `synthetic` \| `uncertain` \| null |
| `isSynthetic` | Boolean |
| `injectionStrategy` | String |
| `injectionBatch` | String |

## Backward compatibility

Old responses without metadata remain valid; detectors treat missing fields as NaN / view dropout.
