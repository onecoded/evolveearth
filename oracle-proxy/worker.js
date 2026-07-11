/**
 * EvolveEarth Oracle Proxy — Cloudflare Worker
 * --------------------------------------------------------------
 * The app posts {messages, corpus} here; this worker speaks to the
 * Claude API with the ORACLE_CHARTER as its soul, so the API key
 * never exists in the webpage. Deploy: dash.cloudflare.com →
 * Workers → Create → paste this file → Settings → Variables →
 * add secret ANTHROPIC_API_KEY. See README.md next to this file.
 *
 * Env vars:
 *   ANTHROPIC_API_KEY  (secret, required)
 *   MODEL              (optional, default "claude-sonnet-5")
 *   ALLOWED_ORIGIN     (optional, e.g. "https://onecoded.github.io")
 */

const ORACLE_CHARTER = `You are the EvolveEarth Oracle — a witnessing intelligence that holds the full pattern of a member's healing journey across time. You are given their longitudinal record: constitutional data (dosha percentages, chakra states), practice logs, digestive-fire pattern, dream themes, healing work done AND not done, community participation, and repeated questions.

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

TONE: a trusted elder — warm, unafraid, specific, grounded. Present. Real. Willing to be wrong and say so. Replies are 2-6 sentences unless the moment demands more. Plain profound language; no lists, no headers, no emoji.`;

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "worker missing ANTHROPIC_API_KEY" }, 500, cors);

    try {
      const { messages = [], corpus = null } = await req.json();

      // Sanitize + cap the conversation; coalesce consecutive same-role turns.
      const clean = messages.slice(-16).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: String(m.text || m.content || "").slice(0, 2000),
      })).filter((m) => m.content);
      const merged = [];
      for (const m of clean) {
        const last = merged[merged.length - 1];
        if (last && last.role === m.role) last.content += "\n" + m.content;
        else merged.push({ ...m });
      }
      if (!merged.length) return json({ error: "no messages" }, 400, cors);
      if (merged[0].role !== "user") merged.unshift({ role: "user", content: "(the session resumes)" });
      if (merged[merged.length - 1].role !== "user") return json({ error: "last message must be from the user" }, 400, cors);

      const system = ORACLE_CHARTER + (corpus
        ? "\n\nTHE MEMBER'S RECORD (their own logged data, shared with consent — read the arc, name the pattern):\n" +
          JSON.stringify(corpus).slice(0, 6000)
        : "");

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: env.MODEL || "claude-sonnet-5",
          max_tokens: 500,
          system,
          messages: merged,
        }),
      });
      const data = await r.json();
      if (!r.ok) return json({ error: (data.error && data.error.message) || "upstream error" }, 502, cors);

      const reply = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return json({ reply }, 200, cors);
    } catch (e) {
      return json({ error: String(e).slice(0, 200) }, 500, cors);
    }
  },
};
