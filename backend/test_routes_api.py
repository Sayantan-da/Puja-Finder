"""Test routes and trails backend API."""
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, init_db
from app.seed import seed_if_empty, sync_pandals_seed

init_db()
db = SessionLocal()
seed_if_empty(db)
sync_pandals_seed(db)
db.close()

client = TestClient(app)

def test_trails():
    resp = client.get("/api/routes/trails")
    assert resp.status_code == 200, f"Error: {resp.text}"
    trails = resp.json()
    print(f"Fetched {len(trails)} curated trails:")
    for t in trails:
        print(f"  - [{t['id']}] {t['title']} ({len(t['pandal_ids'])} matched IDs: {t['pandal_ids']})")
    assert len(trails) >= 3
    # Check specific trails
    ids = {t["id"] for t in trails}
    assert "north-heritage" in ids
    assert "south-art-spectacular" in ids
    assert "newtown-saltlake-modern" in ids
    print("Trails verification PASSED!")

def test_optimize():
    # Test with North Kolkata pandal IDs
    resp = client.get("/api/routes/trails")
    trails = resp.json()
    north_trail = next(t for t in trails if t["id"] == "north-heritage")
    pandal_ids = north_trail["pandal_ids"]
    assert len(pandal_ids) >= 2

    payload = {
        "pandal_ids": pandal_ids,
        "mode": "walking",
        "optimize": True,
    }
    opt_resp = client.post("/api/routes/optimize", json=payload)
    assert opt_resp.status_code == 200, f"Error: {opt_resp.text}"
    result = opt_resp.json()
    print("\nOptimized Route Result:")
    print(f"  Total stops: {result['total_stops']}")
    print(f"  Total distance: {result['total_distance_km']} km")
    print(f"  Total travel mins: {result['total_travel_minutes']} m")
    print(f"  Total queue mins: {result['total_queue_minutes']} m")
    print(f"  Total circuit mins: {result['total_circuit_minutes']} m")
    print(f"  Google Maps URL: {result['google_maps_multi_stop_url']}")
    print("  Stops sequence:")
    for s in result["stops"]:
        print(f"    #{s['step_number']} {s['pandal']['name']} - Queue ~{s['queue_wait_minutes']}m (Dwell {s['recommended_dwell_minutes']}m)")

    # Check with start location
    gps_payload = {
        "pandal_ids": pandal_ids[:4],
        "start_lat": 22.5675,
        "start_lng": 88.3712,
        "start_label": "Sealdah Station",
        "mode": "driving",
        "optimize": True,
    }
    gps_resp = client.post("/api/routes/optimize", json=gps_payload)
    assert gps_resp.status_code == 200
    gps_result = gps_resp.json()
    print(f"\nGPS Start Test: First leg travel mins: {gps_result['stops'][0]['leg_from_previous']['travel_minutes']}")
    print("Optimization verification PASSED!")

def test_pandal_crowd_metadata_contract():
    resp = client.get("/api/pandals/1")
    assert resp.status_code == 200, f"Error: {resp.text}"
    data = resp.json()
    assert "confidence" in data
    assert "fresh_count" in data
    assert "is_stale" in data

if __name__ == "__main__":
    test_trails()
    test_optimize()
    print("\nALL BACKEND ROUTE TESTS PASSED SUCCESSFULLY!")
