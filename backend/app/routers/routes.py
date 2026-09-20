"""Smart Pandal Hopping & Route Planner API.

Provides:
- Curated Themed Trails (North Kolkata Heritage, South Kolkata Art, etc.)
- TSP (Traveling Salesperson Problem) Route Optimization for custom pandal selections
- Real-time queue waiting estimates, leg-by-leg transit time, and Google Maps multi-stop export.
"""
from datetime import datetime, timezone
import itertools
from math import asin, cos, radians, sin, sqrt
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.crowd_report import CrowdReport
from app.models.image import Image
from app.models.pandal import Pandal
from app.models.review import Review
from app.routers.pandals import _crowd_estimates, _is_open_now
from app.schemas.pandal import PandalOut

router = APIRouter(prefix="/api/routes", tags=["Routes & Trails"])

# --- Haversine & Distance Helpers ---

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in kilometers."""
    r_lat1, r_lon1, r_lat2, r_lon2 = map(radians, (lat1, lon1, lat2, lon2))
    dlat = r_lat2 - r_lat1
    dlon = r_lon2 - r_lon1
    a = sin(dlat / 2) ** 2 + cos(r_lat1) * cos(r_lat2) * sin(dlon / 2) ** 2
    return 2 * 6371.0 * asin(sqrt(max(0.0, min(1.0, a))))


def estimate_travel_minutes(distance_km: float, mode: str = "walking") -> int:
    """Estimate transit time with urban Kolkata road winding factor."""
    if mode == "driving":
        # Average festival driving speed ~18 km/h due to traffic diversions, with 1.35x road distance factor
        actual_dist = distance_km * 1.35
        minutes = (actual_dist / 18.0) * 60
        return max(2, round(minutes))
    # Walking speed ~4.2 km/h in festival crowds with 1.25x road factor
    actual_dist = distance_km * 1.25
    minutes = (actual_dist / 4.2) * 60
    return max(2, round(minutes))


# --- TSP Optimization Algorithm ---

def solve_tsp(
    points: list[dict],
    start_point: dict | None = None,
    mode: str = "walking",
) -> list[dict]:
    """Solve TSP to find the optimal visiting sequence.

    Uses Exact Permutation for N <= 10, or 2-opt heuristic for larger sets.
    Minimizes total travel distance.
    """
    if len(points) <= 1:
        return points

    n = len(points)

    def dist_between(p1: dict, p2: dict) -> float:
        return haversine_km(p1["latitude"], p1["longitude"], p2["latitude"], p2["longitude"])

    if n <= 9 and start_point is None:
        # Check all permutations of visiting order
        best_order = list(range(n))
        best_dist = float("inf")

        # Fix first stop or try all permutations
        for perm in itertools.permutations(range(n)):
            current_dist = 0.0
            for i in range(len(perm) - 1):
                current_dist += dist_between(points[perm[i]], points[perm[i + 1]])
            if current_dist < best_dist:
                best_dist = current_dist
                best_order = list(perm)

        return [points[i] for i in best_order]

    if start_point is not None:
        # Greedy Nearest Neighbor from start point followed by 2-opt
        unvisited = list(range(n))
        current_loc = start_point
        ordered_indices = []

        while unvisited:
            next_idx = min(
                unvisited,
                key=lambda idx: dist_between(current_loc, points[idx]),
            )
            ordered_indices.append(next_idx)
            current_loc = points[next_idx]
            unvisited.remove(next_idx)
    else:
        # Standard Nearest Neighbor starting from point 0
        unvisited = list(range(1, n))
        ordered_indices = [0]
        while unvisited:
            last = ordered_indices[-1]
            next_idx = min(unvisited, key=lambda idx: dist_between(points[last], points[idx]))
            ordered_indices.append(next_idx)
            unvisited.remove(next_idx)

    # 2-Opt Refinement
    improved = True
    while improved:
        improved = False
        for i in range(0 if start_point is None else 0, len(ordered_indices) - 1):
            for j in range(i + 1, len(ordered_indices)):
                old_d = (
                    (dist_between(points[ordered_indices[i - 1]], points[ordered_indices[i]]) if i > 0 else 0)
                    + (dist_between(points[ordered_indices[j]], points[ordered_indices[j + 1]]) if j < len(ordered_indices) - 1 else 0)
                )
                new_d = (
                    (dist_between(points[ordered_indices[i - 1]], points[ordered_indices[j]]) if i > 0 else 0)
                    + (dist_between(points[ordered_indices[i]], points[ordered_indices[j + 1]]) if j < len(ordered_indices) - 1 else 0)
                )
                if new_d < old_d - 1e-5:
                    ordered_indices[i : j + 1] = reversed(ordered_indices[i : j + 1])
                    improved = True
                    break
            if improved:
                break

    return [points[i] for i in ordered_indices]


# --- Schemas ---

class OptimizeRouteRequest(BaseModel):
    pandal_ids: list[int] = Field(..., min_length=2, max_length=15, description="2 to 15 pandal IDs to hop")
    start_lat: float | None = Field(None, ge=-90, le=90)
    start_lng: float | None = Field(None, ge=-180, le=180)
    start_label: str | None = Field(None, description="e.g. 'My Current Location' or 'Sealdah Metro'")
    mode: Literal["walking", "driving"] = Field("walking", description="Transit mode")
    optimize: bool = Field(True, description="Whether to optimize stop order via TSP algorithm")


class RouteLeg(BaseModel):
    from_index: int
    to_index: int
    distance_km: float
    travel_minutes: int


class RouteStop(BaseModel):
    step_number: int
    pandal: PandalOut
    queue_wait_minutes: int
    recommended_dwell_minutes: int
    leg_from_previous: RouteLeg | None = None
    cumulative_travel_minutes: int
    cumulative_queue_minutes: int
    cumulative_total_minutes: int
    google_maps_nav_url: str


class OptimizedRouteResponse(BaseModel):
    mode: str
    total_stops: int
    total_distance_km: float
    total_travel_minutes: int
    total_queue_minutes: int
    total_dwell_minutes: int
    total_circuit_minutes: int
    bottleneck_warnings: list[str]
    google_maps_multi_stop_url: str
    stops: list[RouteStop]


class CuratedTrail(BaseModel):
    id: str
    title: str
    subtitle: str
    icon: str
    badge: str
    description: str
    theme_focus: str
    best_time: str
    default_mode: str
    pandal_names: list[str]
    pandal_ids: list[int] = []


# --- Curated Trails Data ---

CURATED_TRAILS: list[dict] = [
    {
        "id": "north-heritage",
        "title": "North Kolkata Heritage Trail",
        "subtitle": "Classic century-old traditions & grand aristocratic rajbari reflections",
        "icon": "🏛️",
        "badge": "Heritage & Culture",
        "description": "Experience the soul of Kolkata's traditional Durga Puja. Starts from the historic Bagbazar Sarbojanin, weaves through Kumartuli's artisan quarter, Sovabazar Rajbari's 300-year Thakur Dalan, Ahiritola by the Ganges, and culminates with College Square and Santosh Mitra Square.",
        "theme_focus": "Traditional Dāāk-er Shaaj, Aristocratic Rajbari aesthetics & Lake lighting",
        "best_time": "Late evening to midnight (7:00 PM - 1:00 AM)",
        "default_mode": "walking",
        "pandal_names": [
            "Bagbazar Sarbojanin",
            "Kumartuli Park",
            "Sovabazar Rajbari",
            "Ahiritola Sarbojanin",
            "Mohammad Ali Park",
            "College Square",
            "Santosh Mitra Square",
        ],
    },
    {
        "id": "south-art-spectacular",
        "title": "South Kolkata Mega Art Trail",
        "subtitle": "Award-winning theme installations & architectural wonders",
        "icon": "🎨",
        "badge": "Blockbuster Themes",
        "description": "The ultimate blockbuster tour featuring South Kolkata's top award-winners. Marvel at Suruchi Sangha's folk installations, Chetla Agrani's riverside craft, Deshapriya Park's massive spectacle, Tridhara's terracotta marvel, Ballygunge Cultural, and Ekdalia Evergreen's towering temple replica.",
        "theme_focus": "Contemporary Art, Intricate Sholapith, Bishnupur Terracotta & Temple Replicas",
        "best_time": "Evening or Late Night (8:00 PM - 3:00 AM)",
        "default_mode": "walking",
        "pandal_names": [
            "Suruchi Sangha",
            "Chetla Agrani",
            "Deshapriya Park",
            "Tridhara Sammilani",
            "Ballygunge Cultural Association",
            "Ekdalia Evergreen Club",
            "Singhi Park Sarbojanin",
        ],
    },
    {
        "id": "newtown-saltlake-modern",
        "title": "Newtown & Salt Lake Modern Installations",
        "subtitle": "Futuristic architecture, mega lightworks & smart city installations",
        "icon": "🌟",
        "badge": "Modern & Futuristic",
        "description": "Explore Kolkata's high-tech and modern corridor. Start with the globally famous Sreebhumi VIP Road spectacle (Vatican / Burj Khalifa replicas), moving to Salt Lake's FD Block and BJ Block kinetic pavilions, and culminating at Newtown's sprawling City Square drone & art installation.",
        "theme_focus": "High-tech Lighting, Architectural Replicas, Kinetic Sculptures & Drone Shows",
        "best_time": "Evening to midnight (6:30 PM - 12:30 AM)",
        "default_mode": "driving",
        "pandal_names": [
            "Sreebhumi Sporting Club",
            "FD Block Salt Lake",
            "BJ Block Salt Lake",
            "Newtown Sarbojanin Durgotsav",
        ],
    },
    {
        "id": "midnight-express",
        "title": "Midnight Express (Low Queue Trail)",
        "subtitle": "Beat the crowd — fastest moving late-night route",
        "icon": "🌙",
        "badge": "Low Crowd & Night Owl",
        "description": "Designed for night owls wanting to experience Kolkata's magical midnight vibe with minimal queue waiting. Visits beautifully lit pandals during optimal low-congestion hours.",
        "theme_focus": "Illuminations, Night Photography & Calm Darshan",
        "best_time": "1:00 AM to 5:00 AM",
        "default_mode": "walking",
        "pandal_names": [
            "College Square",
            "Santosh Mitra Square",
            "Kumartuli Park",
            "Bagbazar Sarbojanin",
        ],
    },
    {
        "id": "south-ballygunge-circuit",
        "title": "Ballygunge-Gariahat Triple Crown",
        "subtitle": "3 legendary pandals within a 1.2 km walking radius",
        "icon": "⚡",
        "badge": "Walkable Quick Circuit",
        "description": "Super compact and walkable circuit in South Kolkata. Covers the iconic trio of Ekdalia Evergreen, Singhi Park, and Ballygunge Cultural within minutes of each other.",
        "theme_focus": "Grand Illumination, Classical Idols & Street Food Hub",
        "best_time": "6:00 PM - 11:30 PM",
        "default_mode": "walking",
        "pandal_names": [
            "Ekdalia Evergreen Club",
            "Singhi Park Sarbojanin",
            "Ballygunge Cultural Association",
            "Tridhara Sammilani",
        ],
    },
]


@router.get("/trails", response_model=list[CuratedTrail])
def get_curated_trails(db: Session = Depends(get_db)):
    """Fetch all curated themed trails with matching database IDs."""
    pandals = db.query(Pandal).all()
    pandal_map = {p.name.strip().lower(): p.id for p in pandals}

    result = []
    for trail in CURATED_TRAILS:
        matched_ids = []
        for name in trail["pandal_names"]:
            p_id = pandal_map.get(name.strip().lower())
            if p_id:
                matched_ids.append(p_id)
        trail_copy = dict(trail)
        trail_copy["pandal_ids"] = matched_ids
        result.append(CuratedTrail(**trail_copy))

    return result


@router.post("/optimize", response_model=OptimizedRouteResponse)
def optimize_route(data: OptimizeRouteRequest, db: Session = Depends(get_db)):
    """Calculate the optimal traveling sequence, leg distances, and queue estimations."""
    if len(data.pandal_ids) < 2:
        raise HTTPException(status_code=400, detail="Please select at least 2 pandals to plan a route.")

    # Fetch pandals from DB
    pandals = db.query(Pandal).filter(Pandal.id.in_(data.pandal_ids)).all()
    if len(pandals) != len(data.pandal_ids):
        # some IDs might not exist
        found_ids = {p.id for p in pandals}
        missing = [pid for pid in data.pandal_ids if pid not in found_ids]
        if not pandals:
            raise HTTPException(status_code=404, detail="None of the selected pandals were found.")

    # Filter out pandals without coordinates
    valid_pandals = [p for p in pandals if p.latitude is not None and p.longitude is not None]
    if len(valid_pandals) < 2:
        raise HTTPException(status_code=400, detail="At least 2 pandals must have geographic coordinates.")

    # Fetch fresh crowd estimates & reviews
    pandal_ids = [p.id for p in valid_pandals]
    crowd_map = _crowd_estimates(db, pandal_ids)

    # Fetch ratings & review counts
    rating_rows = (
        db.query(
            Review.pandal_id,
            func.avg(Review.rating).label("avg_rating"),
            func.count(Review.id).label("review_count"),
        )
        .filter(Review.pandal_id.in_(pandal_ids))
        .group_by(Review.pandal_id)
        .all()
    )
    rating_map = {
        row.pandal_id: {
            "avg_rating": round(float(row.avg_rating), 2) if row.avg_rating else None,
            "review_count": int(row.review_count),
        }
        for row in rating_rows
    }

    # Fetch cover photos
    image_rows = (
        db.query(Image)
        .filter(Image.pandal_id.in_(pandal_ids))
        .order_by(Image.id)
        .all()
    )
    cover_map = {}
    for img in image_rows:
        cover_map.setdefault(img.pandal_id, img.image_url)

    # Format PandalOut dicts for optimization
    pandal_nodes = []
    pandal_dict_by_id = {p.id: p for p in valid_pandals}

    # Preserve user's original order if optimize=False
    if not data.optimize:
        ordered_pandals = [pandal_dict_by_id[pid] for pid in data.pandal_ids if pid in pandal_dict_by_id]
    else:
        ordered_pandals = valid_pandals

    for p in ordered_pandals:
        c_info = crowd_map.get(p.id, {})
        r_info = rating_map.get(p.id, {})
        queue_wait = c_info.get("waiting_time_minutes")
        if queue_wait is None:
            # Default queue estimate based on crowd level
            c_lvl = c_info.get("crowd_level")
            if c_lvl == "HIGH" or (c_lvl and hasattr(c_lvl, "value") and c_lvl.value == "HIGH"):
                queue_wait = 45
            elif c_lvl == "MODERATE" or (c_lvl and hasattr(c_lvl, "value") and c_lvl.value == "MODERATE"):
                queue_wait = 20
            else:
                queue_wait = 10

        p_out = PandalOut(
            id=p.id,
            name=p.name,
            address=p.address,
            locality=p.locality,
            latitude=p.latitude,
            longitude=p.longitude,
            theme=p.theme,
            description=p.description,
            opening_time=p.opening_time,
            closing_time=p.closing_time,
            created_at=p.created_at,
            avg_rating=r_info.get("avg_rating"),
            review_count=r_info.get("review_count", 0),
            crowd_level=c_info.get("crowd_level"),
            waiting_time_minutes=queue_wait,
            crowd_updated_at=c_info.get("crowd_updated_at"),
            open_now=_is_open_now(p.opening_time, p.closing_time),
            cover_image=cover_map.get(p.id),
        )
        pandal_nodes.append({
            "id": p.id,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "pandal_out": p_out,
            "queue_wait": queue_wait,
        })

    # Start location if provided
    start_point = None
    if data.start_lat is not None and data.start_lng is not None:
        start_point = {"latitude": data.start_lat, "longitude": data.start_lng}

    # Run TSP optimization if requested
    if data.optimize:
        ordered_nodes = solve_tsp(pandal_nodes, start_point=start_point, mode=data.mode)
    else:
        ordered_nodes = pandal_nodes

    # Compute legs, cumulative time, and individual navigation URLs
    stops: list[RouteStop] = []
    total_dist = 0.0
    total_travel_mins = 0
    total_queue_mins = 0
    total_dwell_mins = 0
    bottleneck_warnings: list[str] = []

    # Viewing time at each pandal
    dwell_per_pandal = 15  # minutes to view idol & artwork

    for idx, node in enumerate(ordered_nodes):
        leg = None
        leg_dist = 0.0
        leg_mins = 0

        if idx > 0:
            prev_node = ordered_nodes[idx - 1]
            leg_dist = round(haversine_km(prev_node["latitude"], prev_node["longitude"], node["latitude"], node["longitude"]), 2)
            leg_mins = estimate_travel_minutes(leg_dist, mode=data.mode)
            total_dist += leg_dist
            total_travel_mins += leg_mins
            leg = RouteLeg(
                from_index=idx - 1,
                to_index=idx,
                distance_km=leg_dist,
                travel_minutes=leg_mins,
            )
        elif start_point is not None:
            # First leg from user's starting point
            leg_dist = round(haversine_km(start_point["latitude"], start_point["longitude"], node["latitude"], node["longitude"]), 2)
            leg_mins = estimate_travel_minutes(leg_dist, mode=data.mode)
            total_dist += leg_dist
            total_travel_mins += leg_mins
            leg = RouteLeg(
                from_index=-1,
                to_index=0,
                distance_km=leg_dist,
                travel_minutes=leg_mins,
            )

        queue_mins = node["queue_wait"]
        total_queue_mins += queue_mins
        total_dwell_mins += dwell_per_pandal

        # Check for bottlenecks
        p_out: PandalOut = node["pandal_out"]
        if queue_mins >= 40:
            bottleneck_warnings.append(
                f"🔥 High queue at {p_out.name} (~{queue_mins}m wait). Consider visiting late night or mid-afternoon."
            )

        # Single stop Google Maps Nav
        nav_mode = "walking" if data.mode == "walking" else "driving"
        nav_url = (
            f"https://www.google.com/maps/dir/?api=1"
            f"&destination={p_out.latitude},{p_out.longitude}"
            f"&travelmode={nav_mode}"
        )

        stops.append(
            RouteStop(
                step_number=idx + 1,
                pandal=p_out,
                queue_wait_minutes=queue_mins,
                recommended_dwell_minutes=dwell_per_pandal,
                leg_from_previous=leg,
                cumulative_travel_minutes=total_travel_mins,
                cumulative_queue_minutes=total_queue_mins,
                cumulative_total_minutes=total_travel_mins + total_queue_mins + total_dwell_mins,
                google_maps_nav_url=nav_url,
            )
        )

    # Multi-stop Google Maps URL
    # Google Maps URL format: https://www.google.com/maps/dir/lat1,lng1/lat2,lng2/...
    coords_path = "/".join(f"{s.pandal.latitude},{s.pandal.longitude}" for s in stops)
    if start_point:
        coords_path = f"{start_point['latitude']},{start_point['longitude']}/" + coords_path
    gmaps_multi_url = f"https://www.google.com/maps/dir/{coords_path}"

    total_circuit = total_travel_mins + total_queue_mins + total_dwell_mins

    return OptimizedRouteResponse(
        mode=data.mode,
        total_stops=len(stops),
        total_distance_km=round(total_dist, 2),
        total_travel_minutes=total_travel_mins,
        total_queue_minutes=total_queue_mins,
        total_dwell_minutes=total_dwell_mins,
        total_circuit_minutes=total_circuit,
        bottleneck_warnings=bottleneck_warnings,
        google_maps_multi_stop_url=gmaps_multi_url,
        stops=stops,
    )
