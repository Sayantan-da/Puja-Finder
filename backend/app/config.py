from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings, loaded from environment / .env file."""

    # Development default: SQLite (zero setup). For production use PostgreSQL:
    #   postgresql://user:password@host:5432/pujafinder
    # (Neon/Supabase/RDS connection strings all work as-is.)
    database_url: str = "sqlite:///./pujafinder.db"

    # PostgreSQL connection pool sizing (ignored for SQLite).
    # 1k concurrent users ≈ 10–30 pooled connections is plenty for one worker.
    db_pool_size: int = 10
    db_max_overflow: int = 20

    secret_key: str = "dev-secret-change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # DEMO-ONLY: set CROWD_SIMULATOR=on to post synthetic crowd reports
    # every few seconds and broadcast them live (see services/crowd_simulator.py)
    crowd_simulator: str = "off"

    # "development" (default) or "production".
    # In production the demo seed data (demo users, sample reviews/photos) is
    # NOT created — see app/seed.py.
    environment: str = "development"

    # Production admin bootstrap: with ENVIRONMENT=production no demo users are
    # created. Set these two on first deploy and an ADMIN account is created at
    # startup (remove the password var afterwards if you like).
    admin_email: str = ""
    admin_password: str = ""

    # Optional error tracking (Sentry). Empty = disabled.
    # Create a project at https://sentry.io → copy the DSN → enable email alerts.
    sentry_dsn: str = ""

    # Production single-service mode: directory containing the built React app
    # (frontend/dist). If it exists, FastAPI serves it — one URL for everything.
    static_dir: str = "../frontend/dist"

    # Cloudflare Turnstile Bot Protection
    turnstile_secret_key: str = ""
    turnstile_enabled: bool = False

    # Multi-Factor Authentication (TOTP)
    mfa_token_expire_minutes: int = 5
    mfa_issuer_name: str = "PujaFinder"

    # Auth Rate Limiting (Brute-force protection)
    auth_rate_limit_max_attempts: int = 5
    auth_rate_limit_window_seconds: int = 900  # 15 minutes lockout window

    # Firebase Authentication
    firebase_credentials_path: str = ""
    firebase_project_id: str = ""

    # Redis (Upstash / Render / Railway / local Redis)
    # If empty, the app seamlessly uses robust in-memory caching, rate limiting & PubSub.
    redis_url: str = ""

    # Anti-spam cooldown: minutes between successive crowd reports by the same user for the same pandal
    crowd_report_cooldown_minutes: int = 10

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
