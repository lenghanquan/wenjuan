"""
Inject synthetic / low-quality responses into an exported JSON bundle.

Strategies: random | straight | llm (template fallback without API key)
"""
from __future__ import annotations

import argparse
import copy
import random
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from _common import RAW, SYN, ensure_dirs, load_json, save_json


def _options_for(survey: dict) -> list[dict]:
    return survey.get("questions") or []


def make_random(survey: dict) -> list[dict]:
    answers = []
    for q in _options_for(survey):
        opts = q.get("options") or ["A"]
        qid = q.get("questionUniqueId") or str(q.get("_id", ""))
        if q.get("type") == "multiple":
            k = max(1, random.randint(1, min(2, len(opts))))
            ans = random.sample(opts, k)
        else:
            ans = random.choice(opts)
        answers.append({"questionId": qid, "answer": ans})
    return answers


def make_straight(survey: dict) -> list[dict]:
    answers = []
    for q in _options_for(survey):
        opts = q.get("options") or ["A"]
        qid = q.get("questionUniqueId") or str(q.get("_id", ""))
        ans = opts[0]
        if q.get("type") == "multiple":
            ans = [opts[0]]
        answers.append({"questionId": qid, "answer": ans})
    return answers


def make_llm_template(survey: dict) -> list[dict]:
    """Deterministic 'plausible' pattern without calling an LLM (offline fallback)."""
    answers = []
    for i, q in enumerate(_options_for(survey)):
        opts = q.get("options") or ["A"]
        qid = q.get("questionUniqueId") or str(q.get("_id", ""))
        # Prefer middle options when available (common LLM bias on Likert-like items)
        idx = len(opts) // 2
        ans = opts[idx]
        if q.get("type") == "multiple":
            ans = [opts[idx]]
            if len(opts) > 1 and i % 3 == 0:
                ans.append(opts[0])
        answers.append({"questionId": qid, "answer": ans})
    return answers


STRATEGIES = {
    "random": make_random,
    "straight": make_straight,
    "llm": make_llm_template,
}


def inject(bundle: dict, rate: float, strategies: list[str], seed: int) -> dict:
    random.seed(seed)
    survey = bundle["survey"]
    real = [r for r in bundle["responses"] if not r.get("isSynthetic")]
    n_real = len(real)
    n_inj = max(1, int(round(n_real * rate))) if n_real else int(20 * rate) or 1
    batch = f"inj_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{seed}"
    share_id = survey.get("shareId") or ""
    if not share_id and survey.get("shareLink"):
        share_id = str(survey["shareLink"]).split("id=")[-1]

    synthetic = []
    for i in range(n_inj):
        strat = strategies[i % len(strategies)]
        fn = STRATEGIES[strat]
        started = datetime.utcnow() - timedelta(seconds=random.randint(5, 40))
        # Make injected rows deliberately fast / bursty so baselines can catch them in smoke tests
        if strat == "straight":
            duration = random.randint(200, 900)
        elif strat == "random":
            duration = random.randint(300, 1200)
        else:
            duration = random.randint(500, 2000)
        answers = fn(survey)
        # If survey has attention/honeypot roles, synthetic rows usually fail them
        attention_failed = False
        honeypot_triggered = False
        for q in _options_for(survey):
            role = q.get("role") or "normal"
            qid = q.get("questionUniqueId") or str(q.get("_id", ""))
            opts = q.get("options") or ["A"]
            if role == "attention":
                correct = q.get("correctOption") or opts[-1]
                # fail attention on purpose
                wrong = next((o for o in opts if o != correct), opts[0])
                for a in answers:
                    if a["questionId"] == qid:
                        a["answer"] = wrong
                attention_failed = True
            if role == "honeypot":
                trap = q.get("correctOption") or opts[0]
                for a in answers:
                    if a["questionId"] == qid:
                        a["answer"] = trap
                honeypot_triggered = True

        rec = {
            "_id": f"synthetic_{uuid.uuid4().hex[:12]}",
            "survey": survey.get("_id"),
            "answers": answers,
            "userInfo": {
                "gender": random.choice(["男", "女", "其他"]),
                "age": random.choice(["18以下", "18-30", "31-45", "45以上"]),
            },
            "startedAt": started.isoformat() + "Z",
            "submittedAt": (started + timedelta(milliseconds=duration)).isoformat() + "Z",
            "durationMs": duration,
            "questionEvents": [],
            "shareId": share_id,
            "parentShareId": None,
            "responseBatchId": f"{share_id}:{datetime.utcnow().strftime('%Y%m%d')}",
            # Reuse a small hash pool so batch/hash_repeat view has signal in demos
            "ipHash": f"synth_ip_{i % 3}",
            "uaHash": f"synth_ua_{i % 2}",
            "sessionFingerprint": f"synth_fp_{i % 4}",
            "attentionFailed": attention_failed or None,
            "attentionPassed": (False if attention_failed else None),
            "honeypotTriggered": honeypot_triggered or None,
            "isSynthetic": True,
            "injectionStrategy": strat,
            "injectionBatch": batch,
            "label": "synthetic",
        }
        synthetic.append(rec)

    out = copy.deepcopy(bundle)
    out["responses"] = real + synthetic
    out["injection"] = {
        "rate": rate,
        "n_real": n_real,
        "n_injected": len(synthetic),
        "strategies": strategies,
        "batch": batch,
        "seed": seed,
    }
    out["count"] = len(out["responses"])
    return out


def main() -> None:
    ensure_dirs()
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True, help="Exported JSON path")
    ap.add_argument("--rate", type=float, default=0.1)
    ap.add_argument("--strategies", default="random,straight,llm")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    strategies = [s.strip() for s in args.strategies.split(",") if s.strip()]
    for s in strategies:
        if s not in STRATEGIES:
            raise SystemExit(f"Unknown strategy: {s}")

    bundle = load_json(Path(args.inp))
    out_bundle = inject(bundle, args.rate, strategies, args.seed)
    out = Path(args.out) if args.out else SYN / f"contaminated_r{args.rate}_{out_bundle['injection']['batch']}.json"
    save_json(out, out_bundle)
    print(f"Injected {out_bundle['injection']['n_injected']} -> {out}")


if __name__ == "__main__":
    main()
