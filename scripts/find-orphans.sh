#!/usr/bin/env bash
# Identify orphaned objects in R2 and STAC that have no matching database row.
# This finds data that was left behind when the old cleanup.py only deleted
# DB rows without cleaning up R2 objects or STAC collections.
#
# Usage:
#   ./scripts/find-orphans.sh                          # dry-run: list orphans only
#   ./scripts/find-orphans.sh --delete                 # prompt to delete orphaned objects
#   ./scripts/find-orphans.sh --stale-workspaces       # list workspaces by last activity
#   ./scripts/find-orphans.sh --delete-workspace <id>  # delete all datasets in a workspace

set -euo pipefail

MODE="${1:-}"

if [[ "$MODE" == "--delete-workspace" ]]; then
  WS_ID="${2:-}"
  if [[ -z "$WS_ID" ]]; then
    echo "Usage: $0 --delete-workspace <workspace_id>"
    exit 1
  fi

  echo "=== Workspace $WS_ID ==="
  echo ""

  # Show what will be deleted
  docker compose -f docker-compose.yml exec -T database \
    psql -U sandbox -d postgis --no-align --tuples-only -c \
    "SELECT COUNT(*) FROM datasets WHERE workspace_id = '$WS_ID';" \
    | read DATASET_COUNT

  docker compose -f docker-compose.yml exec -T database \
    psql -U sandbox -d postgis --no-align --tuples-only -c \
    "SELECT COUNT(*) FROM stories WHERE workspace_id = '$WS_ID';" \
    | read STORY_COUNT

  echo "Found $DATASET_COUNT datasets and $STORY_COUNT stories"

  if [ "$DATASET_COUNT" -eq 0 ] && [ "$STORY_COUNT" -eq 0 ]; then
    echo "Nothing to delete."
    exit 0
  fi

  # Preview datasets
  docker compose -f docker-compose.yml exec -T database \
    psql -U sandbox -d postgis -c \
    "SELECT id, filename, dataset_type, created_at::date FROM datasets WHERE workspace_id = '$WS_ID' ORDER BY created_at;"

  read -p "Delete everything in workspace $WS_ID? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi

  # Get dataset IDs
  DS_IDS=$(docker compose -f docker-compose.yml exec -T database \
    psql -U sandbox -d postgis --no-align --tuples-only -c \
    "SELECT id FROM datasets WHERE workspace_id = '$WS_ID';")

  ST_IDS=$(docker compose -f docker-compose.yml exec -T database \
    psql -U sandbox -d postgis --no-align --tuples-only -c \
    "SELECT id FROM stories WHERE workspace_id = '$WS_ID';")

  DS_JSON=$(echo "$DS_IDS" | awk 'NF{printf "\"%s\",",$0}' | sed 's/,$//')
  ST_JSON=$(echo "$ST_IDS" | awk 'NF{printf "\"%s\",",$0}' | sed 's/,$//')

  docker compose -f docker-compose.yml exec -T ingestion python -c "
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.models.story import StoryRow
from src.services.dataset_delete import delete_dataset
from src.services.storage import StorageService
from src.config import get_settings

dataset_ids = [${DS_JSON}]
story_ids = [${ST_JSON}]

async def main():
    settings = get_settings()
    engine = create_engine(settings.postgres_dsn)
    Session = sessionmaker(bind=engine)

    try:
        storage = StorageService()
    except Exception:
        storage = None
        print('  Warning: could not init storage, R2 cleanup will be skipped')

    session = Session()
    deleted = 0
    failed = 0

    for did in dataset_ids:
        try:
            result = await delete_dataset(session, did, storage=storage)
            if result:
                print(f'  Deleted dataset {did}')
                deleted += 1
            else:
                print(f'  Not found: {did}')
                failed += 1
        except Exception as e:
            print(f'  FAILED dataset {did}: {e}')
            failed += 1

    for sid in story_ids:
        try:
            row = session.get(StoryRow, sid)
            if row:
                session.delete(row)
                session.commit()
                print(f'  Deleted story {sid}')
                deleted += 1
            else:
                print(f'  Not found: {sid}')
                failed += 1
        except Exception as e:
            print(f'  FAILED story {sid}: {e}')
            session.rollback()
            failed += 1

    session.close()
    print(f'\n=== Done: {deleted} deleted, {failed} failed ===')

asyncio.run(main())
"
  exit 0
fi

if [[ "$MODE" == "--stale-workspaces" ]]; then
  echo "=== Stale workspaces ==="
  echo ""
  docker compose -f docker-compose.yml exec -T database \
    psql -U sandbox -d postgis -c "
      SELECT
        workspace_id,
        COUNT(*) AS datasets,
        MIN(created_at)::date AS oldest,
        MAX(created_at)::date AS newest,
        NOW()::date - MAX(created_at)::date AS days_idle
      FROM datasets
      WHERE workspace_id IS NOT NULL
      GROUP BY workspace_id
      ORDER BY newest ASC;
    "
  exit 0
fi

DELETE_MODE=false
if [[ "$MODE" == "--delete" ]]; then
  DELETE_MODE=true
fi

echo "=== Finding orphaned R2 objects and STAC collections ==="
echo ""

docker compose -f docker-compose.yml exec -T ingestion python -c "
import asyncio
import json
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.config import get_settings
from src.models.dataset import DatasetRow
from src.services.storage import StorageService

DELETE_MODE = $( $DELETE_MODE && echo 'True' || echo 'False' )


async def main():
    settings = get_settings()
    engine = create_engine(settings.postgres_dsn)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Get all dataset IDs from the database
    db_ids = {row.id for row in session.query(DatasetRow.id).all()}
    print(f'Database has {len(db_ids)} datasets')

    # --- R2 orphans ---
    print()
    print('--- R2 bucket orphans ---')
    try:
        import obstore
        storage = StorageService()
        seen = set()
        for chunk in obstore.list(storage.store, prefix='datasets/'):
            for item in chunk:
                path = item['path']
                relative = path[len('datasets/'):]
                top_dir = relative.split('/')[0]
                if top_dir:
                    seen.add(top_dir)
        r2_ids = seen
        r2_orphans = r2_ids - db_ids
        print(f'R2 has {len(r2_ids)} dataset prefixes, {len(r2_orphans)} orphaned')
        for oid in sorted(r2_orphans):
            print(f'  datasets/{oid}/')
    except Exception as e:
        r2_orphans = set()
        print(f'  Could not list R2 objects: {e}')

    # --- STAC orphans ---
    print()
    print('--- STAC collection orphans ---')
    stac_orphans = []
    try:
        import httpx
        async with httpx.AsyncClient(
            base_url=settings.stac_api_url, timeout=30.0
        ) as client:
            resp = await client.get('/collections')
            if resp.status_code == 200:
                collections = resp.json().get('collections', [])
                sandbox_collections = [
                    c for c in collections if c['id'].startswith('sandbox-')
                ]
                print(f'STAC has {len(sandbox_collections)} sandbox collections')
                for coll in sandbox_collections:
                    # Collection ID is sandbox-{dataset_id}
                    dataset_id = coll['id'].removeprefix('sandbox-')
                    if dataset_id not in db_ids:
                        stac_orphans.append(coll['id'])
                        print(f'  {coll[\"id\"]}')
                if not stac_orphans:
                    print('  (none)')
            else:
                print(f'  Could not list STAC collections: HTTP {resp.status_code}')
    except Exception as e:
        print(f'  Could not reach STAC API: {e}')

    # --- Vector table orphans ---
    print()
    print('--- PostGIS vector table orphans ---')
    pg_orphans = []
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            result = conn.execute(text(
                \"\"\"SELECT tablename FROM pg_tables
                   WHERE schemaname = 'public'
                   AND tablename LIKE 'sandbox\\_%%'\"\"\"
            ))
            sandbox_tables = [row[0] for row in result]
            print(f'PostGIS has {len(sandbox_tables)} sandbox_ tables')
            for table in sandbox_tables:
                # Table name is sandbox_{id_without_hyphens}
                table_id_part = table.removeprefix('sandbox_')
                # Check if any DB dataset ID (with hyphens removed) matches
                matched = any(
                    did.replace('-', '') == table_id_part for did in db_ids
                )
                if not matched:
                    pg_orphans.append(table)
                    print(f'  {table}')
            if not pg_orphans:
                print('  (none)')
    except Exception as e:
        print(f'  Could not list PostGIS tables: {e}')

    # --- Summary ---
    print()
    total = len(r2_orphans) + len(stac_orphans) + len(pg_orphans)
    print(f'=== Total orphans: {total} ({len(r2_orphans)} R2, {len(stac_orphans)} STAC, {len(pg_orphans)} PostGIS) ===')

    if total == 0:
        print('Nothing to clean up.')
        session.close()
        return

    if not DELETE_MODE:
        print()
        print('Run with --delete to remove these orphans.')
        session.close()
        return

    # --- Delete orphans ---
    confirm = input(f'\\nDelete {total} orphaned objects? [y/N] ')
    if confirm.strip().lower() != 'y':
        print('Aborted.')
        session.close()
        return

    print()
    deleted = 0

    if r2_orphans:
        print('Deleting R2 orphans...')
        for oid in sorted(r2_orphans):
            try:
                storage.delete_prefix(f'datasets/{oid}/')
                print(f'  Deleted R2 prefix datasets/{oid}/')
                deleted += 1
            except Exception as e:
                print(f'  FAILED R2 datasets/{oid}/: {e}')

    if stac_orphans:
        print('Deleting STAC orphans...')
        from src.services.dataset_delete import delete_stac_collection
        for coll_id in stac_orphans:
            try:
                await delete_stac_collection(coll_id)
                print(f'  Deleted STAC collection {coll_id}')
                deleted += 1
            except Exception as e:
                print(f'  FAILED STAC {coll_id}: {e}')

    if pg_orphans:
        print('Deleting PostGIS orphans...')
        from sqlalchemy import text
        with engine.connect() as conn:
            for table in pg_orphans:
                try:
                    conn.execute(text(f'DROP TABLE IF EXISTS \"{table}\"'))
                    conn.commit()
                    print(f'  Dropped table {table}')
                    deleted += 1
                except Exception as e:
                    conn.rollback()
                    print(f'  FAILED table {table}: {e}')

    session.close()
    print(f'\\n=== Done: {deleted}/{total} orphans cleaned up ===')

asyncio.run(main())
"
