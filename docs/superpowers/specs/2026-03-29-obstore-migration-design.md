# Replace boto3 with obstore for S3/R2 storage

**Issue:** [#63](https://github.com/aboydnw/cng-sandbox/issues/63)
**Date:** 2026-03-29

## Summary

Replace `boto3` with [obstore](https://github.com/developmentseed/obstore) in the ingestion service. obstore is a Rust-backed Python library for S3-compatible object storage, offering better performance and a simpler API. This is a drop-in swap — the `StorageService` class keeps its existing interface while its internals change from boto3 to obstore.

## Motivation

- **Performance:** Rust-native I/O is faster than boto3's pure-Python implementation, especially for large file uploads (COGs can be hundreds of MB)
- **Simplicity:** boto3 is a massive SDK covering every AWS service; obstore is purpose-built for object storage
- **Ecosystem alignment:** Development Seed maintains obstore and uses it across their tools (titiler, etc.)

## Scope

### What changes

| File | Change |
|------|--------|
| `ingestion/pyproject.toml` | Add `obstore`, remove `boto3`, remove `moto[s3]` from dev deps |
| `ingestion/src/services/storage.py` | Replace boto3 client with `S3Store`; rewrite all methods to use obstore API |
| `ingestion/src/services/temporal_pipeline.py` | Replace direct `storage.s3.upload_file()` call (line 162) with a proper `StorageService` method |
| `ingestion/tests/test_storage.py` | Replace `mock_aws()`/boto3 fixtures with obstore `MemoryStore` |
| `ingestion/tests/test_pmtiles_ingest.py` | Same — replace moto fixtures with `MemoryStore` |
| `ingestion/tests/test_datasets.py` | Replace hand-rolled `FakeS3` class with `MemoryStore`-backed `StorageService` |

### What doesn't change

- `ingestion/src/config.py` — same env vars and settings class
- `.env` — no new environment variables
- Docker setup — no new system dependencies
- All callers of `StorageService` — same method signatures
- `get_s3_uri()` — unchanged (string formatting only)

## Design

### StorageService internals

The class keeps its public interface. Internal changes:

| Current (boto3) | New (obstore) |
|-----------------|---------------|
| `self.s3` (boto3 S3 client) | `self.store` (obstore `S3Store`) |
| `self.s3.upload_file(path, bucket, key)` | `obstore.put(self.store, key, Path(path).read_bytes())` |
| `self.s3.delete_object(Bucket=bucket, Key=key)` | `obstore.delete(self.store, key)` |
| `self.s3.list_objects_v2(Bucket=bucket, Prefix=prefix)` | `obstore.list(self.store, prefix=prefix)` |
| `self.s3.generate_presigned_url(...)` | **Removed** (dead code — defined and tested but never called by application code) |

### S3Store configuration

The `S3Store` is initialized with explicit config matching the existing env vars:

- `aws_access_key_id` → `S3Store` `access_key_id`
- `aws_secret_access_key` → `S3Store` `secret_access_key`
- `s3_endpoint` → `S3Store` `endpoint`
- `s3_region` → `S3Store` `region`
- `s3_bucket` → `S3Store` `bucket`

Constructor still accepts an optional store for dependency injection (tests pass a `MemoryStore`).

### temporal_pipeline.py fix

Line 162 currently bypasses `StorageService`:
```python
storage.s3.upload_file(cog_path, storage.bucket, key)
```

This will be replaced with a new `StorageService.upload_file(file_path, key)` method — a general-purpose upload that takes an explicit key. This keeps all obstore usage inside `storage.py`.

### Testing strategy

- **No mocking framework needed.** obstore provides `MemoryStore`, an in-memory object store that behaves like a real store.
- Test fixtures create a `MemoryStore` and pass it to `StorageService(store=memory_store, bucket="test-bucket")`.
- Verification reads back objects via `obstore.get(store, key)` instead of `s3.get_object()`.
- The `FakeS3` class in `test_datasets.py` is replaced with a real `StorageService` backed by `MemoryStore`.

### Dependencies

| Action | Package | Location |
|--------|---------|----------|
| Add | `obstore` | `[project] dependencies` |
| Remove | `boto3>=1.35.0` | `[project] dependencies` |
| Remove | `moto[s3]>=5.0.0` | `[project.optional-dependencies] dev` |

## Acceptance criteria

- All file uploads to R2 use obstore instead of boto3
- No remaining imports of `boto3` or `moto` in the codebase
- `get_presigned_url` removed (dead code cleanup)
- No code outside `storage.py` touches obstore internals directly
- All existing tests pass, rewritten for obstore
- `docker compose up` works end-to-end (upload a file, verify tiles serve)
