import logging
from typing import Optional

try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None

from app.config import settings

logger = logging.getLogger("pujafinder.redis")

_redis_client: Optional[object] = None


async def get_redis_client():
    """Return the global async Redis client if configured and installed, otherwise None.

    If REDIS_URL is not set, redis package is not installed, or connection fails,
    returns None for transparent in-memory fallback.
    """
    global _redis_client
    if not settings.redis_url or aioredis is None:
        return None

    if _redis_client is None:
        try:
            _redis_client = aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=False,
                socket_timeout=3.0,
                socket_connect_timeout=3.0,
            )
            # Quick ping to verify connectivity
            await _redis_client.ping()
            logger.info("Connected to Redis at %s", settings.redis_url.split("@")[-1])
        except Exception as e:
            logger.warning("Failed to connect to Redis: %s. Falling back to in-memory mode.", e)
            if _redis_client is not None:
                try:
                    await _redis_client.close()
                except Exception:
                    pass
            _redis_client = None

    return _redis_client


async def close_redis_client() -> None:
    """Close the global Redis client connection pool."""
    global _redis_client
    if _redis_client is not None:
        try:
            await _redis_client.close()
            logger.info("Closed Redis connection pool.")
        except Exception as e:
            logger.warning("Error closing Redis client: %s", e)
        finally:
            _redis_client = None
