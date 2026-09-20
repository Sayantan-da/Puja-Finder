"""Bulk Pandal Importer for PujaFinder Kolkata.

Usage:
  # Import from JSON file
  python scripts/import_pandals.py --file backend/data/kolkata_100_pandals.json

  # Import from CSV file
  python scripts/import_pandals.py --file pandals.csv

  # Export current DB pandals to CSV template
  python scripts/import_pandals.py --export template_pandals.csv
"""

import argparse
import csv
import json
import os
import sys
from pathlib import Path

# Add backend to sys.path so we can import app modules
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.database import SessionLocal, init_db
from app.models.pandal import Pandal
from app.models.crowd_report import CrowdReport, CrowdLevel
from app.models.review import Review
from app.models.user import User


def import_pandals_from_file(file_path: str):
    path = Path(file_path)
    if not path.exists():
        print(f"[ERROR] File not found: {file_path}")
        sys.exit(1)

    init_db()
    db = SessionLocal()
    demo_user = db.query(User).filter(User.email == "demo@pujafinder.in").first()

    existing_names = {p.name.strip().lower() for p in db.query(Pandal.name).all()}
    print(f"[INFO] Current database contains {len(existing_names)} pandals.")

    records = []
    if path.suffix.lower() == ".json":
        with open(path, "r", encoding="utf-8") as f:
            records = json.load(f)
    elif path.suffix.lower() == ".csv":
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                records.append({
                    "name": row.get("name", "").strip(),
                    "locality": row.get("locality", "").strip() or None,
                    "address": row.get("address", "").strip() or f"{row.get('name', '')}, Kolkata",
                    "latitude": float(row["latitude"]) if row.get("latitude") else None,
                    "longitude": float(row["longitude"]) if row.get("longitude") else None,
                    "theme": row.get("theme", "").strip() or None,
                    "description": row.get("description", "").strip() or None,
                    "opening_time": row.get("opening_time", "04:00").strip() or "04:00",
                    "closing_time": row.get("closing_time", "23:30").strip() or "23:30",
                })
    else:
        print("[ERROR] Unsupported file format. Please provide .json or .csv")
        sys.exit(1)

    added_count = 0
    updated_count = 0

    for item in records:
        name = item.get("name", "").strip()
        if not name:
            continue

        existing = db.query(Pandal).filter(Pandal.name == name).first()
        if existing:
            # Update fields
            if item.get("locality"):
                existing.locality = item["locality"]
            if item.get("address"):
                existing.address = item["address"]
            if item.get("latitude") is not None:
                existing.latitude = item["latitude"]
            if item.get("longitude") is not None:
                existing.longitude = item["longitude"]
            if item.get("theme"):
                existing.theme = item["theme"]
            if item.get("description"):
                existing.description = item["description"]
            if item.get("opening_time"):
                existing.opening_time = item["opening_time"]
            if item.get("closing_time"):
                existing.closing_time = item["closing_time"]
            updated_count += 1
        else:
            pandal = Pandal(
                name=name,
                locality=item.get("locality"),
                address=item.get("address", f"{name}, Kolkata"),
                latitude=item.get("latitude"),
                longitude=item.get("longitude"),
                theme=item.get("theme"),
                description=item.get("description"),
                opening_time=item.get("opening_time", "04:00"),
                closing_time=item.get("closing_time", "23:30"),
            )
            db.add(pandal)
            db.flush()

            # Seed demo crowd report & review if available
            if demo_user:
                db.add(CrowdReport(
                    user_id=demo_user.id,
                    pandal_id=pandal.id,
                    crowd_level=CrowdLevel.MODERATE,
                    waiting_time_minutes=20,
                    comment="Moving steadily",
                ))
                db.add(Review(
                    user_id=demo_user.id,
                    pandal_id=pandal.id,
                    rating=5,
                    comment=f"Must visit! Beautiful {pandal.theme or 'Durga idol'} craftsmanship.",
                ))
            added_count += 1

    db.commit()
    total_after = db.query(Pandal).count()
    db.close()

    print(f"\n[SUCCESS] Import Completed Successfully!")
    print(f"  Added new pandals: {added_count}")
    print(f"  Updated existing pandals: {updated_count}")
    print(f"  Total pandals in database now: {total_after}")



def export_template(export_path: str):
    init_db()
    db = SessionLocal()
    pandals = db.query(Pandal).order_by(Pandal.id).all()
    db.close()

    path = Path(export_path)
    if path.suffix.lower() == ".json":
        data = [
            {
                "name": p.name,
                "locality": p.locality,
                "address": p.address,
                "latitude": p.latitude,
                "longitude": p.longitude,
                "theme": p.theme,
                "description": p.description,
                "opening_time": p.opening_time,
                "closing_time": p.closing_time,
            }
            for p in pandals
        ]
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    else:
        fieldnames = ["name", "locality", "address", "latitude", "longitude", "theme", "description", "opening_time", "closing_time"]
        with open(path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for p in pandals:
                writer.writerow({
                    "name": p.name,
                    "locality": p.locality or "",
                    "address": p.address or "",
                    "latitude": p.latitude or "",
                    "longitude": p.longitude or "",
                    "theme": p.theme or "",
                    "description": p.description or "",
                    "opening_time": p.opening_time or "04:00",
                    "closing_time": p.closing_time or "23:30",
                })

    print(f"[SUCCESS] Exported {len(pandals)} pandals to {export_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bulk Import/Export Kolkata Pandals")
    parser.add_argument("--file", help="Path to JSON or CSV file to import")
    parser.add_argument("--export", help="Export DB pandals to specified file (CSV/JSON)")
    args = parser.parse_args()

    if args.file:
        import_pandals_from_file(args.file)
    elif args.export:
        export_template(args.export)
    else:
        parser.print_help()
