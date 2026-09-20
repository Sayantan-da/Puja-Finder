"""Demo crowd simulator.

When CROWD_SIMULATOR=on is set in the environment, a background task posts
a synthetic crowd report every few seconds and broadcasts it live — so you
can watch the real-time updates on the web page without opening two browsers.

This is DEMO-ONLY tooling; leave it off in production.
"""
import asyncio
import random
from datetime import datetime, timezone

from app.database import SessionLocal
from app.models.crowd_report import CrowdLevel, CrowdReport
from app.models.pandal import Pandal
from app.models.user import User
from app.routers.pandals import _crowd_estimates
from app.realtime import manager

COMMENTS = [
    "Queue is moving fast now!",
    "Just entered, barely any wait",
    "Getting busier near the entrance",
    "Huge line outside the gate",
    "Perfect time for photos",
    "Bhog queue is long but pandal is fine",
    "Crowd swelling after evening aarti",
    None, None,  # some reports have no comment
]


async def run_crowd_simulator() -> None:
    while True:
        try:
            await asyncio.sleep(random.uniform(3, 7))  # demo pace: a report every few seconds
            db = SessionLocal()
            try:
                pandals = db.query(Pandal).all()
                demo_user = db.query(User).filter(User.email == "demo@pujafinder.in").first()
                if not pandals or demo_user is None:
                    continue

                pandal = random.choice(pandals)
                level = random.choices(list(CrowdLevel), weights=[0.3, 0.4, 0.3])[0]
                report = CrowdReport(
                    user_id=demo_user.id,
                    pandal_id=pandal.id,
                    crowd_level=level,
                    waiting_time_minutes=random.choice([5, 10, 15, 20, 30, 45]),
                    comment=random.choice(COMMENTS),
                )
                db.add(report)
                db.commit()

                estimate = _crowd_estimates(db, [pandal.id]).get(pandal.id, {})
                est_level = estimate.get("crowd_level")
                est_updated = estimate.get("crowd_updated_at")
                if est_updated is not None and est_updated.tzinfo is None:
                    from datetime import timezone as _tz

                    est_updated = est_updated.replace(tzinfo=_tz.utc)
                await manager.broadcast_crowd_update(
                    pandal.id,
                    {
                        "type": "crowd_update",
                        "pandal_id": pandal.id,
                        "crowd_level": est_level.value if est_level else level.value,
                        "waiting_time_minutes": estimate.get("waiting_time_minutes"),
                        "crowd_updated_at": est_updated.isoformat() if est_updated else None,
                        "reported": level.value,
                        "comment": report.comment,
                        "pandal_name": pandal.name,
                        "simulated": True,
                        "ts": datetime.now(timezone.utc).isoformat(),
                    },
                )
                print(f"[simulator] {pandal.name}: reported {level.value}")
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:  # keep the simulator alive on errors
            print(f"[simulator] error: {e}")
