import os
import tempfile

import boto3
import pytest
from moto import mock_aws

from src.services.storage import StorageService


@pytest.fixture
def storage():
    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="test-bucket")
        svc = StorageService(s3_client=s3, bucket="test-bucket")
        yield svc


def test_upload_raw_file(storage):
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        f.write(b"fake tiff data")
        path = f.name
    try:
        key = storage.upload_raw(path, dataset_id="abc-123", filename="data.tif")
        assert key == "datasets/abc-123/raw/data.tif"
    finally:
        os.unlink(path)


def test_upload_converted_file(storage):
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        f.write(b"fake cog data")
        path = f.name
    try:
        key = storage.upload_converted(path, dataset_id="abc-123", filename="output.tif")
        assert key == "datasets/abc-123/converted/output.tif"
    finally:
        os.unlink(path)


def test_get_presigned_url(storage):
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        f.write(b"data")
        path = f.name
    try:
        key = storage.upload_converted(path, dataset_id="abc-123", filename="output.tif")
        url = storage.get_presigned_url(key)
        assert "abc-123" in url
        assert "output.tif" in url
    finally:
        os.unlink(path)


def test_upload_pmtiles(storage):
    with tempfile.NamedTemporaryFile(suffix=".pmtiles", delete=False) as f:
        f.write(b"fake pmtiles data")
        path = f.name
    try:
        key = storage.upload_pmtiles(path, dataset_id="abc-123")
        assert key == "datasets/abc-123/converted/data.pmtiles"
    finally:
        os.unlink(path)
