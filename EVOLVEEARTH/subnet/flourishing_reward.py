"""
FLOURISHING REWARD — the loss function of the EvolveEarth healing subnet.
============================================================================
Every AI today is trained to predict text or maximize engagement. This
subnet's miners are rewarded for something else entirely: guidance that
MEASURABLY opened a human being's field months later.

Signal chain:
  1. A user asks; miners answer (guidance_events).
  2. The user's Prism keeps evolving on-chain (prism_snapshots: flow 0-100
     + per-chakra states, timestamped, from SoulSignature.flowOf()).
  3. Validators run this function over a trailing window: each miner's
     reward is the flow improvement of the souls they guided, time-decayed,
     baseline-adjusted, and robust to gaming.

Anti-gaming, by construction:
  - Rewards need MONTHS-LATER deltas — you cannot farm them in a session.
  - Baseline adjustment: only improvement ABOVE the cohort's natural drift
    counts, so miners can't ride the tide.
  - Per-soul cap: one healed person counts once, however many answers they
    received; spamming answers at healthy users yields ~zero.
  - Attribution decays with time-to-effect and splits across the miners
    who actually served that soul in the window.

Pure Python, no dependencies. Run this file to self-test:  python flourishing_reward.py
"""

from collections import defaultdict

# ── Tunables (governance parameters on-chain later) ────────────────────────
WINDOW_DAYS        = 90      # look-back for guidance events
MIN_LAG_DAYS       = 14      # deltas sooner than this don't count (no quick-hit farming)
HALF_LIFE_DAYS     = 45      # attribution half-life: recent guidance weighs more
PER_SOUL_CAP       = 25.0    # max score any single soul can contribute to one miner
BASELINE_TRIM      = 0.10    # trim fraction for the cohort-drift baseline (robust mean)


def _trimmed_mean(values, trim=BASELINE_TRIM):
    """Robust cohort drift: mean after trimming the extremes."""
    if not values:
        return 0.0
    v = sorted(values)
    k = int(len(v) * trim)
    core = v[k: len(v) - k] or v
    return sum(core) / len(core)


def _decay(days_before_delta):
    """Exponential attribution decay by guidance age (half-life HALF_LIFE_DAYS)."""
    return 0.5 ** (days_before_delta / HALF_LIFE_DAYS)


def flow_delta(snapshots, t_start, t_end):
    """
    Change in a soul's flow between their state AT t_start (the last snapshot
    at or before it — how they were when guided) and their latest state by
    t_end. Robust to sparse snapshot histories.
    """
    before = [s for s in snapshots if s["day"] <= t_start]
    upto   = [s for s in snapshots if s["day"] <= t_end]
    if not before or not upto:
        return None
    start = max(before, key=lambda s: s["day"])
    end   = max(upto,   key=lambda s: s["day"])
    if end["day"] <= start["day"]:
        return None  # no NEW information since the guidance — nothing proven
    return end["flow"] - start["flow"]


def score_miners(guidance_events, prism_snapshots, now_day):
    """
    guidance_events : [{"miner": id, "soul": id, "day": int}]
    prism_snapshots : {soul_id: [{"day": int, "flow": 0-100}]}
    now_day         : current day index
    Returns {miner_id: normalized_score} summing to ~1.0 (the emission split).
    """
    window_start = now_day - WINDOW_DAYS

    # 1) Cohort baseline: how much did EVERY tracked soul drift on its own
    #    across the observed window? (First-to-last snapshot inside it.)
    cohort_deltas = []
    for soul, snaps in prism_snapshots.items():
        window = sorted((s for s in snaps if window_start <= s["day"] <= now_day),
                        key=lambda s: s["day"])
        if len(window) >= 2:
            cohort_deltas.append(window[-1]["flow"] - window[0]["flow"])
    baseline = _trimmed_mean(cohort_deltas)

    # 2) Attribute above-baseline healing to the miners who served each soul.
    #    Credit per (miner, soul) is the BEST single event — answering the
    #    same person fifty times earns no more than answering them once well.
    per_miner_soul = defaultdict(lambda: defaultdict(float))
    for ev in guidance_events:
        if not (window_start <= ev["day"] <= now_day - MIN_LAG_DAYS):
            continue  # too old or too recent to have proven anything
        snaps = prism_snapshots.get(ev["soul"], [])
        d = flow_delta(snaps, ev["day"], now_day)
        if d is None:
            continue
        lift = d - baseline           # only healing beyond the natural tide counts
        if lift <= 0:
            continue
        credit = lift * _decay(now_day - ev["day"])
        cur = per_miner_soul[ev["miner"]][ev["soul"]]
        per_miner_soul[ev["miner"]][ev["soul"]] = max(cur, credit)

    # 3) Per-soul cap, then sum per miner.
    raw = {}
    for miner, souls in per_miner_soul.items():
        raw[miner] = sum(min(v, PER_SOUL_CAP) for v in souls.values())

    # 4) Normalize to an emission split.
    total = sum(raw.values())
    if total == 0:
        return {}
    return {m: v / total for m, v in raw.items()}


# ── Self-test ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # Three souls. Soul A improves a lot, B drifts with the tide, C declines.
    snapshots = {
        "A": [{"day": 0, "flow": 30}, {"day": 60, "flow": 72}],   # +42 (healed!)
        "B": [{"day": 0, "flow": 50}, {"day": 60, "flow": 55}],   # +5 (tide)
        "C": [{"day": 0, "flow": 64}, {"day": 60, "flow": 58}],   # -6
    }
    events = [
        {"miner": "healer_m1", "soul": "A", "day": 5},    # guided the soul that healed
        {"miner": "engage_m2", "soul": "B", "day": 5},    # rode the tide
        {"miner": "engage_m2", "soul": "C", "day": 5},    # guided a decline
        {"miner": "spam_m3",   "soul": "A", "day": 58},   # jumped in at the end (< MIN_LAG)
    ]
    scores = score_miners(events, snapshots, now_day=60)

    assert "healer_m1" in scores and scores["healer_m1"] > 0.9, scores
    assert scores.get("spam_m3", 0) == 0, "late spam must earn nothing"
    assert scores.get("engage_m2", 0) < 0.1, "tide-riding must earn ~nothing"
    total = sum(scores.values())
    assert abs(total - 1.0) < 1e-9, total

    # Gaming check: spamming 50 events at one healed soul gains nothing (per-soul cap + same soul).
    spam = [{"miner": "spam_m4", "soul": "A", "day": 5 + i % 10} for i in range(50)]
    s2 = score_miners(events + spam, snapshots, now_day=60)
    assert s2["spam_m4"] <= s2["healer_m1"] * 1.2, "spam must not beat honest healing"

    print("PASS - flourishing reward: healers earn, tide-riders and spammers do not.")
    print("emission split:", {k: round(v, 3) for k, v in scores.items()})
