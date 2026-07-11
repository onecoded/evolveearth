// Deploys the ENTIRE EvolveEarth suite and wires it together, in order:
//   PranaToken → SoulSignature → PranaPool → InitiationRegistry → MirrorDAO → MedicineStory
//   then: prana.setEmitter(soul), soul.setPrana(prana), soul.setOracle(registry)
// Writes every address into deployments.json (the app + mint widget read it).
//
//   Local rehearsal (no chain, no cost):  npx hardhat run scripts/deploy-all.js
//   Bittensor testnet:                    npx hardhat run scripts/deploy-all.js --network subtensorTestnet
//   Bittensor mainnet (after audit!):     npx hardhat run scripts/deploy-all.js --network subtensor
const hre = require("hardhat");
const fs = require("fs"), path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`network  : ${hre.network.name}`);
  console.log(`deployer : ${deployer.address}`);
  console.log(`balance  : ${hre.ethers.formatEther(bal)} ${hre.network.name.startsWith("subtensor") ? "TAO" : "ETH"}\n`);
  if (bal === 0n && hre.network.name !== "hardhat") {
    throw new Error("Deployer has no gas token. Get test TAO first (Bittensor Discord).");
  }

  const deployed = {};
  async function deploy(name, ...args) {
    const F = await hre.ethers.getContractFactory(name);
    const c = await F.deploy(...args);
    await c.waitForDeployment();
    deployed[name] = await c.getAddress();
    console.log(`✅ ${name.padEnd(19)} ${deployed[name]}`);
    return c;
  }

  // 1) The token and the soul.
  const prana = await deploy("PranaToken");
  const soul = await deploy("SoulSignature");
  // 2) The civilization layer.
  const pool = await deploy("PranaPool", deployed.PranaToken, deployed.SoulSignature);
  const registry = await deploy("InitiationRegistry", deployed.PranaToken, deployed.SoulSignature);
  const dao = await deploy("MirrorDAO", deployed.SoulSignature);
  const market = await deploy("MedicineStory", deployed.PranaToken, deployed.SoulSignature);

  // 3) Wiring — the economy only works connected.
  console.log("\nwiring…");
  await (await prana.setEmitter(deployed.SoulSignature, true)).wait();   // level-ups mint PRANA
  await (await soul.setPrana(deployed.PranaToken)).wait();               // soul knows the token
  await (await soul.setOracle(deployed.InitiationRegistry, true)).wait();// rites seal onto Prisms
  console.log("✅ prana.setEmitter(soul) · soul.setPrana(prana) · soul.setOracle(registry)");

  // 4) Record addresses where every surface can find them.
  const mf = path.join(__dirname, "..", "deployments.json");
  try {
    const manifest = JSON.parse(fs.readFileSync(mf, "utf8"));
    const key = hre.network.name === "subtensor" ? "subtensor"
      : hre.network.name === "subtensorTestnet" ? "subtensorTestnet" : null;
    if (key) {
      Object.assign(manifest.networks[key], deployed, { deployedAt: new Date().toISOString() });
      fs.writeFileSync(mf, JSON.stringify(manifest, null, 2));
      console.log(`✅ deployments.json updated (${key}) — commit & push so the live app finds the contracts.`);
    } else {
      console.log("ℹ local run — deployments.json untouched.");
    }
  } catch (e) { console.log("⚠ deployments.json not updated: " + e.message); }

  // 5) Smoke test — prove the whole economy breathes.
  console.log("\nsmoke test…");
  await (await soul.mint(deployer.address, 58, 28, 14, "Ajna", "Vayu", "2102210")).wait();
  await (await soul.addSadhana(1, 150)).wait(); // Seed→Seeker: should drop 50 PRANA
  const pranaBal = await prana.balanceOf(deployer.address);
  const uri = await soul.tokenURI(1);
  const meta = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf8"));
  const level = meta.attributes.find(a => a.trait_type === "Level").value;
  console.log(`   Prism #1 minted · Level ${level} · PRANA earned: ${hre.ethers.formatEther(pranaBal)}`);
  if (level !== "Seeker" || pranaBal !== hre.ethers.parseEther("50")) throw new Error("Smoke test FAILED");
  console.log("✅ SMOKE TEST PASSED — Prism mints, levels, and pays. The ecosystem is alive.\n");

  console.log("addresses:");
  Object.entries(deployed).forEach(([k, v]) => console.log(`   ${k}: ${v}`));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
