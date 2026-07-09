const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SoulSignature", function () {
  let soul, owner, alice;

  beforeEach(async function () {
    [owner, alice] = await ethers.getSigners();
    const Soul = await ethers.getContractFactory("SoulSignature");
    soul = await Soul.deploy();
    await soul.waitForDeployment();
  });

  it("mints with valid dosha and stores traits", async function () {
    await soul.mint(alice.address, 58, 28, 14, "Ajna", "Vayu", "2102210");
    expect(await soul.ownerOf(1)).to.equal(alice.address);

    const data = await soul.soulData(1);
    expect(data.vataPct).to.equal(58);
    expect(data.tribe).to.equal("Vayu");
    expect(data.tier).to.equal("Seeker");
  });

  it("rejects dosha that does not sum to 100", async function () {
    await expect(
      soul.mint(alice.address, 50, 28, 14, "Ajna", "Vayu", "2102210")
    ).to.be.revertedWith("Dosha must sum to 100");
  });

  it("returns a fully on-chain base64 tokenURI with no external links", async function () {
    await soul.mint(alice.address, 58, 28, 14, "Ajna", "Vayu", "2102210");
    const uri = await soul.tokenURI(1);

    expect(uri.startsWith("data:application/json;base64,")).to.equal(true);

    const json = JSON.parse(
      Buffer.from(uri.split(",")[1], "base64").toString("utf8")
    );
    expect(json.image.startsWith("data:image/svg+xml;base64,")).to.equal(true);

    const svg = Buffer.from(json.image.split(",")[1], "base64").toString("utf8");
    expect(svg).to.include("<svg");
    // Prove nothing is fetched off-chain: no external resource references.
    // (The xmlns="http://www.w3.org/2000/svg" namespace is a declaration, not a fetch.)
    expect(svg).to.not.include("https://");
    expect(svg).to.not.include("ipfs://");
    expect(svg).to.not.include("<image");
    expect(svg).to.not.include("xlink:href");
  });

  it("promotes to Elder at 2500 sadhana points", async function () {
    await soul.mint(alice.address, 58, 28, 14, "Ajna", "Vayu", "2102210");
    await soul.addSadhana(1, 2500);
    const data = await soul.soulData(1);
    expect(data.tier).to.equal("Elder");
  });

  it("inscribes memory seals and reflects them in seal count", async function () {
    await soul.mint(alice.address, 58, 28, 14, "Ajna", "Vayu", "2102210");
    await soul.inscribeMemorySeal(1, "Spring Equinox Retreat 2026", 1750000000);
    await soul.inscribeMemorySeal(1, "Summer Solstice Retreat 2026", 1755000000);
    expect(await soul.sealCount(1)).to.equal(2);
  });

  it("blocks non-oracle accounts from evolving a token", async function () {
    await soul.mint(alice.address, 58, 28, 14, "Ajna", "Vayu", "2102210");
    await expect(
      soul.connect(alice).addSadhana(1, 100)
    ).to.be.revertedWith("Not an oracle");
  });

  it("evolves the on-chain art as sadhana accrues", async function () {
    const svgOf = async (id) => {
      const uri = await soul.tokenURI(id);
      const json = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf8"));
      return Buffer.from(json.image.split(",")[1], "base64").toString("utf8");
    };
    await soul.mint(alice.address, 58, 28, 14, "Ajna", "Vayu", "2102210");
    // Fresh Prism: no gold rings, no seals → no gold at all.
    expect(await svgOf(1)).to.not.include("#c9a84c");

    await soul.addSadhana(1, 150); // stage 1
    const s1 = await svgOf(1);
    expect(s1).to.include("#c9a84c");   // first golden ring appears
    expect(s1).to.include('r="60"');

    await soul.addSadhana(1, 2400); // total 2550 → Elder
    expect(await svgOf(1)).to.include('r="116"'); // Elder gold border
  });

  it("renders the balance halo and reports balance in metadata", async function () {
    const meta = async (id) =>
      JSON.parse(Buffer.from((await soul.tokenURI(id)).split(",")[1], "base64").toString("utf8"));
    const attr = (m, t) => m.attributes.find((a) => a.trait_type === t).value;

    // All centres open → In Balance, full flow.
    await soul.mint(alice.address, 58, 28, 14, "Ajna", "Vayu", "2222222");
    const m1 = await meta(1);
    expect(attr(m1, "Balance")).to.equal("In Balance");
    expect(attr(m1, "Flow")).to.equal(100);

    // Mostly blocked → Out of Balance, with broken (dashed) arcs in the image.
    await soul.mint(alice.address, 58, 28, 14, "Ajna", "Vayu", "0001000");
    const m2 = await meta(2);
    expect(attr(m2, "Balance")).to.equal("Out of Balance");
    const svg2 = Buffer.from(m2.image.split(",")[1], "base64").toString("utf8");
    expect(svg2).to.include("stroke-dasharray"); // blocked arcs are broken

    // A re-test updates the halo.
    await soul.setChakraStates(2, "2222222");
    expect(attr(await meta(2), "Balance")).to.equal("In Balance");
  });
});
