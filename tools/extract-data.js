// Exports the app's inline datasets to editable JSON snapshots in
// "Charka Journey/data/". One-way for now (the single file stays the source
// of truth so file:// keeps working); reviewers and editors work from these.
// Run: node tools/extract-data.js
const fs = require("fs"), path = require("path");
const APP = path.join(__dirname, "..", "Charka Journey", "chakra-destiny.html");
const OUT = path.join(__dirname, "..", "Charka Journey", "data");
const html = fs.readFileSync(APP, "utf8");
fs.mkdirSync(OUT, { recursive: true });

function extract(name, open) {
  const s = html.indexOf("const " + name + " ");
  if (s < 0) return null;
  const b = html.indexOf(open, s);
  const close = open === "[" ? "]" : "}";
  let d = 0;
  for (let j = b; j < html.length; j++) {
    if (html[j] === open) d++;
    else if (html[j] === close && --d === 0) {
      try { return eval("(" + html.slice(b, j + 1) + ")"); } catch (e) { return null; }
    }
  }
  return null;
}

const SETS = [
  ["QUESTION_DB_SEED", "[", "questions.json"],
  ["MARKETPLACE_SEED", "[", "marketplace.json"],
  ["HEAL_MODALITIES", "{", "heal-modalities.json"],
  ["MOON_KITS", "{", "moon-kits.json"],
  ["DOSHA_DAILY", "{", "dosha-daily.json"],
  ["SYMPTOM_MAP", "[", "symptoms.json"],
  ["MILESTONE_DEFS_META", "[", null], // functions inside — skipped by design
  ["TONGUE_QUIZ", "[", "tongue-quiz.json"],
  ["PULSE_QUIZ", "[", "pulse-quiz.json"],
  ["ARCHIVE_SEED", "[", "archive-seed.json"],
  ["SEED_STORIES", "[", "medicine-stories.json"],
  ["DAILY_ORACLE", "[", "daily-oracle.json"],
];

let n = 0;
for (const [name, open, file] of SETS) {
  if (!file) continue;
  const data = extract(name, open);
  if (data == null) { console.log("skip " + name + " (not extractable)"); continue; }
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(data, null, 2));
  console.log("wrote data/" + file);
  n++;
}
console.log(n + " datasets exported to Charka Journey/data/");
