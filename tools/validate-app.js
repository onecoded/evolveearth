// CI validator for the single-file app: every inline <script> must parse,
// and the seed datasets must be structurally sound. Run: node tools/validate-app.js
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const APP = path.join(__dirname, "..", "Charka Journey", "chakra-destiny.html");
const html = fs.readFileSync(APP, "utf8");
let failed = false;
const fail = (msg) => { console.error("FAIL " + msg); failed = true; };

// 1) Script-block syntax
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m, i = 0;
const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "chakra-"));
while ((m = re.exec(html))) {
  const f = path.join(tmp, "blk" + i + ".js");
  fs.writeFileSync(f, m[1]);
  try { execSync('node --check "' + f + '"', { stdio: "pipe" }); }
  catch (e) { fail("script block " + i + " syntax: " + e.stderr.toString().split("\n")[0]); }
  i++;
}
console.log("script blocks parsed: " + i);

// 2) Required systems present
["QUESTION_DB_SEED","MARKETPLACE_SEED","HEAL_MODALITIES","buildWitnessScript","_witnessInsights",
 "pranaAward","pranaSpend","vaultExport","buildLightColumn","openSanctum","openDiagnostics",
 "openRhythms","buildMilestones","enterDemoMode","Store"].forEach(k => {
  if (!html.includes(k)) fail("missing system: " + k);
});

// 3) Seed data integrity (brace-matched literal extraction)
function extract(name, open) {
  const s = html.indexOf(name.includes("=") ? name : "const " + name + " ");
  if (s < 0) { fail("cannot find " + name); return null; }
  const b = html.indexOf(open, s);
  const close = open === "[" ? "]" : "}";
  let d = 0;
  for (let j = b; j < html.length; j++) {
    if (html[j] === open) d++;
    else if (html[j] === close && --d === 0) return eval("(" + html.slice(b, j + 1) + ")");
  }
  return null;
}
const scores = new Set(["open","neutral","partial","blocked"]);
const chks = new Set(["root","sacral","solar","heart","throat","thirdeye","crown","any"]);
const qdb = extract("QUESTION_DB_SEED", "[");
if (qdb) {
  if (qdb.length < 21) fail("QUESTION_DB_SEED shrank: " + qdb.length);
  qdb.forEach(q => {
    if (!chks.has(q.chakra)) fail("bad question chakra: " + q.chakra);
    q.opts.forEach(o => { if (!scores.has(o.score)) fail("bad question score: " + o.score); });
  });
  console.log("question seed: " + qdb.length + " OK");
}
const mkt = extract("MARKETPLACE_SEED", "[");
if (mkt) {
  mkt.forEach(x => { if (!chks.has(x.chakra) || !x.title) fail("bad marketplace item: " + JSON.stringify(x).slice(0, 60)); });
  console.log("marketplace seed: " + mkt.length + " OK");
}
const hm = extract("HEAL_MODALITIES", "{");
if (hm && Object.keys(hm).length !== 7) fail("HEAL_MODALITIES must cover 7 chakras");
else if (hm) console.log("heal modalities: 7/7 OK");

if (failed) { console.error("\nVALIDATION FAILED"); process.exit(1); }
console.log("\napp validation: ALL OK");
