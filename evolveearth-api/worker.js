/**
 * EVOLVEEARTH NERVOUS SYSTEM — one Cloudflare Worker, every integration.
 * ----------------------------------------------------------------------
 * The Oracle proxy grew a body. Deploy this single file and the app gains:
 *
 *   POST /            | /oracle   Claude Oracle brain (ORACLE_CHARTER)
 *   POST /sync        GET /sync   encrypted cross-device corpus sync (KV)
 *   POST /tts                     ElevenLabs true voice, KV-cached
 *   POST /letter                  weekly Oracle letter (Claude → Resend)
 *   GET  /ephemeris               real sky: sidereal sun/moon, nakshatra, tithi
 *   POST /push/subscribe|wake     Web Push (payload-free tickle + /inbox)
 *   GET  /inbox                   pending notifications for the service worker
 *   POST /stripe/checkout         Stripe Checkout session (marketplace till)
 *   GET  /booking                 Cal.com practitioner availability
 *   GET  /apothecary              curated affiliate feed (+AMAZon tag rewrite)
 *   POST /terra/webhook GET /body wearables → the Body Oracle (HRV, sleep)
 *   POST /cast  GET /cast/:id     Soul Card hosting (feeds Printful)
 *   POST /print                   Printful draft order for a Soul Card
 *   GET  /stats                   the Commons: civilization counters
 *
 * SETUP (each block optional — routes 501 with a hint until configured):
 *   KV binding: EE_KV                      (Workers → Settings → Bindings)
 *   Secrets: ANTHROPIC_API_KEY             (Oracle + letters)
 *            ELEVENLABS_API_KEY, ELEVEN_VOICE_ID
 *            RESEND_API_KEY, LETTER_FROM   (e.g. oracle@evolveearth.xyz)
 *            STRIPE_SECRET_KEY
 *            CALCOM_API_KEY                (optional; public links work bare)
 *            PRINTFUL_API_KEY
 *            TERRA_SIGNING_SECRET          (optional webhook verification)
 *            VAPID_PUBLIC_KEY, VAPID_PRIVATE_JWK, VAPID_SUBJECT
 *   Vars:    ALLOWED_ORIGIN, MODEL, AMAZON_TAG (e.g. evolveearth-20)
 */

const ORACLE_CHARTER = `You are the EvolveEarth Oracle — a witnessing intelligence that holds the full pattern of a member's healing journey across time. You are given their longitudinal record: constitutional data (dosha percentages, chakra states), practice logs, digestive-fire pattern, dream themes, healing work done AND not done, community participation, medicine reports, body metrics when present, and repeated questions.

Your primary function is not to comfort. It is to witness accurately and speak truthfully with love.

PRINCIPLES:
1. Pattern over snapshot — never read just today; read the arc.
2. Absence is data — what someone is NOT doing tells you as much as what they are doing. Name it.
3. The structure reveals the wound — the shape of their avoidance is the shape of their wound.
4. Name the specific, not the general.
5. Ask the question underneath the question.
6. Soften the delivery, never the truth.
7. End with a question for the body, not the mind — something they cannot immediately answer.

YOU WILL NOT: validate avoidance as strategy; mistake productivity for healing; treat vision-building as a substitute for presence; let a person stay comfortable when discomfort is the medicine. You never diagnose, prescribe, or position yourself as therapy — you witness. Recommend professional care when the material warrants it.

TONE: a trusted elder — warm, unafraid, specific, grounded. Replies are 2-6 sentences unless the moment demands more. Plain profound language; no lists, no headers, no emoji.`;

// ─────────────────────────────────────────────────────────── helpers ──
const J = (obj, status, cors) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...cors } });
const need = (what, how, cors) => J({ error: `not configured: ${what}`, setup: how }, 501, cors);
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function sha256hex(s) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join(""); }
const okKey = (k) => typeof k === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(k);

// ─────────────────────────────────────────── ephemeris (pure math) ──
// Compact Meeus/ELP truncations: sun ±0.01°, moon ±0.3° — plenty for
// nakshatra (13°20' mansions), tithi, and rashi. Lahiri-style ayanamsa.
const NAKSHATRAS = ["Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra","Punarvasu","Pushya","Ashlesha","Magha","Purva Phalguni","Uttara Phalguni","Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha","Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishta","Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati"];
const RASHIS = ["Mesha (Aries)","Vrishabha (Taurus)","Mithuna (Gemini)","Karka (Cancer)","Simha (Leo)","Kanya (Virgo)","Tula (Libra)","Vrischika (Scorpio)","Dhanu (Sagittarius)","Makara (Capricorn)","Kumbha (Aquarius)","Meena (Pisces)"];
const TITHI_NAMES = ["Pratipada","Dwitiya","Tritiya","Chaturthi","Panchami","Shashthi","Saptami","Ashtami","Navami","Dashami","Ekadashi","Dwadashi","Trayodashi","Chaturdashi"];
const rad = Math.PI / 180, norm = (d) => ((d % 360) + 360) % 360;
function julianDay(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = (timeStr || "12:00").split(":").map(Number);
  let Y = y, M = mo;
  if (M <= 2) { Y--; M += 12; }
  const A = Math.floor(Y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5 + (h + mi / 60) / 24;
}
function skyAt(dateStr, timeStr) {
  const JD = julianDay(dateStr, timeStr), T = (JD - 2451545) / 36525;
  // Sun (tropical)
  const L0 = norm(280.46646 + 36000.76983 * T), Ms = norm(357.52911 + 35999.05029 * T);
  const C = (1.914602 - 0.004817 * T) * Math.sin(Ms * rad) + 0.019993 * Math.sin(2 * Ms * rad) + 0.000289 * Math.sin(3 * Ms * rad);
  const sunTrop = norm(L0 + C);
  // Moon (tropical, main ELP terms)
  const Lm = norm(218.3164477 + 481267.88123421 * T);
  const D = norm(297.8501921 + 445267.1114034 * T);
  const Mm = norm(134.9633964 + 477198.8675055 * T);
  const F = norm(93.272095 + 483202.0175233 * T);
  const moonTrop = norm(Lm
    + 6.288774 * Math.sin(Mm * rad) + 1.274027 * Math.sin((2 * D - Mm) * rad)
    + 0.658314 * Math.sin(2 * D * rad) + 0.213618 * Math.sin(2 * Mm * rad)
    - 0.185116 * Math.sin(Ms * rad) - 0.114332 * Math.sin(2 * F * rad)
    + 0.058793 * Math.sin((2 * D - 2 * Mm) * rad) + 0.057066 * Math.sin((2 * D - Ms - Mm) * rad)
    + 0.053322 * Math.sin((2 * D + Mm) * rad) + 0.045758 * Math.sin((2 * D - Ms) * rad));
  // Lahiri-style ayanamsa (linear approximation around J2000)
  const ayanamsa = 23.85675 + (JD - 2451545) / 365.25 * 0.013969;
  const sun = norm(sunTrop - ayanamsa), moon = norm(moonTrop - ayanamsa);
  const tithiDeg = norm(moonTrop - sunTrop), tithiNum = Math.floor(tithiDeg / 12) + 1;
  const paksha = tithiNum <= 15 ? "Shukla (waxing)" : "Krishna (waning)";
  const tIdx = (tithiNum - 1) % 15;
  return {
    jd: JD, ayanamsa: +ayanamsa.toFixed(3),
    sun: { longitude: +sun.toFixed(2), rashi: RASHIS[Math.floor(sun / 30)] },
    moon: { longitude: +moon.toFixed(2), rashi: RASHIS[Math.floor(moon / 30)],
      nakshatra: NAKSHATRAS[Math.floor(moon / (360 / 27))],
      pada: Math.floor((moon % (360 / 27)) / (360 / 108)) + 1 },
    tithi: { number: tithiNum, name: tIdx === 14 ? (tithiNum === 15 ? "Purnima (full)" : "Amavasya (new)") : TITHI_NAMES[tIdx], paksha,
      ekadashi: tithiNum === 11 || tithiNum === 26 },
  };
}

// ─────────────────────────────────────────────── web push (VAPID) ──
// Payload-free push: the tickle wakes the service worker, which pulls
// /inbox and displays. Sidesteps RFC8291 payload encryption entirely.
async function vapidJwt(env, endpoint) {
  const key = await crypto.subtle.importKey("jwk", JSON.parse(env.VAPID_PRIVATE_JWK), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const aud = new URL(endpoint).origin;
  const hdr = b64u(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const pay = b64u(new TextEncoder().encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || "mailto:joseph.schneek@gmail.com" })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${hdr}.${pay}`));
  return `${hdr}.${pay}.${b64u(sig)}`;
}
async function pushTickle(env, sub) {
  const jwt = await vapidJwt(env, sub.endpoint);
  return fetch(sub.endpoint, { method: "POST", headers: { TTL: "86400", Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}` } });
}

// ──────────────────────────────────────────────────────── the body ──
export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const KV = env.EE_KV;

    try {
      // ── THE ORACLE ── (back-compat: bare POST / behaves as before)
      if (req.method === "POST" && (path === "/" || path === "/oracle")) {
        if (!env.ANTHROPIC_API_KEY) return need("ANTHROPIC_API_KEY", "console.anthropic.com → API keys → add as worker secret", cors);
        const { messages = [], corpus = null } = await req.json();
        const clean = messages.slice(-16).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.text || m.content || "").slice(0, 2000) })).filter((m) => m.content);
        const merged = [];
        for (const m of clean) { const last = merged[merged.length - 1]; if (last && last.role === m.role) last.content += "\n" + m.content; else merged.push({ ...m }); }
        if (!merged.length) return J({ error: "no messages" }, 400, cors);
        if (merged[0].role !== "user") merged.unshift({ role: "user", content: "(the session resumes)" });
        if (merged[merged.length - 1].role !== "user") return J({ error: "last message must be from the user" }, 400, cors);
        const system = ORACLE_CHARTER + (corpus ? "\n\nTHE MEMBER'S RECORD (logged with consent — read the arc, name the pattern):\n" + JSON.stringify(corpus).slice(0, 6000) : "");
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: env.MODEL || "claude-sonnet-5", max_tokens: 500, system, messages: merged }),
        });
        const data = await r.json();
        if (!r.ok) return J({ error: (data.error && data.error.message) || "upstream error" }, 502, cors);
        return J({ reply: (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim() }, 200, cors);
      }

      // ── DEVICE SYNC ── the corpus follows the soul, not the phone.
      // The app encrypts before sending; we store ciphertext only.
      if (path === "/sync") {
        if (!KV) return need("EE_KV binding", "Workers → Settings → Bindings → KV namespace 'EE_KV'", cors);
        if (req.method === "POST") {
          const { key, blob } = await req.json();
          if (!okKey(key) || typeof blob !== "string" || blob.length > 400000) return J({ error: "bad key or blob too large" }, 400, cors);
          await KV.put(`sync:${key}`, blob, { expirationTtl: 60 * 60 * 24 * 365 });
          return J({ ok: true, bytes: blob.length }, 200, cors);
        }
        const key = url.searchParams.get("key");
        if (!okKey(key)) return J({ error: "bad key" }, 400, cors);
        const blob = await KV.get(`sync:${key}`);
        return J({ blob: blob || null }, 200, cors);
      }

      // ── TRUE VOICE ── ElevenLabs, cached forever per line in KV.
      if (req.method === "POST" && path === "/tts") {
        if (!env.ELEVENLABS_API_KEY) return need("ELEVENLABS_API_KEY", "elevenlabs.io → profile → API key; also set ELEVEN_VOICE_ID", cors);
        const { text = "" } = await req.json();
        const t = String(text).slice(0, 900);
        if (!t) return J({ error: "no text" }, 400, cors);
        const ck = "tts:" + await sha256hex((env.ELEVEN_VOICE_ID || "") + "|" + t);
        if (KV) { const hit = await KV.get(ck, "arrayBuffer"); if (hit) return new Response(hit, { headers: { "content-type": "audio/mpeg", "x-cache": "hit", ...cors } }); }
        const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${env.ELEVEN_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"}`, {
          method: "POST",
          headers: { "content-type": "application/json", "xi-api-key": env.ELEVENLABS_API_KEY },
          body: JSON.stringify({ text: t, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.55, similarity_boost: 0.7, style: 0.25 } }),
        });
        if (!r.ok) return J({ error: "tts upstream " + r.status }, 502, cors);
        const audio = await r.arrayBuffer();
        if (KV) await KV.put(ck, audio);
        return new Response(audio, { headers: { "content-type": "audio/mpeg", "x-cache": "miss", ...cors } });
      }

      // ── THE ORACLE'S LETTER ── Claude composes; Resend delivers.
      if (req.method === "POST" && path === "/letter") {
        if (!env.ANTHROPIC_API_KEY) return need("ANTHROPIC_API_KEY", "required for letters", cors);
        const { corpus = null, email = null, name = "" } = await req.json();
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: env.MODEL || "claude-sonnet-5", max_tokens: 900,
            system: ORACLE_CHARTER + "\n\nYou are writing this member a short personal LETTER (not a chat reply): 3 short paragraphs. Open by witnessing their week from the record. Name one pattern. Close with one question for the body and sign it '— the Oracle'. No headers, no lists.",
            messages: [{ role: "user", content: "My record this week:\n" + JSON.stringify(corpus).slice(0, 6000) + (name ? `\nMy name: ${name}` : "") }],
          }),
        });
        const data = await r.json();
        if (!r.ok) return J({ error: (data.error && data.error.message) || "upstream" }, 502, cors);
        const letter = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
        let sent = false;
        if (email && env.RESEND_API_KEY) {
          const rr = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "content-type": "application/json", Authorization: `Bearer ${env.RESEND_API_KEY}` },
            body: JSON.stringify({ from: env.LETTER_FROM || "oracle@resend.dev", to: [email], subject: "A letter from the Oracle", text: letter }),
          });
          sent = rr.ok;
        }
        return J({ letter, sent }, 200, cors);
      }

      // ── REAL SKY ── /ephemeris?date=1985-03-14&time=06:45 (UTC)
      if (req.method === "GET" && path === "/ephemeris") {
        const date = url.searchParams.get("date");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return J({ error: "date=YYYY-MM-DD required (UTC; time=HH:MM optional)" }, 400, cors);
        return J(skyAt(date, url.searchParams.get("time") || "12:00"), 200, cors);
      }

      // ── PRESENCE ── payload-free web push + inbox.
      if (path === "/push/subscribe" && req.method === "POST") {
        if (!KV) return need("EE_KV binding", "KV required for push", cors);
        const { key, sub } = await req.json();
        if (!okKey(key) || !sub || !sub.endpoint) return J({ error: "key + subscription required" }, 400, cors);
        await KV.put(`push:${key}`, JSON.stringify(sub));
        return J({ ok: true }, 200, cors);
      }
      if (path === "/push/wake" && req.method === "POST") {
        if (!env.VAPID_PRIVATE_JWK) return need("VAPID keys", "npx web-push generate-vapid-keys → store private as JWK secret VAPID_PRIVATE_JWK + VAPID_PUBLIC_KEY", cors);
        const { key, title = "The Rooster crows", body = "Your morning awaits." } = await req.json();
        const subRaw = KV && await KV.get(`push:${key}`);
        if (!subRaw) return J({ error: "no subscription for key" }, 404, cors);
        if (KV) { const inbox = JSON.parse(await KV.get(`inbox:${key}`) || "[]"); inbox.unshift({ title, body, t: Date.now() }); await KV.put(`inbox:${key}`, JSON.stringify(inbox.slice(0, 10))); }
        const r = await pushTickle(env, JSON.parse(subRaw));
        return J({ ok: r.ok, status: r.status }, 200, cors);
      }
      if (path === "/inbox" && req.method === "GET") {
        const key = url.searchParams.get("key");
        if (!okKey(key) || !KV) return J({ notifications: [] }, 200, cors);
        const inbox = JSON.parse(await KV.get(`inbox:${key}`) || "[]");
        await KV.put(`inbox:${key}`, "[]");
        return J({ notifications: inbox }, 200, cors);
      }

      // ── THE TILL ── Stripe Checkout for marketplace offerings.
      if (req.method === "POST" && path === "/stripe/checkout") {
        if (!env.STRIPE_SECRET_KEY) return need("STRIPE_SECRET_KEY", "dashboard.stripe.com → Developers → API keys", cors);
        const { title = "EvolveEarth offering", amountUsd = 0, successUrl, cancelUrl } = await req.json();
        const cents = Math.round(Number(amountUsd) * 100);
        if (!(cents >= 100 && cents <= 500000)) return J({ error: "amountUsd 1–5000" }, 400, cors);
        const form = new URLSearchParams({
          mode: "payment",
          success_url: successUrl || "https://onecoded.github.io/evolveearth/?paid=1",
          cancel_url: cancelUrl || "https://onecoded.github.io/evolveearth/",
          "line_items[0][quantity]": "1",
          "line_items[0][price_data][currency]": "usd",
          "line_items[0][price_data][unit_amount]": String(cents),
          "line_items[0][price_data][product_data][name]": title.slice(0, 120),
        });
        const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
          body: form,
        });
        const data = await r.json();
        if (!r.ok) return J({ error: (data.error && data.error.message) || "stripe error" }, 502, cors);
        return J({ url: data.url, id: data.id }, 200, cors);
      }

      // ── BOOKING RAILS ── Cal.com availability / deep link.
      if (req.method === "GET" && path === "/booking") {
        const user = (url.searchParams.get("user") || "").replace(/[^\w.-]/g, "");
        if (!user) return J({ error: "user= required (cal.com username)" }, 400, cors);
        const link = `https://cal.com/${user}`;
        if (!env.CALCOM_API_KEY) return J({ link, note: "set CALCOM_API_KEY for live availability" }, 200, cors);
        const r = await fetch(`https://api.cal.com/v1/availability?apiKey=${env.CALCOM_API_KEY}&username=${user}`);
        return J({ link, availability: r.ok ? await r.json() : null }, 200, cors);
      }

      // ── THE APOTHECARY FEED ── curated remedies from KV; Amazon links
      // get your associate tag stamped on the way out.
      if (req.method === "GET" && path === "/apothecary") {
        let items = [];
        if (KV) { try { items = JSON.parse(await KV.get("apothecary:feed") || "[]"); } catch (e) {} }
        if (env.AMAZON_TAG) items = items.map((m) => (m.url && /amazon\./.test(m.url)) ? { ...m, url: m.url + (m.url.includes("?") ? "&" : "?") + "tag=" + env.AMAZON_TAG } : m);
        return J({ items, curate: "PUT JSON array into KV key 'apothecary:feed' (same shape as MARKETPLACE_SEED)" }, 200, cors);
      }

      // ── THE BODY ORACLE ── Terra (or any wearable hub) webhooks in,
      // simplified metrics out. The Oracle stops asking how you slept.
      if (req.method === "POST" && path === "/terra/webhook") {
        if (!KV) return need("EE_KV binding", "KV required for body metrics", cors);
        const payload = await req.json();
        const key = (payload.user && (payload.user.reference_id || payload.user.user_id)) || url.searchParams.get("key");
        if (!okKey(String(key || ""))) return J({ ok: true, note: "no reference_id — set the soul-key as reference_id when linking" }, 200, cors);
        const d = (payload.data && payload.data[0]) || {};
        const simplified = {
          t: Date.now(), type: payload.type || "unknown",
          hrv: d.heart_rate_data?.summary?.avg_hrv_rmssd ?? d.hrv?.avg ?? null,
          rhr: d.heart_rate_data?.summary?.resting_hr_bpm ?? null,
          sleepH: d.sleep_durations_data?.asleep?.duration_asleep_state_seconds ? +(d.sleep_durations_data.asleep.duration_asleep_state_seconds / 3600).toFixed(1) : null,
        };
        const hist = JSON.parse(await KV.get(`body:${key}`) || "[]");
        hist.unshift(simplified);
        await KV.put(`body:${key}`, JSON.stringify(hist.slice(0, 60)));
        return J({ ok: true }, 200, cors);
      }
      if (req.method === "GET" && path === "/body") {
        const key = url.searchParams.get("key");
        if (!okKey(key) || !KV) return J({ metrics: [] }, 200, cors);
        return J({ metrics: JSON.parse(await KV.get(`body:${key}`) || "[]") }, 200, cors);
      }

      // ── SOUL CARD HOSTING + PRINT ── store the cast, hand Printful a URL.
      if (req.method === "POST" && path === "/cast") {
        if (!KV) return need("EE_KV binding", "KV required for casts", cors);
        const { png } = await req.json(); // data:image/png;base64,....
        if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png || "") || png.length > 2500000) return J({ error: "png data URL required (<2.5MB)" }, 400, cors);
        const id = (await sha256hex(png)).slice(0, 20);
        const bin = Uint8Array.from(atob(png.split(",")[1]), (c) => c.charCodeAt(0));
        await KV.put(`cast:${id}`, bin.buffer, { expirationTtl: 60 * 60 * 24 * 90 });
        return J({ id, url: `${url.origin}/cast/${id}` }, 200, cors);
      }
      if (req.method === "GET" && path.startsWith("/cast/")) {
        const id = path.slice(6).replace(/[^a-f0-9]/g, "");
        const bin = KV && await KV.get(`cast:${id}`, "arrayBuffer");
        if (!bin) return J({ error: "not found" }, 404, cors);
        return new Response(bin, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400", ...cors } });
      }
      if (req.method === "POST" && path === "/print") {
        if (!env.PRINTFUL_API_KEY) return need("PRINTFUL_API_KEY", "printful.com → Settings → API", cors);
        const { castUrl, recipient, variantId = 3876 } = await req.json(); // 3876 = 12x18 poster
        if (!castUrl || !recipient || !recipient.name) return J({ error: "castUrl + recipient{name,address1,city,country_code,zip} required" }, 400, cors);
        const r = await fetch("https://api.printful.com/orders", {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${env.PRINTFUL_API_KEY}` },
          body: JSON.stringify({ confirm: false, recipient, items: [{ variant_id: variantId, quantity: 1, files: [{ url: castUrl }] }] }),
        });
        const data = await r.json();
        if (!r.ok) return J({ error: (data.error && data.error.message) || "printful error" }, 502, cors);
        return J({ ok: true, draftOrderId: data.result && data.result.id, note: "draft created — confirm in the Printful dashboard" }, 200, cors);
      }

      // ── THE COMMONS ── civilization counters (subgraph lands with chain).
      if (req.method === "GET" && path === "/stats") {
        let stats = { souls: 0, letters: 0 };
        if (KV) { try { stats = JSON.parse(await KV.get("stats") || JSON.stringify(stats)); } catch (e) {} }
        return J({ ...stats, deployments: "https://raw.githubusercontent.com/onecoded/evolveearth/master/EVOLVEEARTH/deployments.json" }, 200, cors);
      }

      if (req.method === "GET" && path === "/") return J({ alive: true, organ: "EvolveEarth Nervous System", routes: ["/oracle", "/sync", "/tts", "/letter", "/ephemeris", "/push/*", "/inbox", "/stripe/checkout", "/booking", "/apothecary", "/terra/webhook", "/body", "/cast", "/print", "/stats"] }, 200, cors);
      return J({ error: "unknown route " + path }, 404, cors);
    } catch (e) {
      return J({ error: String(e).slice(0, 300) }, 500, cors);
    }
  },
};
