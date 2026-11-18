# Ethics & privacy notes

## Data minimization

- Store **HMAC hashes** of IP and User-Agent, never plaintext.
- Use a server-side secret (`QUALITY_HASH_SECRET` or `SESSION_SECRET`) for HMAC.
- Client fingerprint is opaque; do not reverse-engineer identity.

## Consent

Filling page should disclose that **de-identified technical signals** (duration, device hash) are used for **response quality protection** and research.

Recommended checkbox copy (Chinese):

> 我已知晓：本评估会记录作答时长等脱敏技术信息，仅用于答卷质量检测与统计分析，不用于识别个人身份。

## IRB

Campus health data collection typically requires institutional ethics approval before publishing identifiable cohort results. For Applied Intelligence method papers using synthetic injection + anonymized aggregates, still disclose:

- consent mechanism
- hash-only device signals
- no sale of personal data
- deletion on survey/account delete (already cascaded in app)

## Retention

Experimental `isSynthetic` rows should be excluded from live “creator portrait” by default (`quality=high` or `isSynthetic != true`).
