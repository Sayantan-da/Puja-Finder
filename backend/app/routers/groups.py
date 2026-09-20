from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services.group_navigation import (
    create_group,
    get_group_snapshot,
    join_group_with_code,
    update_destination,
    update_member_location,
)

router = APIRouter(prefix="/api/groups", tags=["Groups"])


class DestinationInput(BaseModel):
    pandalId: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    latitude: float
    longitude: float
    address: str = Field(..., min_length=1)


class CreateGroupRequest(BaseModel):
    groupName: str = Field(..., min_length=1)
    initialDestination: DestinationInput


class JoinGroupRequest(BaseModel):
    joinCode: str = Field(..., min_length=6, max_length=6)


class LocationUpdateRequest(BaseModel):
    latitude: float
    longitude: float
    heading: float | None = 0.0
    speed: float | None = 0.0


@router.post("/create")
def create_group_route(payload: CreateGroupRequest, current_user: User = Depends(get_current_user)):
    try:
        return create_group(str(current_user.id), payload.groupName, payload.initialDestination.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/join")
def join_group_route(payload: JoinGroupRequest, current_user: User = Depends(get_current_user)):
    try:
        return join_group_with_code(str(current_user.id), payload.joinCode)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{group_id}")
def get_group_route(group_id: str):
    snapshot = get_group_snapshot(group_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Group not found")
    return snapshot


@router.post("/{group_id}/destination")
def update_group_destination(group_id: str, payload: DestinationInput, current_user: User = Depends(get_current_user)):
    try:
        return update_destination(group_id, str(current_user.id), payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{group_id}/location")
def update_group_location(group_id: str, payload: LocationUpdateRequest, current_user: User = Depends(get_current_user)):
    try:
        return update_member_location(
            group_id,
            str(current_user.id),
            {
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "heading": payload.heading,
                "speed": payload.speed,
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
