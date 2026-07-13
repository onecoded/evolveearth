// Mints one Soul Signature to the deployer wallet, then inscribes some sample
// activity (sadhana points + a retreat seal) so you can see the NFT evolve.
//
// Requires SOUL_CONTRACT_ADDRESS in your .env (printed by deploy.js).
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const address = process.env.SOUL_CONTRACT_ADDRESS;
  if (!address) throw new Error("Set SOUL_CONTRACT_ADDRESS in your .env first.");

  const [signer] = await hre.ethers.getSigners();
  const soul = await hre.ethers.getContractAt("SoulSignature", address, signer);

  // Example assessment result — Vata-dominant, Ajna chakra, Vayu (air) tribe.
  console.log("Minting Soul Signature...");
  const tx = await soul.mint(signer.address, 58, 28, 14, "Ajna", "Vayu", "2102210", "-V--P--");
  const receipt = await tx.wait();
  console.log("  mint tx:", receipt.hash);

  const tokenId = (await soul.nextTokenId()) - 1n;
  console.log("  tokenId:", tokenId.toString());

  // Evolve it a little so the on-chain art has seals + an Elder-ish path.
  console.log("Adding 250 sadhana points...");
  await (await soul.addSadhana(tokenId, 250)).wait();

  console.log("Inscribing a retreat Memory Seal...");
  const now = Math.floor(Date.now() / 1000);
  await (await soul.inscribeMemorySeal(tokenId, "Spring Equinox Retreat 2026", now)).wait();

  console.log("\n✅ Done. Run the preview script to view the on-chain art:");
  console.log("   npx hardhat run scripts/preview.js --network", hre.network.name);
  console.log("   (or omit --network to preview on a throwaway local chain)");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
