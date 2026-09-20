"""Per-IP fixed-window rate limiting & brute-force defense with Redis and in-memory support.

NOTE on Puja-night reality: many legitimate users share carrier NAT IPs
(thousands of people behind the same Jio/Airtel gateway), so per-IP limits
are deliberately GENEROUS. These limits stop bots, runaway loops and brute
force — not real crowds.
"""
import logging
import time
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.redis_client import get_redis_client

logger = logging.getLogger("pujafinder.ratelimit")

# (name, HTTP methods, path prefix, max requests, window seconds)
RULES: list[tuple[str, tuple[str, ...], str, int, int]] = [
    ("auth",    ("POST",),                 "/api/auth",    20,  60),
    ("upload",  ("POST",),                 "/api/moments", 30, 3600),
    ("upload",  ("POST",),                 "/api/pandals", 30, 3600),   # …/images
    ("write",   ("POST", "PUT", "PATCH", "DELETE"), "/api", 30, 60),
    ("read",    ("GET",),                  "/api",        120,  60),
]


def get_client_ip(request: Request) -> str:
    """Extract real client IP behind Cloudflare Tunnel or reverse proxies (OWASP A07)."""
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()

    x_forwarded = request.headers.get("x-forwarded-for")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()

    return request.client.host if request.client else "unknown"


def _match(method: str, path: str) -> tuple[str, int, int] | None:
    for name, methods, prefix, limit, window in RULES:
        if method in methods and path.startswith(prefix):
            # uploads are POSTs under /api/pandals — keep them out of the 30/min bucket
            if name == "write" and path.endswith("/images"):
                continue
            return name, limit, window
    return None


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-IP fixed-window counters with Redis distributed store and in-memory fallback."""

    def __init__(self, app):
        super().__init__(app)
        # In-memory fallback: {ip: {rule_name: (window_start, count)}}
        self.buckets: dict[str, dict[str, tuple[float, int]]] = {}
        self._last_cleanup = time.time()

    def _cleanup_if_needed(self) -> None:
        now = time.time()
        if now - self._last_cleanup < 300 and len(self.buckets) < 10_000:
            return
        for ip in list(self.buckets):
            for rule, (start, _cnt) in list(self.buckets[ip].items()):
                window = self._window_for(rule)
                if now - start > window:
                    self.buckets[ip].pop(rule, None)
            if not self.buckets[ip]:
                self.buckets.pop(ip, None)
        self._last_cleanup = now

    @staticmethod
    def _window_for(rule: str) -> int:
        for name, _m, _p, _limit, window in RULES:
            if name == rule:
                return window
        return 60

    async def dispatch(self, request: Request, call_next):
        match = _match(request.method, request.url.path)
        if match is None:
            return await call_next(request)

        rule, limit, window = match
        ip = get_client_ip(request)

        # 1. Try Redis for distributed multi-server rate limiting
        redis = await get_redis_client()
        if redis is not None:
            try:
                redis_key = f"pujafinder:ratelimit:{ip}:{rule}"
                pipe = redis.pipeline()
                pipe.incr(redis_key)
                pipe.ttl(redis_key)
                count, ttl = await pipe.execute()

                if count == 1 or ttl < 0:
                    await redis.expire(redis_key, window)
                    ttl = window

                if count > limit:
                    retry_after = max(1, ttl)
                    return JSONResponse(
                        status_code=429,
                        content={"detail": f"Too many requests. Rate limit exceeded: {limit} per {window} seconds."},
                        headers={"Retry-After": str(retry_after)},
                    )
                return await call_next(request)
            except Exception as e:
                logger.warning("Redis rate limiter error: %s. Falling back to in-memory.", e)

        # 2. In-memory fallback
        now = time.time()
        self._cleanup_if_needed()

        user_buckets = self.buckets.setdefault(ip, {})
        start, count = user_buckets.get(rule, (now, 0))
        if now - start >= window:
            start, count = now, 0

        count += 1
        user_buckets[rule] = (start, count)

        if count > limit:
            retry_after = max(1, int(window - (now - start)))
            return JSONResponse(
                status_code=429,
                content={"detail": f"Too many requests. Rate limit exceeded: {limit} per {window} seconds."},
                headers={"Retry-After": str(retry_after)},
            )
        return await call_next(request)


class AuthRateLimiter:
    """Dedicated brute-force defense tracking failed attempts per IP and per account (OWASP A07)."""

    def __init__(self, max_attempts: int = 5, window_seconds: int = 900):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        # In-memory fallback: key -> (first_attempt_timestamp, count, locked_until_timestamp)
        self._attempts: dict[str, tuple[float, int, float]] = {}

    async def is_blocked(self, key: str) -> tuple[bool, int]:
        """Check if key is currently blocked. Returns (blocked: bool, retry_after: int)."""
        redis = await get_redis_client()
        if redis is not None:
            try:
                lock_key = f"pujafinder:authlock:{key}"
                ttl = await redis.ttl(lock_key)
                if ttl > 0:
                    return True, ttl
            except Exception as e:
                logger.warning("Redis auth lockout check error: %s", e)

        # In-memory check
        now = time.time()
        record = self._attempts.get(key)
        if not record:
            return False, 0

        first_ts, count, locked_until = record
        if now < locked_until:
            return True, max(1, int(locked_until - now))

        if now - first_ts > self.window_seconds:
            self._attempts.pop(key, None)
            return False, 0

        return False, 0

    async def record_failure(self, key: str) -> tuple[bool, int]:
        """Record a failed attempt. If threshold exceeded, lock key."""
        redis = await get_redis_client()
        if redis is not None:
            try:
                fail_key = f"pujafinder:authfail:{key}"
                lock_key = f"pujafinder:authlock:{key}"
                pipe = redis.pipeline()
                pipe.incr(fail_key)
                pipe.ttl(fail_key)
                count, ttl = await pipe.execute()

                if count == 1 or ttl < 0:
                    await redis.expire(fail_key, self.window_seconds)

                if count >= self.max_attempts:
                    await redis.set(lock_key, "1", ex=self.window_seconds)
                    return True, self.window_seconds
                return False, 0
            except Exception as e:
                logger.warning("Redis record auth failure error: %s", e)

        # In-memory fallback
        now = time.time()
        record = self._attempts.get(key)

        if not record or (now - record[0] > self.window_seconds):
            self._attempts[key] = (now, 1, 0.0)
            return False, 0

        first_ts, count, locked_until = record
        new_count = count + 1

        if new_count >= self.max_attempts:
            locked_until = now + self.window_seconds
            self._attempts[key] = (first_ts, new_count, locked_until)
            return True, self.window_seconds

        self._attempts[key] = (first_ts, new_count, 0.0)
        return False, 0

    async def reset(self, key: str) -> None:
        """Clear attempts for key upon successful authentication."""
        redis = await get_redis_client()
        if redis is not None:
            try:
                fail_key = f"pujafinder:authfail:{key}"
                lock_key = f"pujafinder:authlock:{key}"
                await redis.delete(fail_key, lock_key)
            except Exception as e:
                logger.warning("Redis auth reset error: %s", e)

        self._attempts.pop(key, None)


# Singleton instance for authentication endpoints
auth_limiter = AuthRateLimiter()
