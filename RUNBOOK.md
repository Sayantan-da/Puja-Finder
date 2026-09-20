# 📕 PujaFinder RUNBOOK — what to do when things break

Read this **before** launch day. At 2 AM on Ashtami you follow steps, not memory.

---

## 0. One-time setup (do these BEFORE launch)

| Task | Where | Verify |
|------|-------|--------|
| Sentry project + DSN | https://sentry.io (free) → create project → copy DSN | Set `SENTRY_DSN` env var on Render. Trigger a test error → **you receive an email** |
| Sentry alert emails | Sentry → Alerts → create rule "New Error → notify me" | Check inbox |
| UptimeRobot | https://uptimerobot.com (free) → HTTP monitor → `https://your-app.onrender.com/health`, every 5 min | Test alert email arrives |
| Restore drill | `DATABASE_URL=… ./scripts/restore_drill.sh` | Prints "✅ RESTORE DRILL PASSED" |
| Load test live URL | `locust -f loadtest/locustfile.py --headless -u 200 -r 20 -t 5m --host https://your-url` | 0% failures, acceptable p95 |

---

## 1. Site is DOWN — 5-minute triage (in this order)

1. **Check it yourself**: open the URL → `/health` should return `{"status":"healthy"}`
2. **Is it everyone?** https://www.renderstatus.com — if Render is down, nothing to do; post a status note
3. **Render dashboard → your service → Logs** — read the last lines:
   - `Application startup complete` but no traffic? → DNS/routing issue
   - Crash loop? → note the error, **roll back** (next section)
   - DB connection errors (`connection refused`, `too many connections`)? → DB issue, see §3
4. **Manual restart**: Render → Manage → **Manual Deploy → Restart service** (~30 s, safe)
5. **Still down?** Roll back (next section) and tell users:
   - WhatsApp group: *"PujaFinder is temporarily down, we're on it — use Google Maps meanwhile"* — honest > silent

## 2. Roll back a bad deploy (30 seconds)

Render → your service → **Deploys** tab → last good deploy → **Rollback**.

- Rollback does **not** touch the database (safe)
- If a *migration* caused the breakage: roll back the code, then see §5 for schema notes

## 3. Database broken / data corrupted — restore procedure

**VERIFIED procedure** (drilled in the sandbox; row counts matched exactly):

```bash
# 1. Dump (this is what the nightly backups do — GitHub Action / cron)
pg_dump --format=custom --file backup.dump "$DATABASE_URL"

# 2. DESTROY and recreate an EMPTY database (Render/Neon dashboard or psql):
psql "$ADMIN_URL" -c "DROP DATABASE pujafinder;"
psql "$ADMIN_URL" -c "CREATE DATABASE pujafinder ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C';"

# 3. Restore — the dump contains the FULL schema (including alembic_version).
#    Do NOT run `alembic upgrade head` first — it conflicts with restored types!
pg_restore --no-owner --dbname "$DATABASE_URL" backup.dump

# 4. Restart the app (Render → Restart service) and check /api/pandals
```

⚠️ **The #1 restore mistake**: running `alembic upgrade head` before `pg_restore`.
The dump already contains the schema — migrations first = `type "crowdlevel" already exists` and **zero rows restored**. (Found by our own drill.)

Prove backups work anytime, without touching prod:
`DATABASE_URL="…" ./scripts/restore_drill.sh` → restores into a scratch DB, compares counts, cleans up.

## 4. Known behaviours (not bugs)

| Symptom | Explanation |
|---------|-------------|
| First request slow (~50 s) after idle | Render free tier sleeps. UptimeRobot's 5-min ping mostly prevents it. Starter plan = always on |
| `429 Rate limit exceeded` | Working as intended (login 20/min/IP, writes 30/min). Shared carrier NAT can hit it — limits are generous; raise RULES in `app/rate_limit.py` if needed |
| Crowd badge shows "connecting…" then data | WebSocket reconnecting with backoff; UI falls back to 10 s REST polling automatically |
| User logged out suddenly | JWT expired (24 h). Client clears the stored session on 401 and shows login |
| Photos gone after redeploy | Only on ephemeral disks (Render free). Fix: persistent disk / S3 (DEPLOY.md backlog) |
| Old images cached | 24 h browser cache on `/uploads` — by design; force-refresh with Ctrl+F5 |

## 5. Database schema changes (the safe path)

```bash
# 1. Edit models under backend/app/models/
# 2. Generate + REVIEW the migration locally:
alembic revision --autogenerate -m "add X"     # read the generated file!
# 3. Test locally:  alembic upgrade head
# 4. Commit BOTH the model change and the migration file → push
#    → Render auto-deploys → container CMD runs `alembic upgrade head`
```

Never edit an already-applied migration. Add a new one instead.

## 6. Security quick-reference

- `SECRET_KEY` rotated? Old JWTs stop working (everyone re-logins — acceptable)
- Spam wave? Rate limits are already on; tighten RULES in `app/rate_limit.py`, redeploy
- A bad photo/review? Admin dashboard → moderation queue; Moments → admin delete
- Compromised admin account? Create a new admin, delete the old user from the admin panel

## 7. Launch-day checklist

- [ ] `ENVIRONMENT=production` set (demo accounts NOT created — verify: `admin@pujafinder.in` login FAILS)
- [ ] `CROWD_SIMULATOR=off`
- [ ] `SECRET_KEY` = generated value (Render Blueprint does this)
- [ ] Sentry DSN set + **test error email received**
- [ ] UptimeRobot monitor green + **test alert received**
- [ ] Restore drill passed at least once
- [ ] Load test on the live URL: 0% failures at 200 users
- [ ] Opened on a real phone on mobile data — browse, map, upload, report crowd
- [ ] Bookmarks ready: Render, Neon/Supabase, Sentry dashboards
