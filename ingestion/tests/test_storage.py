import os
import tempfile

import obstore
import pytest
from obstore.store import MemoryStore

from src.services.storage import StorageService


@pytest.fixture
def storage():
    store = MemoryStore()
    return StorageService(store=store, bucket="test-bucket")


def test_upload_raw_file(storage):
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        f.write(b"fake tiff data")
        path = f.name
    try:
        key = storage.upload_raw(path, dataset_id="abc-123", filename="data.tif")
        assert key == "datasets/abc-123/raw/data.tif"
        result = obstore.get(storage.store, key)
        assert bytes(result.bytes()) == b"fake tiff data"
    finally:
        os.unlink(path)


def test_upload_converted_file(storage):
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        f.write(b"fake cog data")
        path = f.name
    try:
        key = storage.upload_converted(
            path, dataset_id="abc-123", filename="output.tif"
        )
        assert key == "datasets/abc-123/converted/output.tif"
        result = obstore.get(storage.store, key)
        assert bytes(result.bytes()) == b"fake cog data"
    finally:
        os.unlink(path)


def test_upload_pmtiles(storage):
    with tempfile.NamedTemporaryFile(suffix=".pmtiles", delete=False) as f:
        f.write(b"fake pmtiles data")
        path = f.name
    try:
        key = storage.upload_pmtiles(path, dataset_id="abc-123")
        assert key == "datasets/abc-123/converted/data.pmtiles"
        result = obstore.get(storage.store, key)
        assert bytes(result.bytes()) == b"fake pmtiles data"
    finally:
        os.unlink(path)


def test_upload_file_with_explicit_key(storage):
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as f:
        f.write(b"timestep data")
        path = f.name
    try:
        storage.upload_file(path, "datasets/abc-123/timesteps/0/data.tif")
        result = obstore.get(storage.store, "datasets/abc-123/timesteps/0/data.tif")
        assert bytes(result.bytes()) == b"timestep data"
    finally:
        os.unlink(path)


def test_delete_object(storage):
    obstore.put(storage.store, "datasets/ds-001/file.tif", b"data")
    storage.delete_object("datasets/ds-001/file.tif")
    with pytest.raises(FileNotFoundError):
        obstore.get(storage.store, "datasets/ds-001/file.tif")


def test_delete_prefix(storage):
    obstore.put(storage.store, "datasets/ds-001/file1.tif", b"a")
    obstore.put(storage.store, "datasets/ds-001/file2.tif", b"b")
    obstore.put(storage.store, "datasets/ds-002/other.tif", b"c")
    storage.delete_prefix("datasets/ds-001/")
    with pytest.raises(FileNotFoundError):
        obstore.get(storage.store, "datasets/ds-001/file1.tif")
    with pytest.raises(FileNotFoundError):
        obstore.get(storage.store, "datasets/ds-001/file2.tif")
    # ds-002 untouched
    result = obstore.get(storage.store, "datasets/ds-002/other.tif")
    assert bytes(result.bytes()) == b"c"


def test_get_s3_uri(storage):
    uri = storage.get_s3_uri("datasets/abc-123/converted/output.tif")
    assert uri == "s3://test-bucket/datasets/abc-123/converted/output.tif"
