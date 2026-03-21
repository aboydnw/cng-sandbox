"""S3/MinIO storage service for raw and converted files."""

import boto3

from src.config import get_settings


class StorageService:
    def __init__(self, s3_client=None, bucket: str | None = None):
        if s3_client is None:
            settings = get_settings()
            s3_client = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint,
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                region_name=settings.s3_region,
            )
        self.s3 = s3_client
        self.bucket = bucket or get_settings().s3_bucket

    def upload_raw(self, file_path: str, dataset_id: str, filename: str) -> str:
        """Upload a raw input file. Returns the S3 key."""
        key = f"datasets/{dataset_id}/raw/{filename}"
        self.s3.upload_file(file_path, self.bucket, key)
        return key

    def upload_converted(self, file_path: str, dataset_id: str, filename: str) -> str:
        """Upload a converted output file. Returns the S3 key."""
        key = f"datasets/{dataset_id}/converted/{filename}"
        self.s3.upload_file(file_path, self.bucket, key)
        return key

    def upload_pmtiles(self, local_path: str, dataset_id: str) -> str:
        """Upload a .pmtiles file to MinIO. Returns the storage key."""
        key = f"datasets/{dataset_id}/converted/data.pmtiles"
        self.s3.upload_file(local_path, self.bucket, key)
        return key

    def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a presigned URL for a stored file."""
        return self.s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    def get_s3_uri(self, key: str) -> str:
        """Return the s3:// URI for a key."""
        return f"s3://{self.bucket}/{key}"

    def delete_object(self, key: str) -> None:
        """Delete a single object from S3."""
        self.s3.delete_object(Bucket=self.bucket, Key=key)

    def delete_prefix(self, prefix: str) -> None:
        """Delete all objects under a given S3 prefix."""
        continuation_token = None
        while True:
            kwargs = {"Bucket": self.bucket, "Prefix": prefix}
            if continuation_token:
                kwargs["ContinuationToken"] = continuation_token
            resp = self.s3.list_objects_v2(**kwargs)
            for obj in resp.get("Contents", []):
                self.s3.delete_object(Bucket=self.bucket, Key=obj["Key"])
            if not resp.get("IsTruncated"):
                break
            continuation_token = resp.get("NextContinuationToken")
