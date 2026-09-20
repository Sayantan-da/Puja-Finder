from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.cache import StaticCacheHeaderMiddleware, TTLCacheMiddleware
from app.config import settings
from app.database import SessionLocal, init_db
from app.rate_limit import RateLimitMiddleware
from app.routers import admin, auth, content, crowd, events, favorites, groups, images, moments, pandals, reviews, routes, ws
from app.seed import bootstrap_admin, seed_extras, seed_if_empty

if settings.sentry_dsn:
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    from app.realtime import manager
    from app.redis_client import close_redis_client

    # Create tables and seed demo data on first start
    init_db()
    db = SessionLocal()
    try:
        seed_if_empty(db)
        seed_extras(db)
        bootstrap_admin(db)
    finally:
        db.close()

    # Multi-server Redis Pub/Sub listener (active if REDIS_URL is configured)
    redis_listener_task = None
    if settings.redis_url:
        redis_listener_task = asyncio.create_task(manager.start_redis_listener())

    # Optional demo crowd simulator (CROWD_SIMULATOR=on)
    sim_task = None
    if settings.crowd_simulator.lower() in ("on", "1", "true"):
        from app.services.crowd_simulator import run_crowd_simulator

        sim_task = asyncio.create_task(run_crowd_simulator())

    yield

    if sim_task:
        sim_task.cancel()
    if redis_listener_task:
        redis_listener_task.cancel()
    await close_redis_client()


app = FastAPI(
    title="PujaFinder API",
    description="Durga Puja Pandal Finder for Kolkata — find pandals, check live crowd levels, browse photos, read & write reviews, and manage events.",
    version="1.1.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Production hardening: rate limiting + caching ---
app.add_middleware(RateLimitMiddleware)

# TTL cache for hot anonymous GETs (write endpoints invalidate via ttl_cache)
app.add_middleware(
    TTLCacheMiddleware,
    rules=[
        ("/api/pandals", 45),   # pandal list / nearby (WebSocket covers live updates)
        ("/api/content", 300),  # About page rarely changes
        ("/api/routes/trails", 300),  # Curated trails
    ],
)
# Browser caching for photos & built assets
app.add_middleware(StaticCacheHeaderMiddleware)

# Serve uploaded photos (uploads/pandal_images + bundled uploads/seed)
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.include_router(auth.router)
app.include_router(pandals.router)
app.include_router(reviews.router)
app.include_router(crowd.router)
app.include_router(favorites.router)
app.include_router(events.router)
app.include_router(images.router)
app.include_router(moments.router)
app.include_router(content.router)
app.include_router(routes.router)
app.include_router(groups.router)
app.include_router(admin.router)
app.include_router(ws.router)


# ---- Production single-service mode ----
# If the built React app exists, serve it from this same origin.
_static_dir = Path(settings.static_dir).resolve()
_HAS_FRONTEND = (_static_dir / "index.html").is_file()


@app.get("/", tags=["Health"])
def root():
    if _HAS_FRONTEND:
        # Single-service deployment: the root IS the app
        return FileResponse(_static_dir / "index.html")
    return {"message": "Welcome to PujaFinder API", "status": "running"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}


# ---- SPA fallback (registered LAST so /api, /ws, /uploads, /docs match first) ----
if _HAS_FRONTEND:

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        # API-ish paths that didn't match a router should stay 404 JSON
        if full_path.startswith(("api/", "uploads/", "ws/", "docs", "redoc", "openapi.json")):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = (_static_dir / full_path).resolve()
        if (
            full_path
            and str(candidate).startswith(str(_static_dir))
            and candidate.is_file()
        ):
            return FileResponse(candidate)
        # SPA fallback: client-side routes (/pandals/5, /map, /admin…) → index.html
        return FileResponse(_static_dir / "index.html")
