#!/usr/bin/env python3
"""
Wipe application data in PostgreSQL (TypeORM tables) and Chroma collections.

Run from repo root (ai_chat/), with Docker exposing ports:
  - Postgres: 5432
  - Chroma:   8000

Usage:
  pip install -r scripts/requirements-clear.txt
  python scripts/clear_postgres_chroma.py
  python scripts/clear_postgres_chroma.py --dry-run
  python scripts/clear_postgres_chroma.py --yes   # skip confirmation
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Repo root = parent of scripts/
REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ENV = REPO_ROOT / "main_service" / ".env"


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def parse_chroma_host_port(chroma_url: str) -> tuple[str, int]:
    """CHROMA_URL like http://chromadb:8000 or http://localhost:8000"""
    chroma_url = chroma_url.rstrip("/")
    if "://" in chroma_url:
        chroma_url = chroma_url.split("://", 1)[1]
    host, _, port_s = chroma_url.partition(":")
    port = int(port_s or "8000")
    return host, port


def clear_postgres(
    host: str,
    port: int,
    user: str,
    password: str,
    database: str,
    dry_run: bool,
) -> None:
    try:
        import psycopg2
    except ImportError:
        print("Install psycopg2: pip install psycopg2-binary", file=sys.stderr)
        sys.exit(1)

    # Same tables as main_service TypeORM entities (order-safe with CASCADE)
    sql = """
    TRUNCATE TABLE queries, request_logs, responses RESTART IDENTITY CASCADE;
    """

    print(f"[postgres] connecting to {host}:{port}/{database} as {user}")
    if dry_run:
        print("[postgres] DRY-RUN — would execute:")
        print(sql.strip())
        return

    conn = psycopg2.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        dbname=database,
    )
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        print("[postgres] OK — truncated queries, request_logs, responses")
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def clear_chroma(host: str, port: int, dry_run: bool) -> None:
    try:
        import chromadb
    except ImportError:
        print("Install chromadb: pip install chromadb", file=sys.stderr)
        sys.exit(1)

    # Collections used by main_service ChromaService
    known = ("cache", "firewall")

    print(f"[chroma] connecting to http://{host}:{port}")
    if dry_run:
        print("[chroma] DRY-RUN — would delete collections:", ", ".join(known))
        print("[chroma] DRY-RUN — (and any other collections listed via API)")
        return

    client = chromadb.HttpClient(host=host, port=port)
    names = [c.name for c in client.list_collections()]
    if not names:
        print("[chroma] no collections to delete")
        return

    for name in names:
        try:
            client.delete_collection(name)
            print(f"[chroma] deleted collection: {name}")
        except Exception as e:
            print(f"[chroma] failed to delete {name}: {e}", file=sys.stderr)
            raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--env-file",
        type=Path,
        default=DEFAULT_ENV,
        help=f"Path to .env (default: {DEFAULT_ENV})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print actions only",
    )
    parser.add_argument(
        "--yes",
        "-y",
        action="store_true",
        help="Do not ask for confirmation",
    )
    args = parser.parse_args()

    load_dotenv(args.env_file)

    # From host machine, Docker publishes postgres:5432 and chromadb:8000
    db_host = os.environ.get("DB_HOST", "localhost")
    if db_host == "postgres":
        db_host = "localhost"
    db_port = int(os.environ.get("DB_PORT", "5432"))
    db_user = os.environ.get("DB_USER", "app_user")
    db_password = os.environ.get("DB_PASSWORD", "app_password")
    db_name = os.environ.get("DB_NAME", "app_db")

    chroma_url = os.environ.get("CHROMA_URL", "http://localhost:8000")
    chroma_host, chroma_port = parse_chroma_host_port(chroma_url)
    if chroma_host in ("chromadb", "chroma"):
        chroma_host = "localhost"

    if not args.dry_run and not args.yes:
        print("This will DELETE all rows in Postgres (queries, request_logs, responses)")
        print("and DELETE all Chroma collections.")
        confirm = input("Type 'yes' to continue: ").strip()
        if confirm.lower() != "yes":
            print("Aborted.")
            sys.exit(0)

    clear_postgres(
        db_host,
        db_port,
        db_user,
        db_password,
        db_name,
        args.dry_run,
    )
    clear_chroma(chroma_host, chroma_port, args.dry_run)
    print("Done.")


if __name__ == "__main__":
    main()
