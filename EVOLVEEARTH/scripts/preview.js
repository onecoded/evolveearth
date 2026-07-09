// Reads tokenURI(1) straight from the contract, decodes the base64 metadata
// and the base64 SVG inside it, and writes a local HTML file you can open in a
// browser to SEE the fully on-chain art. Proves the image needs no server.
//
// Requires SOUL_CONTRACT_ADDRESS in your .env. Pass --network to read a live
// deployment, or omit it and the script will deploy+mint on a throwaway local
// chain so you can preview with zero setup.
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function getContract() {
  const address = process.env.SOUL_CONTRACT_ADDRESS;

  // Live network + known address: just attach.
  if (address && hre.network.name !== "hardhat") {
    const [signer] = await hre.ethers.getSigners();
    return { soul: await hre.ethers.getContractAt("SoulSignature", address, signer), tokenId: 1n };
  }

  // No address / local chain: deploy + mint a sample so preview "just works".
  console.log("No live deployment given — deploying a sample on the local chain...");
  const [signer] = await hre.ethers.getSigners();
  const Soul = await hre.ethers.getContractFactory("SoulSignature");
  const soul = await Soul.deploy();
  await soul.waitForDeployment();
  await (await soul.mint(signer.address, 58, 28, 14, "Ajna", "Vayu", "2102210")).wait();
  await (await soul.addSadhana(1, 250)).wait();
  await (await soul.inscribeMemorySeal(1, "Spring Equinox Retreat 2026", 1750000000)).wait();
  return { soul, tokenId: 1n };
}

function decodeDataUri(uri) {
  const base64 = uri.split(",")[1];
  return Buffer.from(base64, "base64").toString("utf8");
}

async function main() {
  const { soul, tokenId } = await getContract();

  const uri = await soul.tokenURI(tokenId);
  const metadata = JSON.parse(decodeDataUri(uri));
  const svg = decodeDataUri(metadata.image);

  console.log("\nMetadata (decoded from on-chain base64):");
  console.log(JSON.stringify(metadata, null, 2));

  const outPath = path.join(__dirname, "..", `preview-token-${tokenId}.html`);
  const html = `<!doctype html><meta charset="utf8">
<body style="background:#0a0a0f;color:#e8e4d9;font-family:monospace;text-align:center;padding:40px">
<h2>Soul Signature #${tokenId} — 100% on-chain</h2>
<div>${svg}</div>
<pre style="text-align:left;max-width:640px;margin:24px auto;white-space:pre-wrap">${
    JSON.stringify(metadata.attributes, null, 2)
  }</pre>
<p style="color:#4a4460">This page contains NO links. The image above was decoded from the contract.</p>
</body>`;
  fs.writeFileSync(outPath, html);
  console.log("\n✅ Wrote", outPath);
  console.log("   Open it in your browser to see the on-chain art.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
