"""
Write detection scores back to MongoDB responses (optional).

Usage:
  python writeback_scores.py --scores data/results/multiview_scores.json
"""
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

from _common import load_json, mongo_uri


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scores", required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    payload = load_json(Path(args.scores))
    from bson import ObjectId
    from pymongo import MongoClient

    client = MongoClient(mongo_uri())
    db = client.get_default_database() or client["surveySystem"]
    n = 0
    for row in payload.get("results") or []:
        rid = row.get("responseId")
        if not rid or str(rid).startswith("synthetic_"):
            continue
        update = {
            "qualityScore": row.get("qualityScore"),
            "isSuspectedLowQuality": row.get("isSuspectedLowQuality"),
            "detectionReasons": row.get("detectionReasons") or [],
            "modelVersion": row.get("modelVersion") or payload.get("modelVersion"),
            "detectedAt": datetime.utcnow(),
        }
        if args.dry_run:
            print("would update", rid, update["qualityScore"])
        else:
            db.responses.update_one({"_id": ObjectId(rid)}, {"$set": update})
        n += 1
    print(f"{'Dry-run' if args.dry_run else 'Updated'} {n} responses")


if __name__ == "__main__":
    main()
