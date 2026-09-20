"""TTL response cache for hot public GET endpoints with Redis & in-memory support.

- Caches anonymous GET requests (never when an Authorization header is present).
- `invalidate_prefix()` allows write endpoints to bust stale entries instantly across servers.
- Uses Redis if REDIS_URL is set, otherwise falls back to fast in-memory dictionary.
"""
import logging
import time
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.redis_client import get_redis_client

logger = logging.getLogger("pujafinder.cache")


class TTLCacheState:
    def __init__(self, max_entries: int = 500) -> None:
        self.store: dict[str, tuple[float, bytes, str]] = {}
        self.max_entries = max_entries

    async def get(self, key: str, ttl: int) -> Optional[tuple[bytes, str]]:
        redis = await get_redis_client()
        if redis is not None:
            try:
                raw = await redis.get(f"pujafinder:cache:{key}")
                if raw is not None:
                    # Stored format: media_type + b"\n\n" + body
                    parts = raw.split(b"\n\n", 1)
                    if len(parts) == 2:
                        return parts[1], parts[0].decode("utf-8")
                return None
            except Exception as e:
                logger.warning("Redis cache get error: %s. Using in-memory store.", e)

        # In-memory fallback
        hit = self.store.get(key)
        if hit and (time.time() - hit[0]) < ttl:
            return hit[1], hit[2]
        if hit:
            self.store.pop(key, None)
        return None

    async def put(self, key: str, body: bytes, media_type: str, ttl: int = 60) -> None:
        redis = await get_redis_client()
        if redis is not None:
            try:
                payload = media_type.encode("utf-8") + b"\n\n" + body
                await redis.set(f"pujafinder:cache:{key}", payload, ex=ttl)
                return
            except Exception as e:
                logger.warning("Redis cache put error: %s. Using in-memory store.", e)

        # In-memory fallback
        if len(self.store) >= self.max_entries:
            oldest = min(self.store, key=lambda k: self.store[k][0])
            self.store.pop(oldest, None)
        self.store[key] = (time.time(), body, media_type)

    async def invalidate_prefix(self, prefix: str) -> int:
        count = 0
        redis = await get_redis_client()
        if redis is not None:
            try:
                pattern = f"pujafinder:cache:{prefix}*"
                cursor = 0
                keys_to_del = []
                while True:
                    cursor, keys = await redis.scan(cursor=cursor, match=pattern, count=100)
                    if keys:
                        keys_to_del.extend(keys)
                    if cursor == 0:
                        break
                if keys_to_del:
                    count += await redis.delete(*keys_to_del)
            except Exception as e:
                logger.warning("Redis cache invalidate error: %s", e)

        # Always clear local memory store as well
        local_keys = [k for k in self.store if k.startswith(prefix)]
        for k in local_keys:
            self.store.pop(k, None)
        count += len(local_keys)
        return count


ttl_cache = TTLCacheState()


class TTLCacheMiddleware(BaseHTTPMiddleware):
    """Cache anonymous GET responses whose path matches (prefix, ttl) rules."""

    def __init__(self, app, rules: list[tuple[str, int]]):
        super().__init__(app)
        self.rules = rules  # e.g. [("/api/pandals", 45), ("/api/content", 300)]

    def _ttl_for(self, path: str) -> Optional[int]:
        for prefix, ttl in self.rules:
            if path.startswith(prefix):
                return ttl
        return None

    async def dispatch(self, request, call_next):
        if request.method != "GET" or request.headers.get("authorization"):
            return await call_next(request)
        ttl = self._ttl_for(request.url.path)
        if ttl is None:
            return await call_next(request)

        key = request.url.path + (f"?{request.url.query}" if request.url.query else "")
        hit = await ttl_cache.get(key, ttl)
        if hit:
            body, media_type = hit
            return Response(
                content=body,
                status_code=200,
                media_type=media_type,
                headers={"X-Cache": "HIT", "Cache-Control": "no-store"},
            )

        response = await call_next(request)
        if response.status_code == 200:
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            media_type = response.media_type or "application/json"
            await ttl_cache.put(key, body, media_type, ttl=ttl)
            return Response(
                content=body,
                status_code=200,
                media_type=media_type,
                headers={"X-Cache": "MISS", "Cache-Control": "no-store"},
            )
        return response


class StaticCacheHeaderMiddleware(BaseHTTPMiddleware):
    """Long-lived browser caching for immutable assets and photos."""

    PREFIXES = ("/uploads/", "/assets/")

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.url.path.startswith(self.PREFIXES):
            response.headers["Cache-Control"] = "public, max-age=86400"
        return response
