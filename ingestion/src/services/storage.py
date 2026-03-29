"""S3 storage service for raw and converted files."""

from pathlib import Path

import obstore
from obstore.store import S3Store

from src.config import get_settings


class StorageService:
    def __init__(self, store=None, bucket: str | None = None):
        settings = get_settings()
        self.bucket = bucket or settings.s3_bucket
        if store is None:
            kwargs = {
                "bucket": self.bucket,
                "region": settings.s3_region,
                "virtual_hosted_style_request": "false",
            }
            if settings.aws_access_key_id:
                kwargs["access_key_id"] = settings.aws_access_key_id
            if settings.aws_secret_access_key:
                kwargs["secret_access_key"] = settings.aws_secret_access_key
            if settings.s3_endpoint:
                kwargs["endpoint"] = settings.s3_endpoint
            store = S3Store(**kwargs)
        self.store = store

    def _upload(self, file_path: str, key: str) -> None:
        """Read a local file and put it to object storage."""
        data = Path(file_path).read_bytes()
        obstore.put(self.store, key, data)

    def upload_raw(self, file_path: str, dataset_id: str, filename: str) -> str:
        """Upload a raw input file. Returns the S3 key."""
        key = f"datasets/{dataset_id}/raw/{filename}"
        self._upload(file_path, key)
        return key

    def upload_converted(self, file_path: str, dataset_id: str, filename: str) -> str:
        """Upload a converted output file. Returns the S3 key."""
        key = f"datasets/{dataset_id}/converted/{filename}"
        self._upload(file_path, key)
        return key

    def upload_pmtiles(self, local_path: str, dataset_id: str) -> str:
        """Upload a .pmtiles file to S3. Returns the storage key."""
        key = f"datasets/{dataset_id}/converted/data.pmtiles"
        self._upload(local_path, key)
        return key

    def upload_file(self, file_path: str, key: str) -> None:
        """Upload a local file to an explicit key."""
        self._upload(file_path, key)

    def get_s3_uri(self, key: str) -> str:
        """Return the s3:// URI for a key."""
        return f"s3://{self.bucket}/{key}"

    def delete_object(self, key: str) -> None:
        """Delete a single object from storage."""
        obstore.delete(self.store, key)

    def delete_prefix(self, prefix: str) -> None:
        """Delete all objects under a given prefix."""
        keys = []
        for chunk in obstore.list(self.store, prefix=prefix):
            for item in chunk:
                keys.append(item["path"])
        if keys:
            obstore.delete(self.store, keys)
