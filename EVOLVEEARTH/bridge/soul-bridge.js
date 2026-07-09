/**
 * soul-bridge.js
 * ----------------------------------------------------------------------------
 * Converts the output of the Chakra Journey assessment (chakra-destiny.html)
 * into the exact parameters the SoulSignature NFT contract's mint() expects.
 *
 * Works in BOTH Node (require) and the browser (attaches to window.SoulBridge).
 * No dependencies. Pure functions — easy to test.
 *
 * The assessment produces, per the app's own state:
 *   mainAnswers   : { 0..6 -> archetypeKey }   archetype chosen at each gate
 *   lsAnswers     : { 0..6 -> 'open'|'neutral'|'partial'|'blocked' }
 *   healingScores : { 0..6 -> 0..10 }          (optional; from the deep journey)
 *
 * This module turns that into:
 *   { vata, pitta, kapha, dominantChakra, deficientChakra, tribe, sadhanaPoints }
 * which maps 1:1 onto SoulSignature.mint(to, vata, pitta, kapha, chakra, tribe).
 */

// ── Canonical tables (mirror the assessment's ARC + CHAKRAS data) ────────────

// Each archetype maps to one Ayurvedic dosha and a health flag.
const ARCHETYPE_DOSHA = {
  KING:     { dosha: "Kapha", healthy: true  },
  SLEEPER:  { dosha: "Kapha", healthy: false },
  WARRIOR:  { dosha: "Pitta", healthy: true  },
  EGO:      { dosha: "Pitta", healthy: false },
  MAGICIAN: { dosha: "Vata",  healthy: true  },
  AFRAID:   { dosha: "Vata",  healthy: false },
};

// Gate index -> chakra (the assessment's CHAKRAS array order).
const CHAKRA_BY_INDEX = [
  { id: "root",     sanskrit: "Muladhara"    },
  { id: "sacral",   sanskrit: "Svadhisthana" },
  { id: "solar",    sanskrit: "Manipura"     },
  { id: "heart",    sanskrit: "Anahata"      },
  { id: "throat",   sanskrit: "Vishuddha"    },
  { id: "thirdeye", sanskrit: "Ajna"         },
  { id: "crown",    sanskrit: "Sahasrara"    },
];

// Dominant dosha -> elemental tribe (per the EvolveEarth spec).
const DOSHA_TRIBE = { Vata: "Vayu", Pitta: "Agni", Kapha: "Prithvi" };

// ── Helpers ──────────────────────────────────────────────────────────────────

// Round a set of raw percentages to integers that sum to exactly 100
// (largest-remainder method — avoids the "99%" / "101%" rounding bug).
function roundTo100(raw) {
  const keys = Object.keys(raw);
  const floors = {};
  let used = 0;
  keys.forEach((k) => { floors[k] = Math.floor(raw[k]); used += floors[k]; });
  let remainder = 100 - used;
  // Hand the leftover points to the largest fractional parts first.
  const byFrac = keys
    .map((k) => ({ k, frac: raw[k] - Math.floor(raw[k]) }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < byFrac.length && remainder > 0; i++) {
    floors[byFrac[i].k] += 1;
    remainder -= 1;
  }
  return floors;
}

// A 0–100 "flow" score for one gate: how open is this chakra?
function gateFlow(archetypeKey, lsAnswer, healingScore) {
  const arc = ARCHETYPE_DOSHA[archetypeKey];
  let base;
  if (arc && arc.healthy) {
    base = lsAnswer === "open" || lsAnswer === "neutral" ? 85 : 50; // partial
  } else {
    base = lsAnswer === "partial" || lsAnswer === "neutral" ? 40 : 18; // blocked
  }
  // The deep journey can raise a chakra's flow (0–10 -> up to +30).
  const boost = typeof healingScore === "number" ? Math.min(healingScore, 10) * 3 : 0;
  return Math.min(base + boost, 100);
}

// ── Main conversion ──────────────────────────────────────────────────────────

/**
 * @param {object} mainAnswers   { 0..6 -> archetypeKey }
 * @param {object} lsAnswers     { 0..6 -> 'open'|'neutral'|'partial'|'blocked' }
 * @param {object} [healingScores] { 0..6 -> 0..10 }
 * @returns {{vata:number,pitta:number,kapha:number,dominantChakra:string,
 *            deficientChakra:string,tribe:string,sadhanaPoints:number,
 *            flows:object}}
 */
function assessmentToSoul(mainAnswers, lsAnswers, healingScores = {}) {
  const answered = Object.keys(mainAnswers || {}).filter(
    (k) => mainAnswers[k] != null
  );
  if (answered.length === 0) {
    throw new Error("No gates answered — cannot build a Soul Signature.");
  }

  // 1) Dosha percentages — one vote per answered gate.
  const counts = { Vata: 0, Pitta: 0, Kapha: 0 };
  answered.forEach((k) => {
    const arc = ARCHETYPE_DOSHA[mainAnswers[k]];
    if (arc) counts[arc.dosha] += 1;
  });
  const total = counts.Vata + counts.Pitta + counts.Kapha || 1;
  const pct = roundTo100({
    Vata: (counts.Vata / total) * 100,
    Pitta: (counts.Pitta / total) * 100,
    Kapha: (counts.Kapha / total) * 100,
  });

  // 2) Per-chakra flow → dominant (highest) and deficient (lowest).
  const flows = {};
  let dom = { idx: -1, flow: -1 };
  let def = { idx: -1, flow: 101 };
  answered.forEach((k) => {
    const i = Number(k);
    const f = gateFlow(mainAnswers[k], lsAnswers ? lsAnswers[k] : undefined, healingScores[k]);
    flows[CHAKRA_BY_INDEX[i].id] = f;
    if (f > dom.flow) dom = { idx: i, flow: f };
    if (f < def.flow) def = { idx: i, flow: f };
  });
  const dominantChakra = CHAKRA_BY_INDEX[dom.idx].sanskrit;
  const deficientChakra = CHAKRA_BY_INDEX[def.idx].sanskrit;

  // 3) Tribe from the dominant dosha — with mixed-constitution refinements.
  const tribe = pickTribe(pct);

  // 4) Sadhana points — sum of journey healing, or derived from flow if none.
  const sadhanaPoints = Object.keys(healingScores).length
    ? answered.reduce((s, k) => s + (healingScores[k] || 0), 0)
    : Math.round(answered.reduce((s, k) => s + flows[CHAKRA_BY_INDEX[Number(k)].id], 0) / 10);

  // 5) chakraStates — 7 chars (root..crown) for the on-chain balance halo:
  //    '2' open, '1' partial, '0' blocked. Unanswered gates default to '1'.
  let chakraStates = '';
  for (let i = 0; i < 7; i++) {
    const s = lsAnswers ? lsAnswers[i] : undefined;
    chakraStates += (s === 'open' || s === 'neutral') ? '2' : s === 'partial' ? '1' : s === 'blocked' ? '0' : '1';
  }
  const balancePct = Math.round((chakraStates.split('').reduce((a, c) => a + Number(c), 0) * 100) / 14);

  return {
    vata: pct.Vata,
    pitta: pct.Pitta,
    kapha: pct.Kapha,
    dominantChakra,
    deficientChakra,
    tribe,
    sadhanaPoints,
    chakraStates,
    balancePct,
    flows,
  };
}

// Tribe logic: clear single dosha -> its element; near-balance -> Akasha (ether);
// Pitta+Kapha co-dominant -> Jala (water), per the spec's elemental scheme.
function pickTribe(pct) {
  const entries = [
    ["Vata", pct.Vata],
    ["Pitta", pct.Pitta],
    ["Kapha", pct.Kapha],
  ].sort((a, b) => b[1] - a[1]);
  const [topName, topVal] = entries[0];
  const secondVal = entries[1][1];
  const spread = topVal - entries[2][1];

  if (spread <= 12) return "Akasha"; // all three within ~12% → ether/space
  if (topVal - secondVal <= 8) {
    const pair = [entries[0][0], entries[1][0]].sort().join("-");
    if (pair === "Kapha-Pitta") return "Jala"; // water = mixed Pitta-Kapha
  }
  return DOSHA_TRIBE[topName];
}

// ── Exports (Node + browser) ─────────────────────────────────────────────────
const SoulBridge = {
  assessmentToSoul,
  ARCHETYPE_DOSHA,
  CHAKRA_BY_INDEX,
  roundTo100,
};

if (typeof module !== "undefined" && module.exports) module.exports = SoulBridge;
if (typeof window !== "undefined") window.SoulBridge = SoulBridge;
