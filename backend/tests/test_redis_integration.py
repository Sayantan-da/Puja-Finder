import asyncio
import os
import unittest
from unittest.mock import AsyncMock, patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["ENVIRONMENT"] = "development"
os.environ["CROWD_SIMULATOR"] = "off"
os.environ["CROWD_REPORT_COOLDOWN_MINUTES"] = "10"

from app.cache import TTLCacheState
from app.rate_limit import AuthRateLimiter
from app.realtime import CrowdConnectionManager, REDIS_PUBSUB_CHANNEL
from app.routers.crowd import _check_and_set_cooldown, _inmemory_cooldowns


class TestRedisAndMemoryIntegration(unittest.IsolatedAsyncioTestCase):

    async def test_cache_in_memory_flow(self):
        cache = TTLCacheState(max_entries=10)
        # Put item
        await cache.put("/api/pandals", b'{"data": [1, 2, 3]}', "application/json", ttl=60)
        
        # Get item
        hit = await cache.get("/api/pandals", ttl=60)
        self.assertIsNotNone(hit)
        body, media_type = hit
        self.assertEqual(body, b'{"data": [1, 2, 3]}')
        self.assertEqual(media_type, "application/json")

        # Invalidate prefix
        count = await cache.invalidate_prefix("/api/pandals")
        self.assertEqual(count, 1)

        # Confirm gone
        miss = await cache.get("/api/pandals", ttl=60)
        self.assertIsNone(miss)

    async def test_auth_rate_limiter_in_memory(self):
        limiter = AuthRateLimiter(max_attempts=3, window_seconds=60)
        key = "test_user_ip_123"

        # Initially not blocked
        blocked, _ = await limiter.is_blocked(key)
        self.assertFalse(blocked)

        # Record failures
        await limiter.record_failure(key)
        await limiter.record_failure(key)
        blocked, _ = await limiter.is_blocked(key)
        self.assertFalse(blocked)

        # 3rd failure locks key
        is_locked, retry_after = await limiter.record_failure(key)
        self.assertTrue(is_locked)
        self.assertGreater(retry_after, 0)

        # Now blocked
        blocked, retry = await limiter.is_blocked(key)
        self.assertTrue(blocked)
        self.assertGreater(retry, 0)

        # Reset
        await limiter.reset(key)
        blocked, _ = await limiter.is_blocked(key)
        self.assertFalse(blocked)

    async def test_crowd_report_cooldown(self):
        _inmemory_cooldowns.clear()
        user_id = 9999
        pandal_id = 42

        # 1st submission should pass
        blocked_secs = await _check_and_set_cooldown(user_id, pandal_id)
        self.assertIsNone(blocked_secs)

        # Immediate 2nd submission for the same pandal should be blocked
        blocked_secs = await _check_and_set_cooldown(user_id, pandal_id)
        self.assertIsNotNone(blocked_secs)
        self.assertGreater(blocked_secs, 0)

        # Submission for a DIFFERENT pandal should still pass
        blocked_diff_pandal = await _check_and_set_cooldown(user_id, 43)
        self.assertIsNone(blocked_diff_pandal)

    async def test_realtime_pubsub_dispatch_with_mock_redis(self):
        mock_redis = AsyncMock()
        with patch("app.realtime.get_redis_client", return_value=mock_redis):
            manager = CrowdConnectionManager()
            payload = {"pandal_id": 5, "crowd_level": "medium"}
            
            await manager.broadcast_crowd_update(5, payload)
            
            # Verify Redis publish was called with channel and json payload
            mock_redis.publish.assert_called_once()
            call_args = mock_redis.publish.call_args[0]
            self.assertEqual(call_args[0], REDIS_PUBSUB_CHANNEL)
            self.assertIn('"pandal_id": 5', call_args[1])


if __name__ == "__main__":
    unittest.main()
