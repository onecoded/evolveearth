// Proves the full pipeline with no blockchain and no setup:
//   assessment result  ->  soul-bridge  ->  mint() params  ->  on-chain glyph
//
// Run:  npx hardhat run bridge/demo.js
const hre = require("hardhat");
const { assessmentToSoul } = require("./soul-bridge");

// A realistic finished assessment — Vata-leaning, root & throat blocked.
// (gate index: 0 root, 1 sacral, 2 solar, 3 heart, 4 throat, 5 thirdeye, 6 crown)
const mainAnswers = {
  0: "AFRAID",   // root   — anxious Vata
  1: "MAGICIAN", // sacral — dancing Vata
  2: "WARRIOR",  // solar  — balanced Pitta
  3: "KING",     // heart  — balanced Kapha
  4: "AFRAID",   // throat — anxious Vata
  5: "MAGICIAN", // thirdeye — Vata
  6: "WARRIOR",  // crown  — Pitta
};
const lsAnswers = {
  0: "blocked", 1: "open", 2: "open", 3: "open", 4: "partial", 5: "neutral", 6: "open",
};
const healingScores = { 0: 2, 1: 6, 4: 3 }; // some deep-journey progress

async function main() {
  const soul = assessmentToSoul(mainAnswers, lsAnswers, healingScores);

  console.log("\n── Bridge output (assessment → NFT traits) ──");
  console.log(`  Vata/Pitta/Kapha : ${soul.vata} / ${soul.pitta} / ${soul.kapha}  (sum ${soul.vata + soul.pitta + soul.kapha})`);
  console.log(`  Dominant chakra  : ${soul.dominantChakra}`);
  console.log(`  Deficient chakra : ${soul.deficientChakra}`);
  console.log(`  Tribe            : ${soul.tribe}`);
  console.log(`  Sadhana points   : ${soul.sadhanaPoints}`);
  console.log(`  Chakra states    : ${soul.chakraStates}  (balance ${soul.balancePct}%)`);

  // Now mint it on a throwaway local chain and read the on-chain art back.
  const [signer] = await hre.ethers.getSigners();
  const Soul = await hre.ethers.getContractFactory("SoulSignature");
  const c = await Soul.deploy();
  await c.waitForDeployment();

  await (await c.mint(
    signer.address,
    soul.vata, soul.pitta, soul.kapha,
    soul.dominantChakra, soul.tribe, soul.chakraStates
  )).wait();
  await (await c.addSadhana(1, soul.sadhanaPoints)).wait();

  const uri = await c.tokenURI(1);
  const meta = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf8"));
  console.log("\n── Minted token #1 on-chain metadata ──");
  console.log(JSON.stringify(meta.attributes, null, 2));
  console.log(`\n  image: ${meta.image.slice(0, 48)}...  (${meta.image.length} chars, all on-chain)`);
  console.log("\n✅ Pipeline verified: assessment data is now a permanent on-chain glyph.\n");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
