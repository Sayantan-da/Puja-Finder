"""WebSocket endpoint for live crowd updates.

Browsers connect to  ws(s)://<host>/ws/crowd/<channel>
where <channel> is a pandal id or "all" for the global feed.

Message flow:
1. On connect the server immediately sends {"type": "connected"} and then a
   {"type": "crowd_snapshot"} with the CURRENT estimates — so a freshly opened
   page shows fresh data with zero wait for the next report.
2. Whenever anyone posts a crowd report (or the simulator runs), every
   connected browser instantly receives {"type": "crowd_update", ...}.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.database import SessionLocal
from app.realtime import manager
from app.routers.pandals import _crowd_estimates
from app.services.group_navigation import get_group_snapshot, group_manager

router = APIRouter()


def _tz_iso(dt):
    """Naive-UTC datetime from SQLite → ISO string with explicit +00:00."""
    if dt is None:
        return None
    from datetime import timezone

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _estimate_payload(db, pandal_ids: list[int], names: dict[int, str] | None = None) -> dict:
    estimates = _crowd_estimates(db, pandal_ids)
    items = []
    for pid in pandal_ids:
        e = estimates.get(pid, {})
        level = e.get("crowd_level")
        items.append(
            {
                "pandal_id": pid,
                "pandal_name": names.get(pid) if names else None,
                "crowd_level": level.value if level else None,
                "waiting_time_minutes": e.get("waiting_time_minutes"),
                "crowd_updated_at": _tz_iso(e.get("crowd_updated_at")),
            }
        )
    return {"type": "crowd_snapshot", "estimates": items}


@router.websocket("/ws/crowd/{channel}")
async def crowd_channel(websocket: WebSocket, channel: str):
    await manager.connect(channel, websocket)
    try:
        await websocket.send_json({"type": "connected", "channel": channel})

        # Immediate snapshot so the page is fresh the moment it opens
        try:
            db = SessionLocal()
            try:
                from app.models.pandal import Pandal

                if channel == "all":
                    pandals = db.query(Pandal).all()
                    payload = _estimate_payload(
                        db, [p.id for p in pandals], names={p.id: p.name for p in pandals}
                    )
                else:
                    pid = int(channel)  # non-numeric channel → skip snapshot
                    payload = _estimate_payload(db, [pid])
                await websocket.send_json(payload)
            finally:
                db.close()
        except Exception:
            pass  # snapshot is best-effort; the live feed still works

        # Keep the connection open; client pings are ignored.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(channel, websocket)


@router.websocket("/ws/groups/{group_id}")
async def group_channel(websocket: WebSocket, group_id: str):
    await group_manager.connect(group_id, websocket)
    try:
        await websocket.send_json({"type": "connected", "groupId": group_id})
        snapshot = get_group_snapshot(group_id)
        if snapshot:
            await websocket.send_json({"type": "group_snapshot", "group": snapshot})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        group_manager.disconnect(group_id, websocket)
