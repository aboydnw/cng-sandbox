"""Shared SSRF protection for all URL-fetching endpoints."""

import ipaddress
import socket
from urllib.parse import urlparse


class SSRFError(ValueError):
    pass


def validate_url_safe(url: str, *, allow_s3: bool = False) -> str:
    """Validate that a URL does not target private/internal networks.

    Raises SSRFError if the URL points to a private, loopback, or reserved IP.
    Returns the URL unchanged if safe.
    """
    parsed = urlparse(url)

    allowed_schemes = {"http", "https"}
    if allow_s3:
        allowed_schemes.add("s3")

    if parsed.scheme not in allowed_schemes:
        schemes = ", ".join(sorted(allowed_schemes))
        raise SSRFError(f"Only {schemes} URLs are supported")

    if parsed.scheme == "s3":
        return url

    hostname = parsed.hostname
    if not hostname:
        raise SSRFError("URL must include a hostname")

    try:
        addr = ipaddress.ip_address(hostname)
        if addr.is_private or addr.is_loopback or addr.is_reserved:
            raise SSRFError("URLs pointing to private networks are not allowed")
    except ValueError:
        # hostname is a DNS name, resolve it
        try:
            resolved = socket.getaddrinfo(hostname, None)
            for _, _, _, _, sockaddr in resolved:
                addr = ipaddress.ip_address(sockaddr[0])
                if addr.is_private or addr.is_loopback or addr.is_reserved:
                    raise SSRFError(
                        "URLs resolving to private networks are not allowed"
                    )
        except socket.gaierror:
            pass

    return url
