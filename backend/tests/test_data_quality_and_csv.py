import io
import os
import unittest
from datetime import datetime, timezone

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["ENVIRONMENT"] = "development"
os.environ["CROWD_SIMULATOR"] = "off"

from app.database import Base, SessionLocal, engine
from app.models.pandal import Pandal
from app.models.report import Report, ReportStatus
from app.models.user import Role, User
from app.services.crowd_estimation_service import estimate_crowd


class TestDataQualityAndVerification(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)

    def setUp(self):
        self.db = SessionLocal()
        self.db.query(Report).delete()
        self.db.query(Pandal).delete()
        self.db.query(User).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_distinct_user_confidence_thresholds(self):
        # Case 1: 5 reports all from ONE user -> must be PRELIMINARY (low confidence)
        single_user_reports = [
            {"crowd_level": "HIGH", "waiting_time_minutes": 30, "age_minutes": 2.0, "user_id": 101},
            {"crowd_level": "HIGH", "waiting_time_minutes": 35, "age_minutes": 5.0, "user_id": 101},
            {"crowd_level": "HIGH", "waiting_time_minutes": 30, "age_minutes": 8.0, "user_id": 101},
        ]
        level, wait, conf, is_stale, distinct_cnt, conf_label = estimate_crowd(single_user_reports)
        self.assertEqual(distinct_cnt, 1)
        self.assertEqual(conf_label, "PRELIMINARY")
        self.assertLessEqual(conf, 35)

        # Case 2: 2 distinct users -> MODERATE confidence
        two_user_reports = [
            {"crowd_level": "MODERATE", "waiting_time_minutes": 20, "age_minutes": 2.0, "user_id": 101},
            {"crowd_level": "MODERATE", "waiting_time_minutes": 25, "age_minutes": 4.0, "user_id": 102},
        ]
        level, wait, conf, is_stale, distinct_cnt, conf_label = estimate_crowd(two_user_reports)
        self.assertEqual(distinct_cnt, 2)
        self.assertEqual(conf_label, "MODERATE")
        self.assertLessEqual(conf, 60)

        # Case 3: 3+ distinct users -> HIGH confidence
        multi_user_reports = [
            {"crowd_level": "HIGH", "waiting_time_minutes": 40, "age_minutes": 1.0, "user_id": 101},
            {"crowd_level": "HIGH", "waiting_time_minutes": 45, "age_minutes": 2.0, "user_id": 102},
            {"crowd_level": "HIGH", "waiting_time_minutes": 35, "age_minutes": 3.0, "user_id": 103},
            {"crowd_level": "HIGH", "waiting_time_minutes": 50, "age_minutes": 4.0, "user_id": 104},
        ]
        level, wait, conf, is_stale, distinct_cnt, conf_label = estimate_crowd(multi_user_reports)
        self.assertGreaterEqual(distinct_cnt, 3)
        self.assertEqual(conf_label, "HIGH")
        self.assertGreaterEqual(conf, 60)

    def test_pandal_fields_and_flagging(self):
        pandal = Pandal(
            name="Test Pandal",
            address="Kolkata North",
            locality="Shyambazar",
            latitude=22.60,
            longitude=88.37,
            dates="Oct 18 - Oct 24, 2026",
            accessibility_tags="wheelchair,elderly_seating",
            is_verified_by_admin=True,
        )
        self.db.add(pandal)
        self.db.commit()
        self.db.refresh(pandal)

        self.assertTrue(pandal.is_verified_by_admin)
        self.assertEqual(pandal.dates, "Oct 18 - Oct 24, 2026")
        self.assertIn("wheelchair", pandal.accessibility_tags)

        # Create flag report
        report = Report(
            pandal_id=pandal.id,
            reason="INACCURACY: WRONG_HOURS",
            description="Opens at 4 PM instead of 2 PM",
            status=ReportStatus.PENDING,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        self.db.add(report)
        self.db.commit()

        queried = self.db.query(Report).filter(Report.pandal_id == pandal.id).first()
        self.assertIsNotNone(queried)
        self.assertEqual(queried.reason, "INACCURACY: WRONG_HOURS")
        self.assertEqual(queried.status, ReportStatus.PENDING)


if __name__ == "__main__":
    unittest.main()
