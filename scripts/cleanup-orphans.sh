#!/usr/bin/env bash
# Delete datasets and stories that have no workspace_id.
# Runs the full delete logic (STAC, R2, vector tables, DB rows) inside the
# ingestion container so workspace auth checks are bypassed.

set -euo pipefail

echo "=== Fetching orphaned dataset IDs ==="
DATASET_IDS=$(docker compose -f docker-compose.yml exec -T database \
  psql -U sandbox -d postgis --no-align --tuples-only \
  -c "SELECT id FROM datasets WHERE workspace_id IS NULL;")

DATASET_COUNT=$(echo "$DATASET_IDS" | grep -c . || true)
echo "Found $DATASET_COUNT orphaned datasets"

echo ""
echo "=== Fetching orphaned story IDs ==="
STORY_IDS=$(docker compose -f docker-compose.yml exec -T database \
  psql -U sandbox -d postgis --no-align --tuples-only \
  -c "SELECT id FROM stories WHERE workspace_id IS NULL;")

STORY_COUNT=$(echo "$STORY_IDS" | grep -c . || true)
echo "Found $STORY_COUNT orphaned stories"

if [ "$DATASET_COUNT" -eq 0 ] && [ "$STORY_COUNT" -eq 0 ]; then
  echo ""
  echo "Nothing to clean up."
  exit 0
fi

echo ""
read -p "Delete $DATASET_COUNT datasets and $STORY_COUNT stories? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# Build ID arrays as JSON for the Python script
DS_JSON=$(echo "$DATASET_IDS" | awk 'NF{printf "\"%s\",",$0}' | sed 's/,$//')
ST_JSON=$(echo "$STORY_IDS" | awk 'NF{printf "\"%s\",",$0}' | sed 's/,$//')

docker compose -f docker-compose.yml exec -T ingestion python -c "
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.models.dataset import DatasetRow
from src.models.story import StoryRow
from src.services.dataset_delete import delete_dataset
from src.services.storage import StorageService
from src.config import get_settings

dataset_ids = [$DS_JSON]
story_ids = [$ST_JSON]

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

    print()
    print('=== Deleting datasets ===')
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

    print()
    print('=== Deleting stories ===')
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
    print()
    print(f'=== Done: {deleted} deleted, {failed} failed ===')

asyncio.run(main())
"
