from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services.group_navigation import (
    add_checkpoint,
    create_group,
    end_group_trip,
    get_group_snapshot,
    get_user_trips,
    join_group_with_code,
    join_group_with_token,
    remove_member_from_trip,
    send_chat_message,
    set_meet_here_pin,
    set_member_role,
    set_member_status,
    toggle_checkpoint_completed,
    toggle_location_sharing,
    trigger_lost_alert,
    update_destination,
    update_member_location,
)

router = APIRouter(prefix="/api/groups", tags=["Groups"])


class DestinationInput(BaseModel):
    pandalId: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    latitude: float
    longitude: float
    address: str = ""
    theme: Optional[str] = None
    crowdLevel: Optional[str] = None


class CreateGroupRequest(BaseModel):
    groupName: str = Field(..., min_length=2, max_length=200)
    initialDestination: Optional[DestinationInput] = None
    routePandals: list[DestinationInput] = Field(default_factory=list)
    startsAt: Optional[datetime] = None
    endsAt: Optional[datetime] = None
    maxMembers: int = Field(default=10, ge=2, le=30)
    isPrivate: bool = True


class JoinGroupRequest(BaseModel):
    joinCode: Optional[str] = Field(None, min_length=4, max_length=12)
    inviteToken: Optional[str] = None


class LocationUpdateRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = 10.0
    heading: Optional[float] = 0.0
    speed: Optional[float] = 0.0


class ToggleSharingRequest(BaseModel):
    sharing: bool


class StatusChangeRequest(BaseModel):
    status: str = Field(..., pattern="^(MOVING|ARRIVED|ON_BREAK|LEAVING)$")


class AddCheckpointRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    latitude: float
    longitude: float
    scheduledTime: Optional[str] = None
    pandalId: Optional[str] = None


class MeetHereRequest(BaseModel):
    latitude: float
    longitude: float
    title: str = "Meet here!"
    description: Optional[str] = None


class EmergencyAlertRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ChatMessageRequest(BaseModel):
    message: str = Field("", max_length=500)
    emoji: Optional[str] = None


class RoleChangeRequest(BaseModel):
    role: str = Field(..., pattern="^(CO_HOST|MEMBER)$")


@router.get("/my-trips")
def my_trips_route(current_user: User = Depends(get_current_user)):
    """Fetch user's active, upcoming, and completed group trips."""
    return get_user_trips(str(current_user.id))


@router.post("/create", status_code=status.HTTP_201_CREATED)
def create_group_route(payload: CreateGroupRequest, current_user: User = Depends(get_current_user)):
    """Create a new group trip with the creator as Host."""
    try:
        dest_data = payload.initialDestination.model_dump() if payload.initialDestination else None
        route_data = [p.model_dump() for p in payload.routePandals]
        return create_group(
            str(current_user.id),
            payload.groupName,
            initial_destination=dest_data,
            route_pandals=route_data,
            starts_at=payload.startsAt,
            ends_at=payload.endsAt,
            max_members=payload.maxMembers,
            is_private=payload.isPrivate,
            user_name=current_user.name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/join")
def join_group_route(payload: JoinGroupRequest, current_user: User = Depends(get_current_user)):
    """Join an active group trip using a 6-character code or invite token."""
    try:
        if payload.inviteToken:
            return join_group_with_token(str(current_user.id), payload.inviteToken, user_name=current_user.name)
        elif payload.joinCode:
            return join_group_with_code(str(current_user.id), payload.joinCode, user_name=current_user.name)
        else:
            raise HTTPException(status_code=400, detail="Must provide joinCode or inviteToken")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{group_id}")
def get_group_route(group_id: str):
    """Get real-time snapshot of the group trip."""
    snapshot = get_group_snapshot(group_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Group trip not found")
    return snapshot


@router.post("/{group_id}/location")
def update_group_location(
    group_id: str,
    payload: LocationUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    """Send a battery-friendly, throttled GPS location update."""
    try:
        return update_member_location(
            group_id,
            str(current_user.id),
            {
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "accuracy": payload.accuracy,
                "heading": payload.heading,
                "speed": payload.speed,
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{group_id}/toggle-sharing")
def toggle_sharing_route(
    group_id: str,
    payload: ToggleSharingRequest,
    current_user: User = Depends(get_current_user),
):
    """Explicitly start or stop sharing live GPS location."""
    try:
        return toggle_location_sharing(group_id, str(current_user.id), payload.sharing)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{group_id}/status")
def set_status_route(
    group_id: str,
    payload: StatusChangeRequest,
    current_user: User = Depends(get_current_user),
):
    """Set custom member status (MOVING, ARRIVED, ON_BREAK, LEAVING)."""
    try:
        return set_member_status(group_id, str(current_user.id), payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{group_id}/destination")
def update_group_destination(
    group_id: str,
    payload: DestinationInput,
    current_user: User = Depends(get_current_user),
):
    """Update current destination pandal."""
    try:
        return update_destination(group_id, str(current_user.id), payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{group_id}/meet-here")
def set_meet_here_route(
    group_id: str,
    payload: MeetHereRequest,
    current_user: User = Depends(get_current_user),
):
    """Host or Co-host drops a rendezvous point on the map."""
    try:
        return set_meet_here_pin(group_id, str(current_user.id), payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/{group_id}/checkpoint")
def add_checkpoint_route(
    group_id: str,
    payload: AddCheckpointRequest,
    current_user: User = Depends(get_current_user),
):
    """Add a scheduled checkpoint."""
    try:
        return add_checkpoint(group_id, str(current_user.id), payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{group_id}/checkpoint/{checkpoint_id}/toggle")
def toggle_checkpoint_route(
    group_id: str,
    checkpoint_id: str,
    current_user: User = Depends(get_current_user),
):
    """Toggle checkpoint completion status."""
    try:
        return toggle_checkpoint_completed(group_id, checkpoint_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{group_id}/alert/lost")
def emergency_lost_route(
    group_id: str,
    payload: EmergencyAlertRequest,
    current_user: User = Depends(get_current_user),
):
    """Broadcast an emergency 'I am Lost' alert to all trip members."""
    try:
        coords = {"latitude": payload.latitude, "longitude": payload.longitude} if payload.latitude and payload.longitude else None
        return trigger_lost_alert(group_id, str(current_user.id), current_user.name, coords=coords)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{group_id}/chat")
def chat_message_route(
    group_id: str,
    payload: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
):
    """Send an in-trip message or emoji reaction."""
    try:
        return send_chat_message(group_id, str(current_user.id), current_user.name, payload.message, payload.emoji)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{group_id}/members/{user_id}/role")
def change_role_route(
    group_id: str,
    user_id: str,
    payload: RoleChangeRequest,
    current_user: User = Depends(get_current_user),
):
    """Host promotes/demotes a member to/from Co-host."""
    try:
        return set_member_role(group_id, str(current_user.id), user_id, payload.role)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.delete("/{group_id}/members/{user_id}")
def remove_member_route(
    group_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
):
    """Host removes a member, or member leaves the trip voluntarily."""
    try:
        return remove_member_from_trip(group_id, str(current_user.id), user_id)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/{group_id}/end")
def end_trip_route(
    group_id: str,
    current_user: User = Depends(get_current_user),
):
    """Host ends the trip and purges detailed location traces for privacy."""
    try:
        return end_group_trip(group_id, str(current_user.id))
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
