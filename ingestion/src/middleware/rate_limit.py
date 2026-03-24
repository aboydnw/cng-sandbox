"""Simple in-memory per-IP rate limiter."""

import time
from collections import defaultdict
from fastapi import Request, HTTPException


class RateLimiter:
    def __init__(self, requests_per_minute: int = 60):
        self.rpm = requests_per_minute
        self._requests: dict[str, list[float]] = defaultdict(list)

    def check(self, request: Request):
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        window = now - 60.0

        # Prune old entries
        self._requests[ip] = [t for t in self._requests[ip] if t > window]

        if len(self._requests[ip]) >= self.rpm:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please wait before searching again.",
                headers={"Retry-After": "60"},
            )

        self._requests[ip].append(now)

    def reset(self):
        self._requests.clear()


catalog_rate_limiter = RateLimiter(requests_per_minute=60)
