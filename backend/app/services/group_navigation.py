from __future__ import annotations

import asyncio
import random
import string
from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Any

from app.database import SessionLocal
from app.models.group_trip import GroupTrip

GROUP_MAX_MEMBERS = 10
LOCATION_UPDATE_COOLDOWN_SECONDS = 12
LOCATION_DISTANCE_THRESHOLD_METERS = 20
MEMBER_STALE_SECONDS = 120
ARRIVAL_RADIUS_METERS = 50


class GroupConnectionManager:
    def __init__(self) -> None:
        self._channels: dict[str, set[Any]] = {}

    async def connect(self, group_id: str, websocket: Any) -> None:
        await websocket.accept()
        self._channels.setdefault(group_id, set()).add(websocket)

    def disconnect(self, group_id: str, websocket: Any) -> None:
        self._channels.get(group_id, set()).discard(websocket)

    async def broadcast(self, group_id: str, message: dict[str, Any]) -> None:
        dead: list[Any] = []
        for ws in list(self._channels.get(group_id, set())):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(group_id, ws)


group_manager = GroupConnectionManager()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return 2 * radius_km * asin(sqrt(a)) * 1000


def _member_display_name(user_id: str) -> str:
    return f"Friend {user_id[-4:]}" if user_id else "Guest"


def _avatar_url(user_id: str) -> str:
    seed = user_id or "guest"
    return f"https://api.dicebear.com/7.x/adventurer/svg?seed={seed}"


def _member_eta_minutes(distance_meters: float | None) -> int:
    if distance_meters is None:
        return 999
    approx_seconds = max(distance_meters / 1.4, 0)
    return max(0, int(approx_seconds / 60))


def _build_member(user_id: str, *, name: str | None = None, latitude: float | None = None, longitude: float | None = None) -> dict[str, Any]:
    now = _utc_now()
    member = {
        "name": name or _member_display_name(user_id),
        "avatarUrl": _avatar_url(user_id),
        "latitude": latitude,
        "longitude": longitude,
        "heading": 0,
        "speed": 0,
        "lastUpdated": _iso(now),
        "isOnline": True,
        "etaMinutes": 999,
    }
    if latitude is not None and longitude is not None:
        member["etaMinutes"] = 0
    return member


def _refresh_member_eta(member: dict[str, Any], destination: dict[str, Any]) -> dict[str, Any]:
    lat = member.get("latitude")
    lon = member.get("longitude")
    if lat is None or lon is None or not destination:
        member["etaMinutes"] = 999
        return member
    distance_m = _haversine_meters(float(lat), float(lon), float(destination["latitude"]), float(destination["longitude"]))
    member["etaMinutes"] = 0 if distance_m <= ARRIVAL_RADIUS_METERS else _member_eta_minutes(distance_m)
    last_updated = _parse_iso(member.get("lastUpdated"))
    member["isOnline"] = last_updated is None or (datetime.now(timezone.utc) - last_updated).total_seconds() <= MEMBER_STALE_SECONDS
    return member


def _group_snapshot(group: dict[str, Any]) -> dict[str, Any]:
    destination = group.get("destination") or {}
    members = {}
    for member_id, member in (group.get("members") or {}).items():
        _refresh_member_eta(member, destination)
        members[str(member_id)] = {
            "name": member.get("name"),
            "avatarUrl": member.get("avatarUrl"),
            "latitude": member.get("latitude"),
            "longitude": member.get("longitude"),
            "heading": member.get("heading", 0),
            "speed": member.get("speed", 0),
            "lastUpdated": member.get("lastUpdated"),
            "isOnline": member.get("isOnline", False),
            "etaMinutes": member.get("etaMinutes", 999),
        }
    return {
        "groupId": group["groupId"],
        "groupName": group["groupName"],
        "joinCode": group["joinCode"],
        "createdBy": group["createdBy"],
        "createdAt": group["createdAt"],
        "destination": destination,
        "members": members,
    }


def _generate_join_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choice(alphabet) for _ in range(6))
        if not code.isdigit() and not code.isalpha():
            return code


def _validate_destination(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "pandalId": str(payload.get("pandalId") or "pandal"),
        "name": payload.get("name") or "Shared Destination",
        "latitude": float(payload.get("latitude") or 0.0),
        "longitude": float(payload.get("longitude") or 0.0),
        "address": payload.get("address") or "Kolkata",
        "setBy": payload.get("setBy") or "system",
        "setAt": _iso(_utc_now()),
    }


def _serialize_group(record: GroupTrip) -> dict[str, Any]:
    return _group_snapshot({
        "groupId": record.group_id,
        "groupName": record.group_name,
        "joinCode": record.join_code,
        "createdBy": record.created_by,
        "createdAt": _iso(record.created_at),
        "destination": record.destination or {},
        "members": record.members or {},
    })


def create_group(user_id: str, group_name: str, initial_destination: dict[str, Any]) -> dict[str, Any]:
    with SessionLocal() as db:
        while True:
            join_code = "".join(random.choice(string.ascii_uppercase + string.digits) for _ in range(6))
            exists = db.query(GroupTrip).filter(GroupTrip.join_code == join_code).first()
            if not exists:
                break

        group_id = f"grp_{random.randint(100000, 999999)}"
        while db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first():
            group_id = f"grp_{random.randint(100000, 999999)}"

        destination = _validate_destination({**initial_destination, "setBy": user_id})
        members = {
            str(user_id): _build_member(
                str(user_id),
                name="You",
                latitude=destination["latitude"],
                longitude=destination["longitude"],
            )
        }

        record = GroupTrip(
            group_id=group_id,
            group_name=group_name or "Pandal Hop",
            join_code=join_code,
            created_by=str(user_id),
            destination=destination,
            members=members,
            is_active=True,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return _serialize_group(record)


def get_group_snapshot(group_id: str) -> dict[str, Any] | None:
    with SessionLocal() as db:
        record = db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first()
        if not record:
            return None
        return _serialize_group(record)


def join_group_with_code(user_id: str, join_code: str) -> dict[str, Any]:
    code = (join_code or "").strip().upper()
    with SessionLocal() as db:
        record = db.query(GroupTrip).filter(GroupTrip.join_code == code).first()
        if not record:
            raise ValueError("Invalid group join code")
        group = _serialize_group(record)
        if len(group["members"]) >= GROUP_MAX_MEMBERS:
            raise ValueError("Group is full")
        if str(user_id) in group["members"]:
            return group

        destination = group["destination"]
        group["members"][str(user_id)] = _build_member(
            str(user_id),
            name=_member_display_name(str(user_id)),
            latitude=destination.get("latitude"),
            longitude=destination.get("longitude"),
        )
        record.members = group["members"]
        db.commit()
        return _serialize_group(record)


def update_destination(group_id: str, user_id: str, new_destination: dict[str, Any]) -> dict[str, Any]:
    with SessionLocal() as db:
        record = db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first()
        if not record:
            raise ValueError("Group not found")

        payload = _validate_destination({**new_destination, "setBy": user_id})
        record.destination = payload
        members = record.members or {}
        for member in members.values():
            if member.get("latitude") is None or member.get("longitude") is None:
                member["latitude"] = payload["latitude"]
                member["longitude"] = payload["longitude"]
                member["lastUpdated"] = _iso(_utc_now())
            _refresh_member_eta(member, payload)
        record.members = members
        db.commit()
        payload_group = _serialize_group(record)
        _safe_broadcast(group_id, {"type": "group_update", "event": "destination_changed", "group": payload_group})
        return payload_group


def update_member_location(group_id: str, user_id: str, coords: dict[str, Any]) -> dict[str, Any]:
    with SessionLocal() as db:
        record = db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first()
        if not record:
            raise ValueError("Group not found")

        members = record.members or {}
        member_key = str(user_id)
        if member_key not in members:
            raise ValueError("Member is not in this group")

        member = members[member_key]
        now = _utc_now()
        lat = float(coords.get("latitude"))
        lon = float(coords.get("longitude"))
        heading = float(coords.get("heading") or 0)
        speed = float(coords.get("speed") or 0)

        previous_lat = member.get("latitude")
        previous_lon = member.get("longitude")
        last_updated = _parse_iso(member.get("lastUpdated"))
        if previous_lat is not None and previous_lon is not None and last_updated is not None:
            delta_m = _haversine_meters(previous_lat, previous_lon, lat, lon)
            if delta_m < LOCATION_DISTANCE_THRESHOLD_METERS and (now - last_updated).total_seconds() < LOCATION_UPDATE_COOLDOWN_SECONDS:
                member["latitude"] = lat
                member["longitude"] = lon
                member["heading"] = heading
                member["speed"] = speed
                member["lastUpdated"] = _iso(now)
                member["isOnline"] = True
                _refresh_member_eta(member, record.destination or {})
                record.members = members
                db.commit()
                return _serialize_group(record)

        member["latitude"] = lat
        member["longitude"] = lon
        member["heading"] = heading
        member["speed"] = speed
        member["lastUpdated"] = _iso(now)
        member["isOnline"] = True
        _refresh_member_eta(member, record.destination or {})
        record.members = members
        db.commit()

        payload_group = _serialize_group(record)
        _safe_broadcast(group_id, {"type": "group_update", "event": "member_location_updated", "group": payload_group})
        return payload_group


def _safe_broadcast(group_id: str, payload: dict[str, Any]) -> None:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        try:
            asyncio.run(group_manager.broadcast(group_id, payload))
        except Exception:
            pass
        return

    loop.create_task(group_manager.broadcast(group_id, payload))
