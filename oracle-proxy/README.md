# Oracle Proxy — giving the Witnessing Oracle its Claude brain

The app's Oracle runs rule-based reflections by default (offline-safe). Point it
at this deployed worker and every user reply is answered by **Claude itself**,
speaking as the Oracle (the ORACLE_CHARTER is the system prompt), with the
member's own longitudinal record as context. The API key lives only in the
worker — never in the webpage.

## Deploy (10 minutes, free tier is plenty)

1. **Get an API key**: console.anthropic.com → API Keys → Create key.
2. **Create the worker**: dash.cloudflare.com → Workers & Pages → Create →
   "Start from Hello World" → Deploy → **Edit code** → replace everything with
   `worker.js` from this folder → **Deploy**.
3. **Add the secret**: worker → Settings → Variables & Secrets →
   Add → type **Secret** → name `ANTHROPIC_API_KEY` → paste the key → Save.
   (Optional: variable `ALLOWED_ORIGIN` = `https://onecoded.github.io` to lock
   it to the live site; `MODEL` to override the default `claude-sonnet-5`.)
4. **Copy the worker URL** (like `https://oracle.yourname.workers.dev`).
5. **Connect the app**: open the Oracle panel → ⚙ (gear in the header) →
   paste the URL. Stored on the device; clear it the same way.

## Behavior

- With a URL set: user replies go to `POST <url>` as `{messages, corpus}` and
  the Oracle answers with real intelligence. The scripted ceremonies (Mirror /
  Pattern / Question) still open the session — Claude takes over the dialogue.
- Without a URL, or if the call fails: the built-in reflection engine answers.
  The Oracle never goes silent.

## Cost note

Each reply is one small API call (≤500 tokens out). Casual use costs pennies;
set a monthly spend limit in the Anthropic console for peace of mind.
