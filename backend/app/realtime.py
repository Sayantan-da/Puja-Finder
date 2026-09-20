"""WebSocket connection manager with Redis Pub/Sub support and in-memory fallback.

Tracks connected browsers per channel:
  - "<pandal_id>"  → everyone viewing that pandal's detail page
  - "all"          → everyone on the home page (global live feed)

In multi-server / multi-worker deployments, crowd updates are published to Redis Pub/Sub
so that connected WebSocket clients across all servers receive updates in real time.
"""
import asyncio
import json
import logging
from typing import Optional
from fastapi import WebSocket

from app.redis_client import get_redis_client

logger = logging.getLogger("pujafinder.realtime")

REDIS_PUBSUB_CHANNEL = "pujafinder:events:crowd"


class CrowdConnectionManager:
    def __init__(self) -> None:
        self._channels: dict[str, set[WebSocket]] = {}
        self._listener_task: Optional[asyncio.Task] = None

    @property
    def connection_count(self) -> int:
        return sum(len(conns) for conns in self._channels.values())

    async def connect(self, channel: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._channels.setdefault(channel, set()).add(websocket)

    def disconnect(self, channel: str, websocket: WebSocket) -> None:
        self._channels.get(channel, set()).discard(websocket)

    async def broadcast_locally(self, channel: str, message: dict) -> None:
        """Send a JSON message to every connection in a channel on this server instance."""
        dead = []
        for ws in self._channels.get(channel, set()).copy():
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(channel, ws)

    async def broadcast_crowd_update_local(self, pandal_id: int, payload: dict) -> None:
        """Push a crowd update to the pandal channel AND the global feed on this server."""
        await self.broadcast_locally(str(pandal_id), payload)
        await self.broadcast_locally("all", payload)

    async def broadcast_crowd_update(self, pandal_id: int, payload: dict) -> None:
        """Publish crowd update across all servers via Redis Pub/Sub (or broadcast locally if Redis is not configured)."""
        redis = await get_redis_client()
        if redis is not None:
            try:
                msg = json.dumps({"pandal_id": pandal_id, "payload": payload})
                await redis.publish(REDIS_PUBSUB_CHANNEL, msg)
                return
            except Exception as e:
                logger.warning("Failed to publish crowd update to Redis Pub/Sub: %s. Falling back to local broadcast.", e)

        # Local in-memory broadcast fallback
        await self.broadcast_crowd_update_local(pandal_id, payload)

    async def start_redis_listener(self) -> None:
        """Background task that subscribes to Redis Pub/Sub and relays updates to local WebSockets."""
        redis = await get_redis_client()
        if redis is None:
            return

        try:
            pubsub = redis.pubsub()
            await pubsub.subscribe(REDIS_PUBSUB_CHANNEL)
            logger.info("Subscribed to Redis Pub/Sub channel '%s'", REDIS_PUBSUB_CHANNEL)

            while True:
                try:
                    message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                    if message and message.get("type") == "message":
                        data_str = message.get("data")
                        if isinstance(data_str, bytes):
                            data_str = data_str.decode("utf-8")
                        if data_str:
                            event = json.loads(data_str)
                            pandal_id = event.get("pandal_id")
                            payload = event.get("payload")
                            if pandal_id is not None and payload:
                                await self.broadcast_crowd_update_local(pandal_id, payload)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.warning("Error reading Redis Pub/Sub message: %s", e)
                    await asyncio.sleep(1.0)

            await pubsub.unsubscribe(REDIS_PUBSUB_CHANNEL)
            await pubsub.close()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning("Redis Pub/Sub listener encountered an error: %s", e)


manager = CrowdConnectionManager()
