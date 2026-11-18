"""
Export survey responses (+ quality metadata) from MongoDB.

Usage:
  python export_responses.py --survey-id <ObjectId>
  python export_responses.py --share-id <uuid>
  python export_responses.py --from-file path/to/api_export.json
"""
from __future__ import annotations

import argparse
from datetime import datetime

from _common import RAW, ensure_dirs, load_json, mongo_uri, save_json


def export_from_mongo(survey_id: str | None, share_id: str | None) -> dict:
    from bson import ObjectId
    from pymongo import MongoClient

    client = MongoClient(mongo_uri())
    db = client.get_default_database()
    if db is None:
        # URI without db name
        db = client["surveySystem"]

    survey = None
    if survey_id:
        survey = db.surveys.find_one({"_id": ObjectId(survey_id)})
    elif share_id:
        survey = db.surveys.find_one({"shareId": share_id})
        if not survey:
            survey = db.surveys.find_one({"shareLink": f"/pages/survey.html?id={share_id}"})

    if not survey:
        raise SystemExit("Survey not found")

    sid = survey["_id"]
    responses = list(db.responses.find({"survey": sid}))
    for r in responses:
        r["_id"] = str(r["_id"])
        r["survey"] = str(r["survey"])

    survey_out = dict(survey)
    survey_out["_id"] = str(survey_out["_id"])
    if "creator" in survey_out:
        survey_out["creator"] = str(survey_out["creator"])

    return {
        "exportedAt": datetime.utcnow().isoformat() + "Z",
        "survey": survey_out,
        "responses": responses,
        "count": len(responses),
    }


def main() -> None:
    ensure_dirs()
    ap = argparse.ArgumentParser()
    ap.add_argument("--survey-id", default=None)
    ap.add_argument("--share-id", default=None)
    ap.add_argument("--from-file", default=None, help="Use JSON from GET /api/export/:id")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    if args.from_file:
        payload = load_json(__import__("pathlib").Path(args.from_file))
    else:
        if not args.survey_id and not args.share_id:
            raise SystemExit("Provide --survey-id or --share-id or --from-file")
        payload = export_from_mongo(args.survey_id, args.share_id)

    out = args.out or str(RAW / f"export_{payload['survey'].get('_id', 'unknown')}.json")
    save_json(__import__("pathlib").Path(out), payload)
    print(f"Wrote {payload.get('count', len(payload.get('responses', [])))} responses -> {out}")


if __name__ == "__main__":
    main()
