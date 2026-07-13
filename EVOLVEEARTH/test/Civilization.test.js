const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("Civilization layer (#5-#10)", function () {
  let soul, prana, pool, registry, dao, market;
  let owner, alice, bob, carol;

  const meta = async (id) =>
    JSON.parse(Buffer.from((await soul.tokenURI(id)).split(",")[1], "base64").toString("utf8"));
  const attr = (m, t) => m.attributes.find((a) => a.trait_type === t).value;

  beforeEach(async function () {
    [owner, alice, bob, carol] = await ethers.getSigners();

    const Soul = await ethers.getContractFactory("SoulSignature");
    soul = await Soul.deploy(); await soul.waitForDeployment();
    const Prana = await ethers.getContractFactory("PranaToken");
    prana = await Prana.deploy(); await prana.waitForDeployment();

    const soulAddr = await soul.getAddress(), pranaAddr = await prana.getAddress();
    pool = await (await ethers.getContractFactory("PranaPool")).deploy(pranaAddr, soulAddr);
    registry = await (await ethers.getContractFactory("InitiationRegistry")).deploy(pranaAddr, soulAddr);
    dao = await (await ethers.getContractFactory("MirrorDAO")).deploy(soulAddr);
    market = await (await ethers.getContractFactory("MedicineStory")).deploy(pranaAddr, soulAddr);

    await soul.setOracle(await registry.getAddress(), true); // registry seals rites onto Prisms

    // Three souls: alice healed-open, bob mixed, carol mostly blocked.
    await soul.mint(alice.address, 58, 28, 14, "Ajna", "Vayu", "2222222", "-------"); // #1
    await soul.mint(bob.address, 34, 33, 33, "Anahata", "Akasha", "2102210", "-V--P--"); // #2
    await soul.mint(carol.address, 20, 40, 40, "Muladhara", "Jala", "0001000", "KKK-KKK"); // #3

    // Fund wallets with PRANA for staking/purchasing.
    for (const w of [alice, bob, carol]) {
      await prana.mintReward(w.address, ethers.parseEther("500"), "test-grant");
    }
  });

  // ── #9 Entangled Prisms ──
  it("entangles two Prisms with mutual consent and renders the bond", async function () {
    await soul.connect(alice).proposeEntangle(1, 2, "union");
    await soul.connect(bob).acceptEntangle(2, 1);
    expect(await soul.entangledWith(1)).to.equal(2);
    expect(await soul.entangledWith(2)).to.equal(1);
    expect(attr(await meta(1), "Entangled")).to.equal("Prism #2");

    await soul.connect(bob).dissolveEntangle(2); // either side may release
    expect(await soul.entangledWith(1)).to.equal(0);
    expect(attr(await meta(1), "Entangled")).to.equal("None");
  });

  it("blocks entangling someone else's Prism without consent", async function () {
    await expect(soul.connect(alice).acceptEntangle(1, 2)).to.be.revertedWith("No offer");
    await expect(soul.connect(carol).proposeEntangle(1, 3, "union")).to.be.revertedWith("Not your Prism");
  });

  // ── #5 Ancestor Stone ──
  it("memorializes a Prism into a soulbound, eternal Ancestor Stone", async function () {
    await soul.connect(carol).setLegacyGuardian(3, bob.address);
    await soul.connect(bob).memorialize(3, "She crossed every gate she was given.", ethers.id("memoir"));

    const m = await meta(3);
    expect(attr(m, "Ancestor")).to.equal("Stone");
    expect(attr(m, "Vitality")).to.equal("Eternal");
    expect(attr(m, "Balance")).to.equal("In Balance"); // a completed life is shown whole
    const svg = Buffer.from(m.image.split(",")[1], "base64").toString("utf8");
    expect(svg).to.include("ANCESTOR STONE");

    // Eternal even after decades of no activity.
    await network.provider.send("evm_increaseTime", [400 * 24 * 3600]);
    await network.provider.send("evm_mine");
    expect(attr(await meta(3), "Vitality")).to.equal("Eternal");

    // Soulbound: it never moves again.
    await expect(
      soul.connect(carol).transferFrom(carol.address, bob.address, 3)
    ).to.be.revertedWith("Ancestor Stones do not move");
  });

  // ── #6 Prana Pool ──
  it("prices premiums by collective flow and pays attested claims", async function () {
    await pool.connect(alice).join(1);
    const healthyBps = await pool.premiumBps(); // alice alone: flow 100 -> 100 bps floor
    await pool.connect(carol).join(3);
    const mixedBps = await pool.premiumBps();   // carol's blocks raise the price
    expect(mixedBps).to.be.greaterThan(healthyBps);

    await prana.connect(alice).approve(await pool.getAddress(), ethers.parseEther("200"));
    await pool.connect(alice).contribute(ethers.parseEther("200"));

    await pool.connect(carol).requestClaim(ethers.parseEther("50"), "somatic therapy after injury");
    await pool.connect(bob).join(2);
    const before = await prana.balanceOf(carol.address);
    await pool.connect(alice).attestClaim(0);
    await pool.connect(bob).attestClaim(0);   // quorum of 2 -> auto-payout
    expect(await prana.balanceOf(carol.address)).to.equal(before + ethers.parseEther("50"));
    await expect(pool.connect(carol).attestClaim(0)).to.be.revertedWith("Cannot attest own claim");
  });

  // ── #7 Initiation Registry ──
  it("stakes, witnesses, and permanently seals a rite onto the Prism", async function () {
    await prana.connect(bob).approve(await registry.getAddress(), ethers.parseEther("20"));
    const sealsBefore = await soul.sealCount(2);
    await registry.connect(bob).beginRite(2, "Eldering", "I take my seat among the elders.", 2, ethers.parseEther("20"));

    await registry.connect(alice).witnessRite(0);
    expect((await registry.rites(0)).sealedRite).to.equal(false);
    const bobBefore = await prana.balanceOf(bob.address);
    await registry.connect(carol).witnessRite(0); // second witness seals it
    const r = await registry.rites(0);
    expect(r.sealedRite).to.equal(true);
    expect(await prana.balanceOf(bob.address)).to.equal(bobBefore + ethers.parseEther("20")); // stake returned
    expect(await soul.sealCount(2)).to.equal(sealsBefore + 1n); // permanent seal on the Prism
    await expect(registry.connect(bob).witnessRite(0)).to.be.revertedWith("Closed");
  });

  // ── #8 Mirror DAO ──
  it("weights votes by balance × consistency, decaying with neglect", async function () {
    expect(await dao.votingPower(1)).to.equal(100); // alice: flow 100, fresh
    expect(await dao.votingPower(3)).to.equal(7);   // carol: one partial gate = flow 7, fresh

    await dao.propose("Fund the grief-tending grove", 100 * 24 * 3600);
    await dao.connect(carol).vote(0, 3, true);

    // Alice neglects her practice for 91 days -> her power decays to 5%.
    await network.provider.send("evm_increaseTime", [91 * 24 * 3600]);
    await network.provider.send("evm_mine");
    expect(await dao.votingPower(1)).to.equal(5);
    await dao.connect(alice).vote(0, 1, false);

    const [forP, againstP, passed] = await dao.result(0);
    expect(forP).to.equal(7);
    expect(againstP).to.equal(5);
    expect(passed).to.equal(true); // the consistent low-flow soul outvotes the lapsed master
  });

  // ── #10 Shadow Market ──
  it("only the healed may mint a Medicine Story; seekers acquire it in $PRANA", async function () {
    // Carol's root (idx 0) is blocked -> she cannot sell that crossing.
    await expect(
      market.connect(carol).mintStory(3, 0, "Out of the Pit", ethers.id("story"), ethers.parseEther("30"))
    ).to.be.revertedWith("Wound not yet healed");

    // Alice's root is open -> she may mint the map of her crossing.
    await market.connect(alice).mintStory(1, 0, "Out of the Pit", ethers.id("story"), ethers.parseEther("30"));
    const m = await market.tokenURI(1);
    const json = JSON.parse(Buffer.from(m.split(",")[1], "base64").toString("utf8"));
    expect(json.attributes.find(a => a.trait_type === "Wound").value).to.equal("Root");

    // Bob acquires: 90% to the wounded healer, 10% to the commons.
    await prana.connect(bob).approve(await market.getAddress(), ethers.parseEther("30"));
    const aliceBefore = await prana.balanceOf(alice.address);
    const ownerBefore = await prana.balanceOf(owner.address);
    await market.connect(bob).acquire(1);
    expect(await market.hasAccess(1, bob.address)).to.equal(true);
    expect(await prana.balanceOf(alice.address)).to.equal(aliceBefore + ethers.parseEther("27"));
    expect(await prana.balanceOf(owner.address)).to.equal(ownerBefore + ethers.parseEther("3"));
    expect((await market.stories(1)).acquisitions).to.equal(1);
  });
});
