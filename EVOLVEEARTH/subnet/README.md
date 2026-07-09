# The Flourishing Subnet — the first AI whose loss function is human flourishing

Every AI today is trained to predict text or maximize engagement. This Bittensor
subnet's miners are rewarded for one thing only: **guidance that measurably opened
a human being's field months later.** The counter-model to the attention economy,
owned by the healed.

## Protocol

| Role | Does | Paid for |
|---|---|---|
| **User** | Asks for guidance through the app's Oracle; keeps practicing; their Prism (`SoulSignature.flowOf`) evolves on-chain | Their own healing (+ $PRANA) |
| **Miner** | Serves personalized guidance (herbal, somatic, shadow-work, practice protocols) | The **later, measured flow-improvement** of the souls they guided |
| **Validator** | Records guidance events, snapshots Prism flows, runs `flourishing_reward.py` over a trailing 90-day window, sets weights | Standard validator emissions |

## The loss function (`flourishing_reward.py` — verified reference implementation)

1. **Longitudinal only** — deltas are measured from the soul's state *when guided*
   to their state *now*; events younger than `MIN_LAG_DAYS` (14) prove nothing and
   earn nothing. You cannot farm a session.
2. **Baseline-adjusted** — only improvement *above the cohort's natural drift*
   (trimmed mean) counts. Miners can't ride the tide.
3. **Best-single-event credit** — per (miner, soul), credit is the best single
   attribution, never a sum. Answering one person fifty times earns no more than
   answering them once well.
4. **Per-soul cap + time-decay** — one healed soul contributes at most
   `PER_SOUL_CAP` to any miner; attribution half-life is 45 days.

Verified behavior (self-test): the miner who guided the soul that healed takes the
full emission; tide-riders and decline-guides take zero; a 50-event spam attack on
an already-healed soul gains nothing over one honest answer.

## Deployment path
1. Now: run the reward function centrally (the app's oracle = the only "miner") to
   accumulate real longitudinal data.
2. Testnet: register subnet (chain 945), port validator to the Bittensor SDK
   (`bittensor` pip package), miners = LLM endpoints answering with soul-context.
3. Mainnet (chain 964): open mining; governance moves the tunables on-chain.

All tunables (`WINDOW_DAYS`, `MIN_LAG_DAYS`, `HALF_LIFE_DAYS`, `PER_SOUL_CAP`) are
future DAO parameters.
