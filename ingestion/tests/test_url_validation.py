import pytest

from src.services.url_validation import SSRFError, validate_url_safe


def test_rejects_file_scheme():
    with pytest.raises(SSRFError):
        validate_url_safe("file:///etc/passwd")


def test_rejects_ftp_scheme():
    with pytest.raises(SSRFError):
        validate_url_safe("ftp://example.com/data.tif")


def test_rejects_loopback_ip():
    with pytest.raises(SSRFError, match="private"):
        validate_url_safe("http://127.0.0.1:9000/bucket/file.tif")


def test_rejects_private_ip():
    with pytest.raises(SSRFError, match="private"):
        validate_url_safe("http://10.0.0.1/file.tif")


def test_rejects_link_local():
    with pytest.raises(SSRFError, match="private"):
        validate_url_safe("http://169.254.169.254/latest/meta-data/")


def test_allows_public_url():
    result = validate_url_safe("https://example.com/file.tif")
    assert result == "https://example.com/file.tif"


def test_rejects_no_hostname():
    with pytest.raises(SSRFError):
        validate_url_safe("http:///path")


def test_s3_rejected_by_default():
    with pytest.raises(SSRFError):
        validate_url_safe("s3://bucket/key")


def test_s3_allowed_when_enabled():
    result = validate_url_safe("s3://bucket/key", allow_s3=True)
    assert result == "s3://bucket/key"


def test_s3_skips_ip_check():
    result = validate_url_safe("s3://my-bucket/data.tif", allow_s3=True)
    assert result == "s3://my-bucket/data.tif"
