// Deploys the SoulSignature contract to whichever network you pass with
//   --network <name>   (omit it to deploy to the local in-memory chain).
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Network:   ", hre.network.name);
  console.log("Deployer:  ", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:   ", hre.ethers.formatEther(balance), "ETH\n");

  const Soul = await hre.ethers.getContractFactory("SoulSignature");
  const soul = await Soul.deploy();
  await soul.waitForDeployment();

  const address = await soul.getAddress();
  console.log("✅ SoulSignature deployed to:", address);
  console.log("\nNext: put this in your .env so the other scripts can find it:");
  console.log(`   SOUL_CONTRACT_ADDRESS=${address}`);

  // Record the address in the deploy manifest so every surface (app, mint
  // widget, desktop clone) finds the contracts without hand-editing.
  try {
    const fs = require("fs"), path = require("path");
    const mf = path.join(__dirname, "..", "deployments.json");
    const manifest = JSON.parse(fs.readFileSync(mf, "utf8"));
    const key = hre.network.name === "subtensor" ? "subtensor"
      : hre.network.name === "subtensorTestnet" ? "subtensorTestnet" : null;
    if (key) {
      manifest.networks[key].SoulSignature = address;
      manifest.networks[key].deployedAt = new Date().toISOString();
      fs.writeFileSync(mf, JSON.stringify(manifest, null, 2));
      console.log(`   deployments.json updated (${key}).`);
    }
  } catch (e) { console.log("   (deployments.json not updated: " + e.message + ")"); }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
