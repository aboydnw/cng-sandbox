"""Shared SSRF protection for all URL-fetching endpoints."""

import ipaddress
import socket
from urllib.parse import urlparse


class SSRFError(ValueError):
    pass


def _is_unsafe_ip(addr: ipaddress._BaseAddress) -> bool:
    """Return True if the address belongs to a range we must not target."""
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_reserved
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_unspecified
    )


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
        if _is_unsafe_ip(addr):
            raise SSRFError("URLs pointing to private networks are not allowed")
    except ValueError:
        try:
            resolved = socket.getaddrinfo(hostname, None)
        except socket.gaierror as exc:
            raise SSRFError(f"Could not resolve hostname: {hostname}") from exc

        if not resolved:
            raise SSRFError(f"Could not resolve hostname: {hostname}")

        for _, _, _, _, sockaddr in resolved:
            addr = ipaddress.ip_address(sockaddr[0])
            if _is_unsafe_ip(addr):
                raise SSRFError(
                    "URLs resolving to private networks are not allowed"
                )

    return url
