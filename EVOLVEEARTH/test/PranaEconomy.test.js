const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("Prana Economy (gamified evolution)", function () {
  let soul, prana, owner, alice, bob;

  const meta = async (id) =>
    JSON.parse(Buffer.from((await soul.tokenURI(id)).split(",")[1], "base64").toString("utf8"));
  const attr = (m, t) => m.attributes.find((a) => a.trait_type === t).value;
  const svgOf = (m) => Buffer.from(m.image.split(",")[1], "base64").toString("utf8");

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();
    const Soul = await ethers.getContractFactory("SoulSignature");
    soul = await Soul.deploy();
    await soul.waitForDeployment();
    const Prana = await ethers.getContractFactory("PranaToken");
    prana = await Prana.deploy();
    await prana.waitForDeployment();
    // Authorize the Prism contract to mint rewards, and point it at the token.
    await prana.setEmitter(await soul.getAddress(), true);
    await soul.setPrana(await prana.getAddress());
    await soul.mint(alice.address, 58, 28, 14, "Ajna", "Vayu", "2102210", "-V--P--");
  });

  it("only emitters can mint $PRANA", async function () {
    await expect(
      prana.connect(alice).mintReward(alice.address, 100n * 10n ** 18n, "hack")
    ).to.be.revertedWith("Not an emitter");
  });

  it("level-up drops $PRANA to the Prism holder automatically", async function () {
    expect(await prana.balanceOf(alice.address)).to.equal(0);

    await soul.addSadhana(1, 150); // Seed -> Seeker (stage 1): +50 PRANA
    expect(await prana.balanceOf(alice.address)).to.equal(ethers.parseEther("50"));

    // 150 -> 2550 crosses Adept(100) + Luminary(200) + Elder(500) = +800
    await soul.addSadhana(1, 2400);
    expect(await prana.balanceOf(alice.address)).to.equal(ethers.parseEther("850"));

    const m = await meta(1);
    expect(attr(m, "Level")).to.equal("Elder");
  });

  it("no double rewards within the same level", async function () {
    await soul.addSadhana(1, 150); // Seeker
    await soul.addSadhana(1, 10);  // still Seeker — no drop
    expect(await prana.balanceOf(alice.address)).to.equal(ethers.parseEther("50"));
  });

  it("evolution royalties: the referrer earns 10% on top", async function () {
    await prana.setReferrer(alice.address, bob.address);
    await soul.addSadhana(1, 150); // alice +50, bob +5
    expect(await prana.balanceOf(alice.address)).to.equal(ethers.parseEther("50"));
    expect(await prana.balanceOf(bob.address)).to.equal(ethers.parseEther("5"));
  });

  it("daily cap blocks farming", async function () {
    await prana.setDailyCap(ethers.parseEther("60"));
    await soul.addSadhana(1, 150); // +50 ok
    // Next level would drop +100 > remaining 10 — token reverts, but sadhana
    // logging itself must never brick (the contract swallows the failure).
    await soul.addSadhana(1, 400); // crosses stage 2
    expect(await prana.balanceOf(alice.address)).to.equal(ethers.parseEther("50"));
    expect((await soul.soulData(1)).sadhanaPoints).to.equal(550); // practice still counted
  });

  it("vitality: the Prism dims with neglect and reports it in metadata", async function () {
    expect(attr(await meta(1), "Vitality")).to.equal("Radiant");

    await network.provider.send("evm_increaseTime", [8 * 24 * 3600]); // +8 days
    await network.provider.send("evm_mine");
    const m1 = await meta(1);
    expect(attr(m1, "Vitality")).to.equal("Dimming");
    expect(svgOf(m1)).to.include('opacity="0.55"');

    await network.provider.send("evm_increaseTime", [23 * 24 * 3600]); // +31 days total
    await network.provider.send("evm_mine");
    const m2 = await meta(1);
    expect(attr(m2, "Vitality")).to.equal("Dormant");
    expect(svgOf(m2)).to.include('opacity="0.30"');

    // Care revives it.
    await soul.addSadhana(1, 1);
    expect(attr(await meta(1), "Vitality")).to.equal("Radiant");
  });
});
