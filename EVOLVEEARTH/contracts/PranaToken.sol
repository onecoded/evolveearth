// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  PranaToken ($PRANA)
 * @notice The life-force reward token of EvolveEarth. It cannot be bought at
 *         launch — the ONLY faucet is verified practice: check-ins, streaks,
 *         quests, level-ups, healing milestones. Minting is restricted to
 *         authorized emitters (the Prism NFT contract + activity oracles).
 *
 *         Evolution Royalties (idea #12) are built in: when a user earns
 *         $PRANA, their referrer automatically receives a percentage on top —
 *         teachers are rewarded for bringing people in AND keeping them
 *         practicing.
 *
 *         Anti-farming: a per-wallet daily mint cap, adjustable by governance.
 */
contract PranaToken is ERC20, Ownable {
    mapping(address => bool)    public emitters;    // contracts/oracles allowed to mint
    mapping(address => address) public referrerOf;  // user -> their guide (set once)
    mapping(address => uint256) public mintedToday; // per-wallet daily tally
    mapping(address => uint256) public lastMintDay;

    uint256 public dailyCap    = 1000e18; // max earned per wallet per day
    uint16  public referralBps = 1000;    // 10% royalty to the referrer

    event RewardMinted(address indexed to, uint256 amount, string reason);
    event ReferralPaid(address indexed referrer, address indexed earner, uint256 amount);
    event ReferrerSet(address indexed user, address indexed referrer);

    constructor() ERC20("Prana", "PRANA") Ownable(msg.sender) {
        emitters[msg.sender] = true;
    }

    modifier onlyEmitter() {
        require(emitters[msg.sender] || msg.sender == owner(), "Not an emitter");
        _;
    }

    function setEmitter(address who, bool allowed) external onlyOwner {
        emitters[who] = allowed;
    }

    function setDailyCap(uint256 cap) external onlyOwner {
        dailyCap = cap;
    }

    function setReferralBps(uint16 bps) external onlyOwner {
        require(bps <= 2000, "Max 20%");
        referralBps = bps;
    }

    /// One-time binding of a user to the guide who brought them in.
    function setReferrer(address user, address referrer) external onlyEmitter {
        require(referrerOf[user] == address(0), "Referrer already set");
        require(referrer != user && referrer != address(0), "Bad referrer");
        referrerOf[user] = referrer;
        emit ReferrerSet(user, referrer);
    }

    /// The single mint path. Earned, never bought.
    function mintReward(address to, uint256 amount, string calldata reason)
        external
        onlyEmitter
    {
        uint256 day = block.timestamp / 1 days;
        if (lastMintDay[to] != day) {
            lastMintDay[to] = day;
            mintedToday[to] = 0;
        }
        require(mintedToday[to] + amount <= dailyCap, "Daily cap reached");
        mintedToday[to] += amount;
        _mint(to, amount);
        emit RewardMinted(to, amount, reason);

        // Evolution royalty — the guide earns as their student evolves.
        address ref = referrerOf[to];
        if (ref != address(0)) {
            uint256 bonus = (amount * referralBps) / 10000;
            if (bonus > 0) {
                _mint(ref, bonus);
                emit ReferralPaid(ref, to, bonus);
            }
        }
    }
}
