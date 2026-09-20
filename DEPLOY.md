# 🚀 Deploying PujaFinder to a live URL

The whole app deploys as **ONE service**: FastAPI serves both the API and the
built React frontend from the same origin. No CORS setup, no separate static
hosting, one URL to share.

```
                       ┌─────────────────────────────┐
  visitor ──────────►  │  uvicorn (FastAPI)          │
  one single URL       │  /            → React app   │
                       │  /api/…       → JSON API    │
                       │  /ws/crowd/…  → WebSocket   │
                       │  /uploads/…   → photos      │
                       └─────────────────────────────┘
```

---

## Option A — Render.com, free (recommended, ~10 minutes)

Free tier notes: the app **sleeps after ~15 min idle** (first visit takes
~50 s to wake) and has an **ephemeral disk** — the SQLite DB re-seeds on every
redeploy. Fine for a demo; upgrade later (see "Real database" below).

### 1. Push the project to GitHub

```bash
cd pujafinder
git init
git add .
git commit -m "PujaFinder — Durga Puja Pandal Finder"
# create an empty repo named pujafinder on github.com first, then:
git remote add origin https://github.com/<your-username>/pujafinder.git
git branch -M main
git push -u origin main
```

### 2. Deploy on Render

1. Go to https://dashboard.render.com → sign in with GitHub
2. **New → Blueprint** → select your `pujafinder` repo → **Apply**
   (Render reads `render.yaml` and builds the Dockerfile)
3. Render will prompt for the `sync: false` values — fill them in:
   - **DATABASE_URL** → your Neon *pooled* connection string
   - **ADMIN_EMAIL** / **ADMIN_PASSWORD** → your login; an ADMIN account is
     auto-created on first boot (demo users are NOT created in production)
4. Wait ~5 minutes for build & deploy
5. Your live URL appears: `https://pujafinder-xxxx.onrender.com` 🎉
6. Verify: login with your ADMIN_EMAIL works; `admin@pujafinder.in / Admin@123`
   does **not**

- App: `https://pujafinder-xxxx.onrender.com`
- Swagger: `https://pujafinder-xxxx.onrender.com/docs`
- Health check: `/health`

### Manual alternative (no Blueprint)

**New → Web Service** → pick repo →
Runtime: **Docker** · Instance: **Free** · add env var `CROWD_SIMULATOR=off` → **Create**.

---

## Option B — Railway.app

1. https://railway.app → **New Project → Deploy from GitHub repo**
2. Railway auto-detects the Dockerfile → deploys
3. In **Settings → Networking → Generate Domain** → public URL
4. Add env var `CROWD_SIMULATOR=off`

(Trial credit covers a demo; smallest paid plan keeps it always-on.)

## Option C — Any Docker host (Fly.io, Koyeb, VPS, your own server)

```bash
cd pujafinder
docker build -t pujafinder .
docker run -p 8000:8000 -e SECRET_KEY=some-long-random-string pujafinder
# → http://localhost:8000
```

## Option D — Run on your own device without Docker

Same as before — see README section 2 & 3. The dev servers (ports 8000 + 5173)
are for development; for a production-like single URL locally:

```bash
cd frontend && npm run build       # build once
cd ../backend && python -m uvicorn app.main:app --port 8000
# → http://localhost:8000 now serves the app AND the API
```

---

## Real database — managed PostgreSQL (REQUIRED for production)

The app runs on PostgreSQL with connection pooling and Alembic migrations.

1. Create a free Postgres at https://neon.tech (or Supabase) → copy the
   **pooled** connection string (Neon: port 6543 / `?pgbouncer=true`)
2. On Render: **Environment → Add**: `DATABASE_URL = postgresql://…`
   (the Blueprint's `sync: false` entry prompts you for this)
3. Redeploy → the container runs `alembic upgrade head` on boot, then seeds
   demo data if the DB is empty
4. If you later change models: commit + push — Render's build runs the new
   migration automatically (or run `alembic revision --autogenerate` locally
   first and commit the generated file)

Pooling is pre-tuned via `DB_POOL_SIZE` (10) and `DB_MAX_OVERFLOW` (20) —
plenty for ~1k concurrent users on one worker. Neon-specific: use the
**pooled** URL for the app and the **direct** URL (port 5432) only if you run
migrations manually.

## Automated backups

- **Neon/Supabase** do daily backups + point-in-time recovery on their dashboards — nothing to configure.
- **GitHub Actions** (works with any provider): add your `DATABASE_URL` as a repo
  secret — `.github/workflows/backup.yml` runs a nightly `pg_dump` and keeps 30 days of artifacts.
- **Self-hosted / VPS**: `scripts/backup_db.sh` + cron (7-day rotation), or
  `docker compose run --rm backup` with the bundled compose service.
- **Test a restore once** before launch: `pg_restore --clean --if-exists --dbname "$DATABASE_URL" backup.dump`

## Checklist before you share the link publicly

- [ ] `SECRET_KEY` is set to a generated random value (Blueprint does this)
- [ ] `CROWD_SIMULATOR` is `off`
- [ ] Custom `ADMIN` password: login as `admin@pujafinder.in / Admin@123`
      and change it (register a new admin, or update the seed before first deploy)
- [ ] Swap the demo admin email/password in `backend/app/seed.py` **before**
      the first deploy if the DB will persist
- [ ] `/docs` — decide whether to keep Swagger public (nice for a portfolio!)
