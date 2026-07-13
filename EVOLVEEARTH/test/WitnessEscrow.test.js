const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WitnessEscrow — the attention economy with teeth", () => {
  let prana, escrow, owner, seeker, witness;
  const FEE = ethers.parseEther("20");

  beforeEach(async () => {
    [owner, seeker, witness] = await ethers.getSigners();
    prana = await (await ethers.getContractFactory("PranaToken")).deploy();
    escrow = await (await ethers.getContractFactory("WitnessEscrow")).deploy(await prana.getAddress());
    // fund the seeker
    await prana.setEmitter(owner.address, true);
    await prana.mintReward(seeker.address, ethers.parseEther("100"), "seed");
    await prana.connect(seeker).approve(await escrow.getAddress(), ethers.parseEther("100"));
  });

  it("books, double-attests, and releases to the witness", async () => {
    await escrow.connect(seeker).book(witness.address, FEE);
    await escrow.connect(seeker).attest(1);
    expect(await prana.balanceOf(witness.address)).to.equal(0); // one signature is a claim
    await escrow.connect(witness).attest(1);
    expect(await prana.balanceOf(witness.address)).to.equal(FEE); // two are a ceremony
    expect((await escrow.sessions(1)).status).to.equal(2); // Released
  });

  it("seeker can refund before the witness attests", async () => {
    await escrow.connect(seeker).book(witness.address, FEE);
    const before = await prana.balanceOf(seeker.address);
    await escrow.connect(seeker).refund(1);
    expect(await prana.balanceOf(seeker.address)).to.equal(before + FEE);
  });

  it("seeker cannot refund after witness attested (until timeout)", async () => {
    await escrow.connect(seeker).book(witness.address, FEE);
    await escrow.connect(witness).attest(1);
    await expect(escrow.connect(seeker).refund(1)).to.be.revertedWith("Cannot refund");
    await ethers.provider.send("evm_increaseTime", [15 * 86400]);
    await ethers.provider.send("evm_mine");
    await escrow.connect(seeker).refund(1); // ghosted witness ≠ hostage funds
    expect((await escrow.sessions(1)).status).to.equal(3); // Refunded
  });

  it("arbiter can release when the seeker ghosts a real session", async () => {
    await escrow.connect(seeker).book(witness.address, FEE);
    await escrow.connect(witness).attest(1);
    await escrow.connect(owner).arbiterRelease(1);
    expect(await prana.balanceOf(witness.address)).to.equal(FEE);
  });

  it("strangers cannot attest or refund", async () => {
    await escrow.connect(seeker).book(witness.address, FEE);
    await expect(escrow.connect(owner).attest(1)).to.be.revertedWith("Not a party");
  });
});
