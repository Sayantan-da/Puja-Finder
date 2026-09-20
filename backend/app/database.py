from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

RAW_URL = settings.database_url
IS_SQLITE = RAW_URL.startswith("sqlite")

# Allow postgresql:// shorthand (convert to the psycopg2 driver form)
DATABASE_URL = RAW_URL
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

Base = declarative_base()

if IS_SQLITE:
    # Development convenience only. Production must run PostgreSQL.
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 30},
    )

    @event.listens_for(engine, "connect")
    def _sqlite_resilience(dbapi_conn, _record):
        """WAL + busy_timeout soften SQLite's single-writer limit in dev."""
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA busy_timeout=30000")
        cur.close()
else:
    # Production: managed PostgreSQL with a real connection pool.
    # pool_pre_ping drops connections killed by the provider (Neon idles them);
    # pool_recycle refreshes connections before firewalls age them out.
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=1800,
        pool_timeout=30,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        connect_args={"connect_timeout": 10},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _ensure_sqlite_crowd_report_columns():
    """SQLite dev DB compatibility: older local DB files can miss optional crowd metadata columns.

    This keeps the app booting when a developer already created the sqlite DB before the
    crowd metadata fields were added.
    """
    if not IS_SQLITE:
        return

    try:
        with engine.begin() as conn:
            cols = conn.exec_driver_sql("PRAGMA table_info(crowd_reports)").fetchall()
            present = {row[1] for row in cols}
            if "approach_traffic" not in present:
                conn.exec_driver_sql("ALTER TABLE crowd_reports ADD COLUMN approach_traffic VARCHAR(30)")
            if "barricade_distance" not in present:
                conn.exec_driver_sql("ALTER TABLE crowd_reports ADD COLUMN barricade_distance VARCHAR(30)")
            if "comfort_tags" not in present:
                conn.exec_driver_sql("ALTER TABLE crowd_reports ADD COLUMN comfort_tags VARCHAR(255)")
    except Exception:
        # Table may not exist yet during a brand-new local boot; create_all above will create it.
        pass


def _ensure_sqlite_user_security_columns():
    """SQLite dev DB compatibility: add missing user security and MFA columns."""
    if not IS_SQLITE:
        return

    try:
        with engine.begin() as conn:
            cols = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
            present = {row[1] for row in cols}
            if "is_active" not in present:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1")
            if "is_mfa_enabled" not in present:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN is_mfa_enabled BOOLEAN NOT NULL DEFAULT 0")
            if "mfa_secret" not in present:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(64)")
            if "failed_login_attempts" not in present:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0")
            if "locked_until" not in present:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN locked_until DATETIME")
            if "phone" not in present:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN phone VARCHAR(30)")
            if "firebase_uid" not in present:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(128)")
    except Exception:
        pass


def _ensure_sqlite_pandal_columns():
    """SQLite dev DB compatibility: add missing pandal verification and quality columns."""
    if not IS_SQLITE:
        return

    try:
        with engine.begin() as conn:
            cols = conn.exec_driver_sql("PRAGMA table_info(pandals)").fetchall()
            present = {row[1] for row in cols}
            if "dates" not in present:
                conn.exec_driver_sql("ALTER TABLE pandals ADD COLUMN dates VARCHAR(100)")
            if "accessibility_tags" not in present:
                conn.exec_driver_sql("ALTER TABLE pandals ADD COLUMN accessibility_tags VARCHAR(250)")
            if "official_links" not in present:
                conn.exec_driver_sql("ALTER TABLE pandals ADD COLUMN official_links VARCHAR(500)")
            if "parking_info" not in present:
                conn.exec_driver_sql("ALTER TABLE pandals ADD COLUMN parking_info VARCHAR(300)")
            if "metro_info" not in present:
                conn.exec_driver_sql("ALTER TABLE pandals ADD COLUMN metro_info VARCHAR(300)")
            if "route_tips" not in present:
                conn.exec_driver_sql("ALTER TABLE pandals ADD COLUMN route_tips VARCHAR(500)")
            if "is_verified_by_admin" not in present:
                conn.exec_driver_sql("ALTER TABLE pandals ADD COLUMN is_verified_by_admin BOOLEAN NOT NULL DEFAULT 0")
            if "is_published" not in present:
                conn.exec_driver_sql("ALTER TABLE pandals ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT 1")
            if "is_active" not in present:
                conn.exec_driver_sql("ALTER TABLE pandals ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1")
            if "deleted_at" not in present:
                conn.exec_driver_sql("ALTER TABLE pandals ADD COLUMN deleted_at DATETIME")
            if "updated_at" not in present:
                conn.exec_driver_sql("ALTER TABLE pandals ADD COLUMN updated_at DATETIME")

            # Review moderation column
            r_cols = conn.exec_driver_sql("PRAGMA table_info(reviews)").fetchall()
            r_present = {row[1] for row in r_cols}
            if "is_approved" not in r_present:
                conn.exec_driver_sql("ALTER TABLE reviews ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT 1")

            # Moment moderation column
            m_cols = conn.exec_driver_sql("PRAGMA table_info(moments)").fetchall()
            m_present = {row[1] for row in m_cols}
            if "is_approved" not in m_present:
                conn.exec_driver_sql("ALTER TABLE moments ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT 1")
    except Exception:
        pass


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables from models.

    Dev convenience (SQLite). In production, schema changes go through
    Alembic (`alembic upgrade head` — wired into the Docker CMD). create_all
    is check-first, so it is a harmless no-op once migrations have run.
    """
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_crowd_report_columns()
    _ensure_sqlite_user_security_columns()
    _ensure_sqlite_pandal_columns()

