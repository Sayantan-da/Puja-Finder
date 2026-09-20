# Real-time crowd data — how it works

## The problem

Crowd levels change when **other users** post reports. A browser sitting on the
page has no way to "know" when that happens — it must either ask repeatedly, or
the server must **push** the update the moment it occurs.

## The three approaches compared

| | Polling | SSE (Server-Sent Events) | WebSocket |
|--|---------|--------------------------|-----------|
| Direction | Browser asks server every N sec | Server → browser (one-way stream) | Server ⇄ browser (two-way) |
| Latency | Up to the poll interval | Instant | Instant |
| Overhead | High (repeated HTTP requests) | Low | Lowest (single connection) |
| Complexity | Trivial | Low (needs `text/event-stream`) | Medium (needs upgrade handshake) |
| Auto-reconnect | Free | Built into `EventSource` | You implement it |
| Through proxies | Always works | Usually | Needs WS-aware proxy (`ws: true`) |
| Best for | Simple dashboards | Feeds, notifications | Live updates, chat, collaboration |

**PujaFinder uses WebSocket as primary + polling as automatic fallback** — the
best of both: instant updates when the socket is up, graceful degradation when
it isn't (strict proxies, corporate firewalls).

## PujaFinder's architecture

```
 Browser A                FastAPI server                Browser B
 (pandal #5 page)                                       (home page)
     │                          │                           │
     │ POST /api/pandals/5/     │                           │
     │      crowd-reports       │                           │
     ├─────────────────────────►│                           │
     │                          │ 1. save report (DB)       │
     │                          │ 2. recompute weighted     │
     │                          │    estimate (30-min window)
     │                          │ 3. manager.broadcast():   │
     │                          │    ── push ───────────────►  ws/crowd/all
     │  ◄── push (same JSON) ───┤    ── push ──► ws/crowd/5 (viewers of pandal 5)
     │                          │
   {type:"crowd_update", pandal_id:5, crowd_level:"HIGH",
    waiting_time_minutes:36, fresh_count:4, ts:"..."}
```

### Backend pieces

| File | Role |
|------|------|
| `app/realtime.py` | `CrowdConnectionManager` — tracks sockets per channel (`"<pandal_id>"`, `"all"`), broadcasts JSON, drops dead connections |
| `app/routers/ws.py` | `WS /ws/crowd/{channel}` — accepts connections, keeps them open |
| `app/routers/crowd.py` | After saving a report → recomputes estimate → `await manager.broadcast_crowd_update(...)` |
| `app/services/crowd_simulator.py` | Demo-only background task: posts a synthetic report every ~6–12 s and broadcasts it (enable with `CROWD_SIMULATOR=on`) |

### Frontend pieces

| File | Role |
|------|------|
| `src/hooks/useLiveCrowd.ts` | React hook: connects to `/ws/crowd/{channel}`, parses messages, **auto-reconnects with exponential backoff** (1s→2s→4s…15s), pings REST every 20 s if socket is down |
| `src/pages/PandalDetailPage.tsx` | Channel = pandal id. Updates the crowd badge + refreshes recent reports instantly; shows a pulsing **LIVE** indicator |
| `src/pages/HomePage.tsx` | Channel = `"all"`. Patches the matching pandal card in local state — no refetch needed; shows the latest report as a live ticker |

### Why channels?

A browser on pandal #5 only cares about pandal #5. Channels stop one busy
pandal from spamming every connected browser, and the home page subscribes to
`"all"` instead of 15 separate sockets.

## Scaling beyond one process

The connection manager is **in-memory** — fine for a single uvicorn process
(this project). For production with multiple workers / multiple servers:

- Move the channel registry to **Redis pub/sub** (or a message queue).
  Each worker subscribes once; `broadcast()` publishes to Redis; every worker
  forwards to its own local sockets.
- Put **Sticky sessions** / WS support in the load balancer (nginx:
  `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`)

The payload shape and client hook stay exactly the same — only
`manager.broadcast()` changes implementation.

## Test it yourself

1. **Two-tab test** (true real-time): open pandal #5 in tab A and the home page in tab B → post a crowd report in tab A → watch tab B's card + ticker update instantly, no refresh.
2. **Simulator** (single tab): the preview server runs with `CROWD_SIMULATOR=on`, so reports appear every few seconds on their own.
3. Raw socket check from a terminal:
   ```bash
   npx wscat -c ws://localhost:8000/ws/crowd/all
   ```
