# 🪔 PujaFinder (পূজাফাইন্ডার) — Sharadotsav Kolkata

<div align="center">

![PujaFinder Banner](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

### 🔱 The Ultimate Real-Time Companion for Kolkata's Grandest Festival

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/React_19-Vite_6-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_v4-Festive_Theme-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com)
[![Redis](https://img.shields.io/badge/Redis-Upstash_Cache-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://upstash.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](LICENSE)

<p align="center">
  <a href="#-quick-links">Quick Links</a> •
  <a href="#-key-features">Key Features</a> •
  <a href="#-system-architecture">Architecture</a> •
  <a href="#-quickstart-guide">Quickstart</a> •
  <a href="#-cloud-deployment">Cloud Deploy</a> •
  <a href="#-api-reference">API Reference</a> •
  <a href="#-contributing">Contributing</a>
</p>

</div>

---

## 🌟 Interactive Highlights

<div align="center">

```
   🚩 NORTH KOLKATA       🎡 CENTRAL KOLKATA       🌺 SOUTH KOLKATA
 ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
 │ Bagbazar          │   │ Santosh Mitra Sq  │   │ Suruchi Sangha    │
 │ Kumartuli Park    │   │ College Square    │   │ Ekdalia Evergreen │
 │ Ahiritola         │   │ Md. Ali Park      │   │ Singhi Park       │
 └───────────────────┘   └───────────────────┘   └───────────────────┘
          ▲                       ▲                       ▲
          └─────────────── [ 🚇 KOLKATA METRO ] ──────────┘
```

</div>

> **PujaFinder** is an intelligent, crowd-aware pandal discovery platform tailored for Kolkata Durga Puja. It pairs real-time WebSocket crowd broadcasting, TSP hop-route planning, multi-line Kolkata Metro integration, community photo sharing, and authentic Bengali festive aesthetics.

---

## 🚀 Quick Links

| Resource | Link / Description |
| :--- | :--- |
| **🎨 Web UI** | `http://localhost:5173` (React 19 + Tailwind 4) |
| **⚡ Backend API** | `http://localhost:8000` (FastAPI + ASGI) |
| **📑 Interactive Docs** | `http://localhost:8000/docs` (Swagger UI) |
| **🚀 Deployment Spec** | [DEPLOY.md](DEPLOY.md) & [render.yaml](render.yaml) |
| **📕 Site Reliability** | [RUNBOOK.md](RUNBOOK.md) |

---

## 🎯 Key Features

<details open>
<summary><b>✨ Click to expand / collapse full feature set</b></summary>

### 📱 1. Pandal Discovery & Smart Crowd Intelligence
- 🚦 **Weighted Freshness Algorithm:** Computes live queue times using a decay weight model over the last 30 minutes of crowd telemetry.
- 📡 **Real-time Live WebSockets:** Instant crowd status pushes across all devices without refreshing.
- 📍 **"Near Me" Geolocation:** Instantly ranks pandals within a 5 km radius using the Haversine formula.
- 🟢 **Opening Hours Engine:** Timezone-aware calculation for open/closed pandal status (handles overnight puja rituals).

### 🚇 2. Kolkata Metro & Hop Route Planner (TSP Solver)
- 🗺️ **Multi-Pandal Route Optimizer:** Solves the Travelling Salesperson Problem (TSP) using simulated 2-opt heuristic to generate the fastest walking / transit hopping itinerary.
- 🚆 **Metro Station Integration:** Maps every major pandal to its nearest Kolkata Metro station (Blue Line 1, Green Line 2, etc.) with real walking distances.

### 📸 3. Pujo Moments & Community Reviews
- 🖼️ **Social Photo Wall:** Community gallery for sharing authentic pujo moments with star ratings.
- ⭐ **Pandal Reviews & Moderation:** Verified 1–5 star reviews with anti-spam moderation queue for administrators.
- 🗜️ **Edge Image Compression:** Server-side validation, auto-orientation, EXIF stripping, and WebP compression.

### 🛡️ 4. Enterprise-Grade Security
- 🛡️ **Cloudflare Turnstile Bot Defense:** Invisible captcha protection preventing spam and automated scrapers.
- 📱 **Firebase Phone OTP + Multi-Factor (MFA / TOTP):** Secure login with Authenticator apps & SMS OTP.
- 🔒 **Role-Based Access Control (RBAC):** Granular admin permissions for pandal curation, content CMS, and user management.

</details>

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Client ["📱 Client Tier (Vercel / Cloudflare Edge CDN)"]
        UI["React 19 + TypeScript + Tailwind 4"]
        Nav["Route & Metro Map (Leaflet)"]
        WSClient["WebSocket Live Crowd Hook"]
    end

    subgraph Server ["⚡ Application Tier (Render / Railway)"]
        API["FastAPI (Python 3.10+ ASGI Engine)"]
        WSManager["WebSocket Connection Manager"]
        TSPSolver["TSP Hop Route Planner"]
        AuthService["JWT + TOTP MFA + Phone Auth"]
    end

    subgraph Data ["🗄️ Persistence & Cache Tier"]
        PG[("🐘 Supabase / PostgreSQL (Connection Pooling)")]
        Redis[("⚡ Upstash / Redis (Cache & Rate Limiting)")]
    end

    UI -->|HTTP / REST| API
    WSClient <-->|Bi-directional WS| WSManager
    API --> PG
    API --> Redis
    WSManager --> Redis
```

---

## 💻 Quickstart Guide

### Prerequisites
- **Python 3.10+**
- **Node.js 18+ (20+ recommended)**
- **Git**

### 1️⃣ Clone & Setup
```bash
git clone https://github.com/your-username/pujafinder.git
cd pujafinder
```

### 2️⃣ Start Backend (FastAPI)
```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS / Linux:
# source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
> 💡 *On first boot, the app auto-seeds 15 famous Kolkata pandals with SQLite.*

### 3️⃣ Start Frontend (React + Vite)
```bash
cd ../frontend
npm install
npm run dev
```
> 🌐 *Open `http://localhost:5173` in your browser.*

---

## ☁️ Cloud Deployment

<details>
<summary><b>🚀 Click to view 1-Click Free Cloud Deployment</b></summary>

Deploy PujaFinder with zero upfront cost:

```mermaid
graph LR
    User["📱 Visitor (Mobile/Web)"] --> CDN["🌐 Vercel (Frontend CDN)"]
    CDN --> API["⚡ Render (FastAPI Docker)"]
    API --> DB["🗄️ Supabase (PostgreSQL)"]
    API --> Cache["⚡ Upstash (Redis)"]
```

### Environment Variables Cheat Sheet

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres` |
| `REDIS_URL` | Upstash Redis connection string | `rediss://default:xxxx@ap-south-1.upstash.io:6379` |
| `SECRET_KEY` | JWT encryption secret | `openssl rand -hex 32` |
| `ENVIRONMENT` | Environment mode | `production` |
| `ADMIN_EMAIL` | Auto-created admin email | `admin@yourdomain.com` |
| `ADMIN_PASSWORD`| Initial admin password | `SuperSecret2026!` |

</details>

---

## 📑 API Reference

<details>
<summary><b>🔍 Click to view Core Endpoints</b></summary>

| Method | Endpoint | Access | Purpose |
| :---: | :--- | :---: | :--- |
| `GET` | `/api/pandals` | Public | List & filter all pandals with crowd status |
| `GET` | `/api/pandals/nearby` | Public | Haversine distance-ranked pandals |
| `GET` | `/api/pandals/{id}` | Public | Full pandal detail, themes, & reviews |
| `POST`| `/api/pandals/{id}/crowd-reports` | Auth | Post live crowd status (triggers WS broadcast) |
| `WS`  | `/ws/crowd/all` | Public | Real-time global crowd telemetry feed |
| `POST`| `/api/routes/plan` | Public | Multi-stop TSP hop-route optimizer |
| `GET` | `/api/moments` | Public | Paginated community photo stream |
| `POST`| `/api/auth/register` | Public | User registration (Email or Phone OTP) |
| `POST`| `/api/auth/login` | Public | OAuth2 Password Login + MFA flow |
| `GET` | `/api/admin/dashboard/stats` | Admin | Real-time platform analytics |

</details>

---

## 📊 Live Crowd Logic

```mermaid
flowchart TD
    Report["📡 User submits Crowd Report (LOW / MODERATE / HIGH)"] --> Validate["🛡️ Cooldown & IP Rate Check"]
    Validate --> Decay["⏱️ Calculate Exponential Time-Decay Weight"]
    Decay --> Aggregate["📊 Merge Reports within 30-min Window"]
    Aggregate --> Push["⚡ WebSocket Broadcast to all connected clients"]
    Push --> Cache["💾 Redis Cache Update"]
```

---

## 🤝 Contributing

Contributions are warmly welcome! If you'd like to improve pandal data, add metro line schedules, or enhance the UI:

1. Fork the Project (`https://github.com/your-username/pujafinder/fork`)
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

<div align="center">

**Made with ❤️ and devotion for Kolkata Durga Puja • শারদোৎসব ২০২৬**

<sub>🔱 PujaFinder — Discover the Divine Spirit of Bengal</sub>

</div>
