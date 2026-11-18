"""Create a tiny offline demo bundle (no Mongo) to smoke-test the pipeline."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from pathlib import Path

from _common import RAW, ensure_dirs, save_json


def main() -> None:
    ensure_dirs()
    share_id = str(uuid.uuid4())
    qids = [str(uuid.uuid4()) for _ in range(5)]
    survey = {
        "_id": "demo_survey",
        "title": "Demo campus health",
        "shareId": share_id,
        "shareLink": f"/pages/survey.html?id={share_id}",
        "questions": [
            {
                "questionUniqueId": qids[0],
                "title": "Sleep hours",
                "type": "single",
                "role": "normal",
                "options": ["<6", "6-8", ">8"],
            },
            {
                "questionUniqueId": qids[1],
                "title": "Exercise",
                "type": "single",
                "role": "normal",
                "options": ["rarely", "weekly", "daily"],
            },
            {
                "questionUniqueId": qids[2],
                "title": "Stress",
                "type": "single",
                "role": "normal",
                "options": ["low", "mid", "high"],
            },
            {
                "questionUniqueId": qids[3],
                "title": "Attention: please select Agree",
                "type": "single",
                "role": "attention",
                "options": ["Disagree", "Neutral", "Agree"],
                "correctOption": "Agree",
            },
            {
                "questionUniqueId": qids[4],
                "title": "Platform check",
                "type": "single",
                "role": "honeypot",
                "options": ["I am a bot", "I am a human", "Skip"],
                "correctOption": "I am a bot",
            },
        ],
    }

    responses = []
    for i in range(40):
        started = datetime.utcnow() - timedelta(minutes=40 - i)
        duration = 20000 + i * 300
        answers = [
            {"questionId": qids[0], "answer": ["<6", "6-8", ">8"][i % 3]},
            {"questionId": qids[1], "answer": ["rarely", "weekly", "daily"][(i // 2) % 3]},
            {"questionId": qids[2], "answer": ["low", "mid", "high"][(i // 3) % 3]},
            {"questionId": qids[3], "answer": "Agree"},
            {"questionId": qids[4], "answer": "I am a human"},
        ]
        responses.append({
            "_id": f"real_{i}",
            "survey": "demo_survey",
            "answers": answers,
            "userInfo": {"gender": "男" if i % 2 == 0 else "女", "age": "18-30"},
            "startedAt": started.isoformat() + "Z",
            "submittedAt": (started + timedelta(milliseconds=duration)).isoformat() + "Z",
            "durationMs": duration,
            "questionEvents": [],
            "shareId": share_id,
            "responseBatchId": f"{share_id}:{started.strftime('%Y%m%d')}",
            "ipHash": f"ip_{i % 15}",
            "uaHash": "ua_demo",
            "attentionPassed": True,
            "attentionFailed": False,
            "honeypotTriggered": False,
            "isSynthetic": False,
            "label": "normal",
        })

    out = {
        "exportedAt": datetime.utcnow().isoformat() + "Z",
        "survey": survey,
        "responses": responses,
        "count": len(responses),
    }
    path = RAW / "demo_export.json"
    save_json(path, out)
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
