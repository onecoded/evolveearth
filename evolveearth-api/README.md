# The EvolveEarth Nervous System

One Cloudflare Worker. Every integration. The Oracle proxy grew a body.

Deploy this INSTEAD of `oracle-proxy/worker.js` — it answers the same
`POST /` oracle calls the app already makes, plus fourteen new organs.
Each organ switches on when you add its key; until then its route replies
`501` with the exact setup hint.

## Deploy (same 5 minutes as before)

1. dash.cloudflare.com → Workers & Pages → Create → Hello World → Deploy →
   **Edit code** → paste `worker.js` → **Deploy**.
2. Settings → **Bindings** → Add → KV namespace → create one named anything,
   variable name **`EE_KV`**. (Powers sync, tts cache, push, body, casts.)
3. Settings → Variables & Secrets — add what you want alive (see below).
4. Point the app at the worker URL (Oracle panel → ⚙). Done.

## Organs and their keys

| Organ | Route | Needs |
|---|---|---|
| Oracle brain | `POST /` or `/oracle` | secret `ANTHROPIC_API_KEY` |
| Device sync | `POST/GET /sync` | KV only — works immediately |
| True voice (ElevenLabs) | `POST /tts` | `ELEVENLABS_API_KEY`, var `ELEVEN_VOICE_ID` |
| Oracle letters (email) | `POST /letter` | `ANTHROPIC_API_KEY` (+ `RESEND_API_KEY`, var `LETTER_FROM`) |
| Real sky (ephemeris) | `GET /ephemeris?date=&time=` | nothing — pure math, works now |
| Web push | `/push/subscribe`, `/push/wake`, `/inbox` | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_JWK`, var `VAPID_SUBJECT` |
| Marketplace till | `POST /stripe/checkout` | `STRIPE_SECRET_KEY` |
| Booking rails | `GET /booking?user=` | optional `CALCOM_API_KEY` |
| Apothecary feed | `GET /apothecary` | KV key `apothecary:feed` (+ var `AMAZON_TAG`) |
| Body Oracle (wearables) | `POST /terra/webhook`, `GET /body` | Terra dashboard → webhook URL |
| Soul Card hosting | `POST /cast`, `GET /cast/:id` | KV only |
| Print relics | `POST /print` | `PRINTFUL_API_KEY` |
| The Commons | `GET /stats` | nothing |

Vars that shape behavior: `ALLOWED_ORIGIN` (lock to
`https://onecoded.github.io`), `MODEL` (default `claude-sonnet-5`).

## Setup notes per organ

- **VAPID keys**: `npx web-push generate-vapid-keys`. Store the public key as
  `VAPID_PUBLIC_KEY`. Convert the private key to JWK (one-liner in node with
  `crypto.createPrivateKey`) and store the JSON as `VAPID_PRIVATE_JWK`.
  Push is payload-free by design: the tickle wakes the app's service worker,
  which pulls `/inbox` — no RFC8291 encryption to go wrong.
- **Terra** (wearables hub → Oura/Whoop/Fitbit/Garmin/Apple Health): create a
  dev account at tryterra.co, set the webhook destination to
  `https://<worker>/terra/webhook`, and use the member's soul-key as
  `reference_id` when generating widget sessions.
- **Stripe**: test mode key first. `POST /stripe/checkout {title, amountUsd}`
  returns `{url}` — the app opens it. Add Connect for practitioner payouts
  when volume justifies it.
- **Apothecary curation**: put a JSON array (same shape as the app's
  `MARKETPLACE_SEED`) in KV under key `apothecary:feed`. Amazon links get
  `?tag=$AMAZON_TAG` stamped automatically.
- **Ephemeris**: `GET /ephemeris?date=1985-03-14&time=06:45` (UTC) →
  sidereal sun/moon, moon **nakshatra + pada**, rashi, **tithi** (with
  ekadashi flag). Accuracy ~0.3° on the moon — well inside a 13°20' mansion.
- **Sync**: the app should encrypt before pushing (the key never leaves the
  device; the server stores ciphertext it cannot read). 400KB per soul.

## Security posture

- No accounts, no passwords: a **soul-key** (random 16–80 char token the app
  generates) namespaces all member data. Possession = access, like the
  return-link. SIWE wallet-signature auth is the planned upgrade once the
  chain is live.
- All third-party keys live as worker secrets — never in the webpage.
- CORS locked with `ALLOWED_ORIGIN`.

## The Commons roadmap

`/stats` serves counters + the deployments manifest today. When the
contracts land on Bittensor mainnet, a Graph subgraph indexes Prisms,
$PRANA flows, and seals; the anonymized consented flourishing dataset
publishes alongside — the dataset the healing subnet trains against.
