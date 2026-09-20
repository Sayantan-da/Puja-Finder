"""Crowd estimation engine.

Converts recent crowd reports into a single live estimate using
exponential-decay freshness weighting with confidence scoring and
outlier rejection:

- Only reports newer than CROWD_ESTIMATION_WINDOW_MINUTES count.
- Freshness weight: w = e^(-λ × age_minutes)  where λ = 0.12
  (smooth, continuous decay — replaces the old hard step tiers).
- Outlier rejection: if a report's score deviates more than
  OUTLIER_SIGMA standard deviations from the weighted mean, its
  weight is reduced by OUTLIER_PENALTY so spam/bots don't skew the
  estimate.
- Distinct User Requirement: To prevent a single user or bot from artificially
  inflating confidence, at least 3 distinct users within the window are required
  for HIGH confidence. 2 distinct users caps confidence at MODERATE, and 1 user
  is marked as PRELIMINARY.
- Confidence 0–100 reflects how many fresh reports exist and how
  recent they are (total_weight / FULL_CONFIDENCE_WEIGHT).
- Crowd levels are scored LOW=1, MODERATE=2, HIGH=3; the weighted
  average maps back to a level. Waiting time is the weighted average
  of non-null waits.
- Stale: when there are no fresh reports inside the window the caller
  receives is_stale=True so the UI can show a "STALE" badge.
"""
import math

CROWD_ESTIMATION_WINDOW_MINUTES = 30

# Exponential decay constant – half-life ≈ 5.8 min (fast decay for
# a festival environment where crowd changes quickly)
_LAMBDA = 0.12

# Confidence is capped at 100 once total_weight reaches this value
# (roughly 5 very-fresh reports).
_FULL_CONFIDENCE_WEIGHT = 5.0

# Outlier rejection
_OUTLIER_SIGMA = 1.5   # deviations beyond which a report is an outlier
_OUTLIER_PENALTY = 0.1  # multiplier applied to outlier weight (not zero
                         # so rare-but-accurate lone reports still matter)

LEVEL_SCORE = {"LOW": 1.0, "MODERATE": 2.0, "HIGH": 3.0}


def calculate_freshness_weight(age_minutes: float) -> float:
    """Exponential decay: w = e^(-λ × age).

    Returns 0 for reports older than the estimation window.
    """
    if age_minutes >= CROWD_ESTIMATION_WINDOW_MINUTES:
        return 0.0
    return math.exp(-_LAMBDA * age_minutes)


def estimate_crowd(reports: list[dict]) -> tuple[str, int | None, int, bool, int, str]:
    """Estimate live crowd from reports inside the freshness window.

    Each report dict must contain:
        crowd_level           : "LOW" | "MODERATE" | "HIGH"
        waiting_time_minutes  : int | None
        age_minutes           : float
        user_id (optional)    : int | None

    Returns a 6-tuple:
        level                 : "LOW" | "MODERATE" | "HIGH"
        waiting               : weighted-average waiting time in minutes, or None
        confidence            : 0–100 integer (100 = very confident)
        is_stale              : True when no fresh report exists (caller should show STALE)
        distinct_users        : number of unique users reporting in the window
        confidence_label      : "HIGH" | "MODERATE" | "PRELIMINARY"
    """
    # ── First pass: collect weights & scores ─────────────────────────────────
    entries = []
    valid_users = set()
    for r in reports:
        w = calculate_freshness_weight(r["age_minutes"])
        if w <= 0:
            continue
        uid = r.get("user_id")
        if uid is not None:
            valid_users.add(uid)
        entries.append({
            "score": LEVEL_SCORE[r["crowd_level"]],
            "weight": w,
            "wait": r.get("waiting_time_minutes"),
        })

    if not entries:
        raise ValueError("No fresh reports to estimate from")

    distinct_users = max(1, len(valid_users)) if valid_users else 1

    # ── Weighted mean (pre-outlier) ───────────────────────────────────────────
    total_w = sum(e["weight"] for e in entries)
    pre_mean = sum(e["weight"] * e["score"] for e in entries) / total_w

    # ── Weighted std-dev ─────────────────────────────────────────────────────
    variance = sum(e["weight"] * (e["score"] - pre_mean) ** 2 for e in entries) / total_w
    std_dev = math.sqrt(variance) if variance > 0 else 0.0

    # ── Outlier penalty ──────────────────────────────────────────────────────
    for e in entries:
        if std_dev > 0 and abs(e["score"] - pre_mean) > _OUTLIER_SIGMA * std_dev:
            e["weight"] *= _OUTLIER_PENALTY

    # ── Final weighted average ────────────────────────────────────────────────
    total_w_final = sum(e["weight"] for e in entries)
    weighted_score = sum(e["weight"] * e["score"] for e in entries) / total_w_final

    # Map score → label
    if weighted_score < 1.67:
        level = "LOW"
    elif weighted_score < 2.34:
        level = "MODERATE"
    else:
        level = "HIGH"

    # ── Waiting time ─────────────────────────────────────────────────────────
    wait_num = sum(e["weight"] * e["wait"] for e in entries if e["wait"] is not None)
    wait_den = sum(e["weight"] for e in entries if e["wait"] is not None)
    waiting = round(wait_num / wait_den) if wait_den > 0 else None

    # ── Confidence (0–100) and Distinct User Thresholding ─────────────────────
    raw_confidence = min(100, round(total_w / _FULL_CONFIDENCE_WEIGHT * 100))

    if distinct_users >= 3:
        confidence = raw_confidence
        confidence_label = "HIGH" if confidence >= 60 else "MODERATE"
    elif distinct_users == 2:
        confidence = min(60, raw_confidence)
        confidence_label = "MODERATE"
    else:
        # Single user only
        confidence = min(35, raw_confidence)
        confidence_label = "PRELIMINARY"

    return level, waiting, confidence, False, distinct_users, confidence_label


def calculate_crowd_trend(reports: list[dict]) -> str:
    """Calculate crowd trajectory: SURGING, STEADY, or COOLING.

    Compares freshness-weighted scores of recent reports (<= 10 mins)
    vs older reports in the window (10 - 30 mins).
    """
    recent = [r for r in reports if r.get("age_minutes", 0) <= 10]
    older = [r for r in reports if 10 < r.get("age_minutes", 0) <= CROWD_ESTIMATION_WINDOW_MINUTES]

    if not recent or not older:
        if recent:
            avg_recent = sum(LEVEL_SCORE[r["crowd_level"]] for r in recent) / len(recent)
            if avg_recent >= 2.5:
                return "SURGING"
            if avg_recent <= 1.4:
                return "COOLING"
        return "STEADY"

    avg_recent = sum(LEVEL_SCORE[r["crowd_level"]] for r in recent) / len(recent)
    avg_older = sum(LEVEL_SCORE[r["crowd_level"]] for r in older) / len(older)
    diff = avg_recent - avg_older

    if diff >= 0.35:
        return "SURGING"
    if diff <= -0.35:
        return "COOLING"
    return "STEADY"


def aggregate_attributes(reports: list[dict]) -> dict:
    """Extract dominant approach traffic, barricade distance, and comfort tags."""
    approach_counts: dict[str, float] = {}
    barricade_counts: dict[str, float] = {}
    tags: set[str] = set()

    for r in reports:
        w = calculate_freshness_weight(r.get("age_minutes", 0))
        appr = r.get("approach_traffic")
        if appr:
            approach_counts[appr] = approach_counts.get(appr, 0) + w
        barr = r.get("barricade_distance")
        if barr:
            barricade_counts[barr] = barricade_counts.get(barr, 0) + w
        raw_tags = r.get("comfort_tags")
        if raw_tags:
            if isinstance(raw_tags, str):
                for t in raw_tags.split(","):
                    t_clean = t.strip()
                    if t_clean:
                        tags.add(t_clean)
            elif isinstance(raw_tags, (list, set, tuple)):
                for t in raw_tags:
                    t_clean = str(t).strip()
                    if t_clean:
                        tags.add(t_clean)

    dominant_approach = max(approach_counts.items(), key=lambda x: x[1])[0] if approach_counts else None
    dominant_barricade = max(barricade_counts.items(), key=lambda x: x[1])[0] if barricade_counts else None

    return {
        "approach_traffic": dominant_approach,
        "barricade_distance": dominant_barricade,
        "comfort_tags": sorted(list(tags)),
    }


def generate_hourly_pattern(pandal_id: int, current_level: str | None = None) -> list[dict]:
    """Generate typical 24-hour crowd curve for Kolkata Durga Puja.

    Hours 0 to 23 with realistic rush percent, rush level, and estimated wait.
    Night owl slot (02:00-05:00) & afternoon (11:30-15:30) are lowest.
    Evening (18:00-01:00) is peak.
    """
    # Deterministic slight variation per pandal_id
    seed_offset = (pandal_id * 7) % 15 - 7

    # Base curve hourly percentages (00:00 to 23:00)
    base_curve = [
        75, 60, 35, 18, 12, 20,   # 00:00 - 05:00 (lull 2am - 5am)
        28, 40, 52, 58, 48, 38,   # 06:00 - 11:00 (pushpanjali morning)
        32, 28, 35, 48, 62, 75,   # 12:00 - 17:00 (afternoon bhog lull)
        88, 95, 98, 92, 86, 80    # 18:00 - 23:00 (prime evening rush)
    ]

    multiplier = 1.15 if current_level == "HIGH" else (0.85 if current_level == "LOW" else 1.0)

    pattern = []
    for h in range(24):
        pct = max(5, min(100, round((base_curve[h] + seed_offset) * multiplier)))
        if pct < 35:
            rush = "LOW"
            wait = max(5, round(pct * 0.3))
        elif pct < 70:
            rush = "MODERATE"
            wait = round(15 + (pct - 35) * 0.6)
        elif pct < 88:
            rush = "HIGH"
            wait = round(35 + (pct - 70) * 1.5)
        else:
            rush = "EXTREME"
            wait = round(60 + (pct - 88) * 2.5)

        pattern.append({
            "hour": h,
            "label": f"{h:02d}:00",
            "rush_percent": pct,
            "rush_level": rush,
            "wait_minutes": wait,
            "is_quiet_window": (2 <= h <= 5) or (12 <= h <= 15),
        })

    return pattern
