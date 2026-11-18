"""Shared helpers for AI_SCI offline scripts."""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw"
SYN = DATA / "synthetic"
RESULTS = DATA / "results"


def ensure_dirs() -> None:
    for p in (RAW, SYN, RESULTS):
        p.mkdir(parents=True, exist_ok=True)


def load_dotenv_from_repo() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    repo_env = ROOT.parent / ".env"
    local_env = ROOT / ".env"
    if repo_env.exists():
        load_dotenv(repo_env)
    if local_env.exists():
        load_dotenv(local_env, override=True)


def mongo_uri() -> str:
    load_dotenv_from_repo()
    return os.getenv("MONGODB_URI", "mongodb://localhost:27017/surveySystem")


def save_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))
