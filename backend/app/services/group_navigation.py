from __future__ import annotations

import asyncio
import logging
import random
import string
import uuid
from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Any, Optional

from app.database import SessionLocal
from app.models.group_trip import GroupTrip
from app.models.user import User

logger = logging.getLogger("pujafinder.groups")

GROUP_MAX_MEMBERS = 10
LOCATION_UPDATE_COOLDOWN_SECONDS = 15
LOCATION_DISTANCE_THRESHOLD_METERS = 15
MEMBER_STALE_SECONDS = 120
STALLED_TIME_SECONDS = 300  # 5 minutes
STALLED_RADIUS_METERS = 25
ARRIVAL_RADIUS_METERS = 50


class GroupConnectionManager:
    """Manages active WebSockets for live group trip broadcasting."""
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


def _generate_join_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choices(alphabet, k=6))


def _avatar_url(seed: str) -> str:
    return f"https://api.dicebear.com/7.x/adventurer/svg?seed={seed or 'guest'}"


def _walking_eta_minutes(distance_meters: float | None) -> int:
    if distance_meters is None or distance_meters < 0:
        return 999
    # Average walking speed ~ 1.35 m/s (~4.8 km/h) in pandal crowd zones
    approx_seconds = distance_meters / 1.35
    return max(0, int(approx_seconds / 60))


def _build_member(
    user_id: str,
    *,
    name: str | None = None,
    role: str = "MEMBER",
    sharing_location: bool = False,
) -> dict[str, Any]:
    now = _utc_now()
    return {
        "userId": user_id,
        "name": name or f"Friend {user_id[-4:]}",
        "avatarUrl": _avatar_url(user_id),
        "role": role,  # HOST, CO_HOST, MEMBER
        "sharingLocation": sharing_location,
        "latitude": None,
        "longitude": None,
        "accuracy": None,
        "speed": 0,
        "heading": 0,
        "status": "OFFLINE",  # MOVING, STALLED, ARRIVED, ON_BREAK, LEAVING, OFFLINE
        "lastUpdated": _iso(now),
        "joinedAt": _iso(now),
        "distanceToDestination": None,
        "etaMinutes": 999,
        # Internal tracking history for stalled analysis
        "_locHistory": [],
    }


def _evaluate_stalled(member: dict[str, Any], lat: float, lon: float, accuracy: float, now: datetime) -> bool:
    """Detects stalled status only if user stays within 25m for > 5 min with high GPS accuracy."""
    if accuracy > 50:
        return False

    history = member.get("_locHistory") or []
    history.append({"lat": lat, "lon": lon, "time": now.timestamp()})
    cutoff = now.timestamp() - STALLED_TIME_SECONDS
    valid_history = [p for p in history if p["time"] >= cutoff]
    member["_locHistory"] = valid_history

    if len(valid_history) < 3:
        return False

    first_point = valid_history[0]
    for p in valid_history:
        if _haversine_meters(first_point["lat"], first_point["lon"], p["lat"], p["lon"]) > STALLED_RADIUS_METERS:
            return False

    return True


def create_group(
    user_id: str,
    group_name: str,
    *,
    initial_destination: dict[str, Any] | None = None,
    route_pandals: list[dict[str, Any]] | None = None,
    starts_at: datetime | None = None,
    ends_at: datetime | None = None,
    max_members: int = GROUP_MAX_MEMBERS,
    is_private: bool = True,
    user_name: str | None = None,
) -> dict[str, Any]:
    """Create a new group trip with the creator as Host."""
    clean_name = (group_name or "Puja Group Trip").strip()
    clean_dest = initial_destination or {}
    clean_route = route_pandals or ([clean_dest] if clean_dest else [])

    host_member = _build_member(user_id, name=user_name, role="HOST", sharing_location=False)

    db = SessionLocal()
    try:
        group_id = f"trip_{uuid.uuid4().hex[:12]}"
        join_code = _generate_join_code()
        invite_token = uuid.uuid4().hex

        # Ensure join code uniqueness
        while db.query(GroupTrip).filter(GroupTrip.join_code == join_code).first() is not None:
            join_code = _generate_join_code()

        trip = GroupTrip(
            group_id=group_id,
            group_name=clean_name,
            join_code=join_code,
            invite_token=invite_token,
            created_by=user_id,
            status="ACTIVE" if not starts_at or starts_at <= _utc_now() else "UPCOMING",
            starts_at=starts_at,
            ends_at=ends_at,
            max_members=max(2, min(max_members, 30)),
            is_private=is_private,
            destination=clean_dest,
            route_pandals=clean_route,
            checkpoints=[],
            meet_here_pin=None,
            members={user_id: host_member},
            messages=[],
            alerts=[],
            is_active=True,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)
        return get_group_snapshot(group_id, db) or {}
    finally:
        db.close()


def join_group_with_code(user_id: str, join_code: str, user_name: str | None = None) -> dict[str, Any]:
    """Join an active trip using the 6-character code."""
    db = SessionLocal()
    try:
        trip = db.query(GroupTrip).filter(
            GroupTrip.join_code == join_code.strip().upper(),
            GroupTrip.is_active == True,
        ).first()
        if not trip:
            raise ValueError("Group trip not found. Please check your join code.")
        return _add_member_to_trip(trip, user_id, user_name, db)
    finally:
        db.close()


def join_group_with_token(user_id: str, invite_token: str, user_name: str | None = None) -> dict[str, Any]:
    """Join an active trip using the secure invite token URL."""
    db = SessionLocal()
    try:
        trip = db.query(GroupTrip).filter(
            GroupTrip.invite_token == invite_token.strip(),
            GroupTrip.is_active == True,
        ).first()
        if not trip:
            raise ValueError("Invalid or expired invite link.")
        return _add_member_to_trip(trip, user_id, user_name, db)
    finally:
        db.close()


def _add_member_to_trip(trip: GroupTrip, user_id: str, user_name: str | None, db: Any) -> dict[str, Any]:
    if trip.status == "COMPLETED":
        raise ValueError("This trip has already ended.")

    members = dict(trip.members or {})
    if user_id not in members:
        if len(members) >= trip.max_members:
            raise ValueError(f"This group is full (max {trip.max_members} members).")

        members[user_id] = _build_member(user_id, name=user_name, role="MEMBER", sharing_location=False)
        trip.members = members
        db.commit()

        # Broadcast join alert
        asyncio.create_task(group_manager.broadcast(trip.group_id, {
            "type": "MEMBER_JOINED",
            "userId": user_id,
            "name": members[user_id]["name"],
            "snapshot": get_group_snapshot(trip.group_id, db),
        }))

    return get_group_snapshot(trip.group_id, db) or {}


def get_group_snapshot(group_id: str, db: Any = None) -> dict[str, Any] | None:
    """Fetch current snapshot of the group trip with live member statuses."""
    owns_db = False
    if db is None:
        db = SessionLocal()
        owns_db = True

    try:
        trip = db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first()
        if not trip:
            return None

        now = _utc_now()
        members = dict(trip.members or {})
        dest = trip.destination or {}
        dest_lat = dest.get("latitude")
        dest_lon = dest.get("longitude")

        # Sanitize and compute ETA / status for all members
        sanitized_members: dict[str, Any] = {}
        for uid, mem in members.items():
            m = dict(mem)
            # Offline status check
            last_ts = _parse_iso(m.get("lastUpdated"))
            if not m.get("sharingLocation"):
                m["status"] = "LOCATION_OFF"
                m["latitude"] = None
                m["longitude"] = None
            elif last_ts and (now - last_ts).total_seconds() > MEMBER_STALE_SECONDS:
                m["status"] = "OFFLINE"

            # Compute distance to destination if coordinates available
            if m.get("latitude") is not None and m.get("longitude") is not None and dest_lat is not None and dest_lon is not None:
                dist = _haversine_meters(m["latitude"], m["longitude"], dest_lat, dest_lon)
                m["distanceToDestination"] = round(dist)
                m["etaMinutes"] = _walking_eta_minutes(dist)
            else:
                m["distanceToDestination"] = None
                m["etaMinutes"] = 999

            # Strip private internals from client payload
            m.pop("_locHistory", None)
            sanitized_members[uid] = m

        return {
            "groupId": trip.group_id,
            "groupName": trip.group_name,
            "joinCode": trip.join_code,
            "inviteToken": trip.invite_token,
            "createdBy": trip.created_by,
            "status": trip.status,
            "startsAt": _iso(trip.starts_at),
            "endsAt": _iso(trip.ends_at),
            "maxMembers": trip.max_members,
            "isPrivate": trip.is_private,
            "destination": trip.destination,
            "routePandals": trip.route_pandals or [],
            "checkpoints": trip.checkpoints or [],
            "meetHerePin": trip.meet_here_pin,
            "members": sanitized_members,
            "messages": (trip.messages or [])[-50:],  # Recent 50 messages
            "alerts": (trip.alerts or [])[-20:],      # Recent 20 alerts
            "createdAt": _iso(trip.created_at),
            "updatedAt": _iso(trip.updated_at),
        }
    finally:
        if owns_db:
            db.close()


def update_member_location(group_id: str, user_id: str, loc_data: dict[str, Any]) -> dict[str, Any]:
    """Record a fresh GPS coordinate with battery/movement throttling and arrival geofencing."""
    lat = loc_data.get("latitude")
    lon = loc_data.get("longitude")
    accuracy = loc_data.get("accuracy", 10.0) or 10.0
    heading = loc_data.get("heading", 0.0) or 0.0
    speed = loc_data.get("speed", 0.0) or 0.0

    if lat is None or lon is None:
        raise ValueError("Coordinates are required.")

    db = SessionLocal()
    try:
        trip = db.query(GroupTrip).filter(GroupTrip.group_id == group_id, GroupTrip.is_active == True).first()
        if not trip:
            raise ValueError("Group trip not found.")

        members = dict(trip.members or {})
        if user_id not in members:
            raise ValueError("User is not a member of this trip.")

        member = dict(members[user_id])
        if not member.get("sharingLocation"):
            return get_group_snapshot(group_id, db) or {}

        now = _utc_now()
        prev_lat = member.get("latitude")
        prev_lon = member.get("longitude")
        prev_time = _parse_iso(member.get("lastUpdated"))

        # Movement threshold check: throttle if moved < 15m and update is < 15s old
        if prev_lat is not None and prev_lon is not None and prev_time is not None:
            dist = _haversine_meters(prev_lat, prev_lon, lat, lon)
            elapsed = (now - prev_time).total_seconds()
            if dist < LOCATION_DISTANCE_THRESHOLD_METERS and elapsed < LOCATION_UPDATE_COOLDOWN_SECONDS:
                return get_group_snapshot(group_id, db) or {}

        # Stalled evaluation
        is_stalled = _evaluate_stalled(member, lat, lon, accuracy, now)
        status = "STALLED" if is_stalled else ("MOVING" if speed > 0.5 else member.get("status", "MOVING"))

        # Destination arrival geofence check (within 50m)
        dest = trip.destination or {}
        if dest.get("latitude") and dest.get("longitude"):
            dest_dist = _haversine_meters(lat, lon, dest["latitude"], dest["longitude"])
            if dest_dist <= ARRIVAL_RADIUS_METERS:
                status = "ARRIVED"

        member["latitude"] = lat
        member["longitude"] = lon
        member["accuracy"] = accuracy
        member["heading"] = heading
        member["speed"] = speed
        member["status"] = status
        member["lastUpdated"] = _iso(now)

        members[user_id] = member
        trip.members = members
        db.commit()

        snapshot = get_group_snapshot(group_id, db) or {}
        asyncio.create_task(group_manager.broadcast(group_id, {
            "type": "LOCATION_UPDATE",
            "userId": user_id,
            "member": snapshot["members"].get(user_id),
        }))
        return snapshot
    finally:
        db.close()


def toggle_location_sharing(group_id: str, user_id: str, sharing: bool) -> dict[str, Any]:
    """Explicitly start or stop sharing live location."""
    db = SessionLocal()
    try:
        trip = db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first()
        if not trip:
            raise ValueError("Group trip not found.")

        members = dict(trip.members or {})
        if user_id not in members:
            raise ValueError("User not in group.")

        member = dict(members[user_id])
        member["sharingLocation"] = sharing
        if not sharing:
            # Privacy guarantee: wipe raw location when stopped
            member["latitude"] = None
            member["longitude"] = None
            member["status"] = "LOCATION_OFF"
            member["_locHistory"] = []
        else:
            member["status"] = "MOVING"
            member["lastUpdated"] = _iso(_utc_now())

        members[user_id] = member
        trip.members = members
        db.commit()

        snapshot = get_group_snapshot(group_id, db) or {}
        asyncio.create_task(group_manager.broadcast(group_id, {
            "type": "SHARING_TOGGLED",
            "userId": user_id,
            "sharing": sharing,
            "snapshot": snapshot,
        }))
        return snapshot
    finally:
        db.close()


def set_member_status(group_id: str, user_id: str, new_status: str) -> dict[str, Any]:
    """Update custom member status (MOVING, ARRIVED, ON_BREAK, LEAVING)."""
    valid = {"MOVING", "ARRIVED", "ON_BREAK", "LEAVING"}
    if new_status not in valid:
        raise ValueError(f"Invalid status. Choose from: {', '.join(valid)}")

    db = SessionLocal()
    try:
        trip = db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first()
        if not trip:
            raise ValueError("Group trip not found.")

        members = dict(trip.members or {})
        if user_id not in members:
            raise ValueError("User not in group.")

        members[user_id]["status"] = new_status
        members[user_id]["lastUpdated"] = _iso(_utc_now())
        trip.members = members
        db.commit()

        snapshot = get_group_snapshot(group_id, db) or {}
        asyncio.create_task(group_manager.broadcast(group_id, {
            "type": "STATUS_CHANGED",
            "userId": user_id,
            "status": new_status,
            "snapshot": snapshot,
        }))
        return snapshot
    finally:
        db.close()


def trigger_lost_alert(group_id: str, user_id: str, user_name: str | None, coords: dict[str, float] | None = None) -> dict[str, Any]:
    """Trigger an emergency 'I am Lost' notification to all group members."""
    db = SessionLocal()
    try:
        trip = db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first()
        if not trip:
            raise ValueError("Group trip not found.")

        alert = {
            "id": uuid.uuid4().hex[:8],
            "type": "IM_LOST",
            "userId": user_id,
            "userName": user_name or f"Friend {user_id[-4:]}",
            "coords": coords,
            "createdAt": _iso(_utc_now()),
        }

        alerts = list(trip.alerts or [])
        alerts.append(alert)
        trip.alerts = alerts
        db.commit()

        snapshot = get_group_snapshot(group_id, db) or {}
        asyncio.create_task(group_manager.broadcast(group_id, {
            "type": "EMERGENCY_ALERT",
            "alert": alert,
            "snapshot": snapshot,
        }))
        return snapshot
    finally:
        db.close()


def set_meet_here_pin(group_id: str, user_id: str, pin_data: dict[str, Any] | None) -> dict[str, Any]:
    """Host or Co-host drops a shared rendezvous point on the map."""
    db = SessionLocal()
    try:
        trip = db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first()
        if not trip:
            raise ValueError("Group trip not found.")

        members = dict(trip.members or {})
        user_role = members.get(user_id, {}).get("role", "MEMBER")
        if user_role not in ("HOST", "CO_HOST"):
            raise ValueError("Only the Host or a Co-host can drop a 'Meet Here' pin.")

        trip.meet_here_pin = pin_data
        db.commit()

        snapshot = get_group_snapshot(group_id, db) or {}
        asyncio.create_task(group_manager.broadcast(group_id, {
            "type": "MEET_HERE_UPDATED",
            "pin": pin_data,
            "snapshot": snapshot,
        }))
        return snapshot
    finally:
        db.close()


def add_checkpoint(group_id: str, user_id: str, cp_data: dict[str, Any]) -> dict[str, Any]:
    """Add a scheduled checkpoint (e.g. 'Meet at College Square at 7:30 PM')."""
    db = SessionLocal()
    try:
        trip = db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first()
        if not trip:
            raise ValueError("Group trip not found.")

        checkpoint = {
            "id": uuid.uuid4().hex[:8],
            "name": cp_data.get("name", "Checkpoint"),
            "latitude": cp_data.get("latitude"),
            "longitude": cp_data.get("longitude"),
            "scheduledTime": cp_data.get("scheduledTime"),
            "pandalId": cp_data.get("pandalId"),
            "isCompleted": False,
            "createdAt": _iso(_utc_now()),
        }

        checkpoints = list(trip.checkpoints or [])
        checkpoints.append(checkpoint)
        trip.checkpoints = checkpoints
        db.commit()

        snapshot = get_group_snapshot(group_id, db) or {}
        asyncio.create_task(group_manager.broadcast(group_id, {
            "type": "CHECKPOINT_ADDED",
            "checkpoint": checkpoint,
            "snapshot": snapshot,
        }))
        return snapshot
    finally:
        db.close()


def toggle_checkpoint_completed(group_id: str, checkpoint_id: str) -> dict[str, Any]:
    """Mark a checkpoint as completed."""
    db = SessionLocal()
    try:
        trip = db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first()
        if not trip:
            raise ValueError("Group trip not found.")

        checkpoints = list(trip.checkpoints or [])
        for cp in checkpoints:
            if cp.get("id") == checkpoint_id:
                cp["isCompleted"] = not cp.get("isCompleted", False)
                break

        trip.checkpoints = checkpoints
        db.commit()

        snapshot = get_group_snapshot(group_id, db) or {}
        asyncio.create_task(group_manager.broadcast(group_id, {
            "type": "CHECKPOINT_TOGGLED",
            "checkpointId": checkpoint_id,
            "snapshot": snapshot,
        }))
        return snapshot
    finally:
        db.close()


def send_chat_message(group_id: str, user_id: str, user_name: str | None, message: str, emoji: str | None = None) -> dict[str, Any]:
    """Send an in-trip short message or emoji reaction."""
    clean_msg = (message or "").strip()
    if not clean_msg and not emoji:
        raise ValueError("Message cannot be empty.")

    db = SessionLocal()
    try:
        trip = db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first()
        if not trip:
            raise ValueError("Group trip not found.")

        members = dict(trip.members or {})
        if user_id not in members:
            raise ValueError("User is not in this group trip.")

        msg = {
            "id": uuid.uuid4().hex[:8],
            "userId": user_id,
            "userName": user_name or members[user_id].get("name", "Friend"),
            "message": clean_msg,
            "emoji": emoji,
            "createdAt": _iso(_utc_now()),
        }

        messages = list(trip.messages or [])
        messages.append(msg)
        trip.messages = messages[-100:]  # Keep last 100 in memory/db
        db.commit()

        snapshot = get_group_snapshot(group_id, db) or {}
        asyncio.create_task(group_manager.broadcast(group_id, {
            "type": "CHAT_MESSAGE",
            "message": msg,
            "snapshot": snapshot,
        }))
        return snapshot
    finally:
        db.close()


def update_destination(group_id: str, user_id: str, destination_data: dict[str, Any]) -> dict[str, Any]:
    """Update current destination pandal."""
    db = SessionLocal()
    try:
        trip = db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first()
        if not trip:
            raise ValueError("Group trip not found.")

        members = dict(trip.members or {})
        user_role = members.get(user_id, {}).get("role", "MEMBER")
        if user_role not in ("HOST", "CO_HOST"):
            raise ValueError("Only the Host or a Co-host can change the group destination.")

        trip.destination = destination_data
        db.commit()

        snapshot = get_group_snapshot(group_id, db) or {}
        asyncio.create_task(group_manager.broadcast(group_id, {
            "type": "DESTINATION_UPDATED",
            "destination": destination_data,
            "snapshot": snapshot,
        }))
        return snapshot
    finally:
        db.close()


def set_member_role(group_id: str, host_id: str, target_user_id: str, role: str) -> dict[str, Any]:
    """Host promotes/demotes a member to/from Co-host."""
    if role not in ("CO_HOST", "MEMBER"):
        raise ValueError("Invalid role.")

    db = SessionLocal()
    try:
        trip = db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first()
        if not trip:
            raise ValueError("Group trip not found.")

        if trip.created_by != host_id:
            raise ValueError("Only the Host can manage member roles.")

        members = dict(trip.members or {})
        if target_user_id not in members:
            raise ValueError("Target user is not in this group.")

        members[target_user_id]["role"] = role
        trip.members = members
        db.commit()

        snapshot = get_group_snapshot(group_id, db) or {}
        asyncio.create_task(group_manager.broadcast(group_id, {
            "type": "ROLE_CHANGED",
            "userId": target_user_id,
            "role": role,
            "snapshot": snapshot,
        }))
        return snapshot
    finally:
        db.close()


def remove_member_from_trip(group_id: str, requester_id: str, target_user_id: str) -> dict[str, Any]:
    """Host kicks a member, or member leaves the trip voluntarily."""
    db = SessionLocal()
    try:
        trip = db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first()
        if not trip:
            raise ValueError("Group trip not found.")

        members = dict(trip.members or {})
        if target_user_id not in members:
            raise ValueError("Target user not found in group.")

        is_self = requester_id == target_user_id
        is_host = trip.created_by == requester_id

        if not is_self and not is_host:
            raise ValueError("You do not have permission to remove this member.")

        # If host leaves and others exist, transfer host to next member
        members.pop(target_user_id, None)
        if is_host and members:
            new_host_id = next(iter(members))
            members[new_host_id]["role"] = "HOST"
            trip.created_by = new_host_id

        trip.members = members
        if not members:
            trip.status = "COMPLETED"
            trip.is_active = False

        db.commit()

        snapshot = get_group_snapshot(group_id, db) or {}
        asyncio.create_task(group_manager.broadcast(group_id, {
            "type": "MEMBER_LEFT",
            "userId": target_user_id,
            "snapshot": snapshot,
        }))
        return snapshot
    finally:
        db.close()


def end_group_trip(group_id: str, host_id: str) -> dict[str, Any]:
    """Host ends the trip. Wipes all live GPS location traces to protect user privacy."""
    db = SessionLocal()
    try:
        trip = db.query(GroupTrip).filter(GroupTrip.group_id == group_id).first()
        if not trip:
            raise ValueError("Group trip not found.")

        if trip.created_by != host_id:
            raise ValueError("Only the Host can end the group trip.")

        trip.status = "COMPLETED"
        trip.is_active = False

        # Privacy purge: wipe coordinates for all members
        members = dict(trip.members or {})
        for uid in members:
            members[uid]["latitude"] = None
            members[uid]["longitude"] = None
            members[uid]["sharingLocation"] = False
            members[uid]["status"] = "ARRIVED"
            members[uid]["_locHistory"] = []

        trip.members = members
        db.commit()

        snapshot = get_group_snapshot(group_id, db) or {}
        asyncio.create_task(group_manager.broadcast(group_id, {
            "type": "TRIP_ENDED",
            "snapshot": snapshot,
        }))
        return snapshot
    finally:
        db.close()


def get_user_trips(user_id: str) -> dict[str, list[dict[str, Any]]]:
    """List current active, upcoming, and completed trips for a user."""
    db = SessionLocal()
    try:
        trips = db.query(GroupTrip).order_by(GroupTrip.created_at.desc()).all()
        user_active: list[dict[str, Any]] = []
        user_upcoming: list[dict[str, Any]] = []
        user_completed: list[dict[str, Any]] = []

        for t in trips:
            members = t.members or {}
            if user_id in members or t.created_by == user_id:
                snap = get_group_snapshot(t.group_id, db)
                if not snap:
                    continue

                if t.status == "COMPLETED" or not t.is_active:
                    user_completed.append(snap)
                elif t.status == "UPCOMING":
                    user_upcoming.append(snap)
                else:
                    user_active.append(snap)

        return {
            "active": user_active,
            "upcoming": user_upcoming,
            "completed": user_completed,
        }
    finally:
        db.close()
