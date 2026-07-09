// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// The civilization layer reads the Prism (SoulSignature) as its source of truth.
interface ISoul {
    function ownerOf(uint256 tokenId) external view returns (address);
    function flowOf(uint256 tokenId) external view returns (uint256);          // 0-100 balance
    function chakraStateOf(uint256 tokenId, uint256 idx) external view returns (uint8); // 0/1/2
    function lastActivity(uint256 tokenId) external view returns (uint256);
    function inscribeMemorySeal(uint256 tokenId, string calldata label, uint256 timestamp) external;
}

// ═════════════════════════════════════════════════════════════════
// #6 PRANA POOL — mutual healing pools. Communities self-insure in
// $PRANA; the premium rate falls as the members' collective flow
// rises. The incentive flips from managing sickness to producing
// health. Claims are paid by member attestation, not adjusters.
// ═════════════════════════════════════════════════════════════════
contract PranaPool {
    IERC20 public immutable prana;
    ISoul  public immutable soul;

    struct Claim {
        address claimant;
        uint256 amount;
        string  reason;
        uint256 attestations;
        bool    paid;
    }

    mapping(address => uint256) public memberPrism;   // member -> their Prism id (0 = not a member)
    address[] public members;
    Claim[] public claims;
    mapping(uint256 => mapping(address => bool)) public attested;

    uint256 public constant ATTEST_QUORUM = 2; // MVP: two members must witness a claim

    event Joined(address indexed who, uint256 prismId);
    event Contributed(address indexed who, uint256 amount);
    event ClaimRequested(uint256 indexed id, address indexed who, uint256 amount, string reason);
    event ClaimPaid(uint256 indexed id, address indexed who, uint256 amount);

    constructor(IERC20 prana_, ISoul soul_) { prana = prana_; soul = soul_; }

    function join(uint256 prismId) external {
        require(soul.ownerOf(prismId) == msg.sender, "Not your Prism");
        require(memberPrism[msg.sender] == 0, "Already a member");
        memberPrism[msg.sender] = prismId;
        members.push(msg.sender);
        emit Joined(msg.sender, prismId);
    }

    /// Average balance of all members' Prisms — the pool's health signal.
    function collectiveFlow() public view returns (uint256) {
        if (members.length == 0) return 0;
        uint256 sum;
        for (uint256 i = 0; i < members.length; i++) sum += soul.flowOf(memberPrism[members[i]]);
        return sum / members.length;
    }

    /// Premium in basis points: 10% when the pool is fully blocked, falling
    /// toward 1% as collective flow approaches 100. Health lowers the price.
    function premiumBps() public view returns (uint256) {
        uint256 f = collectiveFlow();
        uint256 bps = 1000 - (f * 9);          // 1000 -> 100 as flow 0 -> 100
        return bps < 100 ? 100 : bps;
    }

    function contribute(uint256 amount) external {
        require(memberPrism[msg.sender] != 0, "Join first");
        require(prana.transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit Contributed(msg.sender, amount);
    }

    function requestClaim(uint256 amount, string calldata reason) external returns (uint256 id) {
        require(memberPrism[msg.sender] != 0, "Join first");
        require(amount <= prana.balanceOf(address(this)), "Exceeds pool");
        claims.push(Claim(msg.sender, amount, reason, 0, false));
        id = claims.length - 1;
        emit ClaimRequested(id, msg.sender, amount, reason);
    }

    function attestClaim(uint256 id) external {
        Claim storage c = claims[id];
        require(memberPrism[msg.sender] != 0, "Members only");
        require(msg.sender != c.claimant, "Cannot attest own claim");
        require(!attested[id][msg.sender], "Already attested");
        require(!c.paid, "Already paid");
        attested[id][msg.sender] = true;
        c.attestations++;
        if (c.attestations >= ATTEST_QUORUM && c.amount <= prana.balanceOf(address(this))) {
            c.paid = true;
            require(prana.transfer(c.claimant, c.amount), "payout failed");
            emit ClaimPaid(id, c.claimant, c.amount);
        }
    }

    function memberCount() external view returns (uint256) { return members.length; }
}

// ═════════════════════════════════════════════════════════════════
// #7 INITIATION REGISTRY — the infrastructure of rites of passage.
// A rite is declared, staked, witnessed, and permanently sealed —
// onto the chain and onto the initiate's Prism.
// ═════════════════════════════════════════════════════════════════
contract InitiationRegistry is Ownable {
    IERC20 public immutable prana;
    ISoul  public immutable soul;

    struct Rite {
        uint256 tokenId;
        address initiate;
        string  riteType;      // coming-of-age / union / grief / eldering / crossing...
        string  declaration;   // the vow, spoken
        uint256 stake;
        uint8   required;      // witnesses needed
        uint8   witnessed;
        bool    sealedRite;
        bool    cancelled;
    }

    Rite[] public rites;
    mapping(uint256 => mapping(address => bool)) public hasWitnessed;

    event RiteBegun(uint256 indexed id, address indexed initiate, string riteType);
    event RiteWitnessed(uint256 indexed id, address indexed witness, uint8 count);
    event RiteSealed(uint256 indexed id, uint256 indexed tokenId, string riteType);

    constructor(IERC20 prana_, ISoul soul_) Ownable(msg.sender) { prana = prana_; soul = soul_; }

    function beginRite(
        uint256 tokenId,
        string calldata riteType,
        string calldata declaration,
        uint8 requiredWitnesses,
        uint256 stake
    ) external returns (uint256 id) {
        require(soul.ownerOf(tokenId) == msg.sender, "Not your Prism");
        require(requiredWitnesses >= 1 && requiredWitnesses <= 7, "1-7 witnesses");
        if (stake > 0) require(prana.transferFrom(msg.sender, address(this), stake), "stake failed");
        rites.push(Rite(tokenId, msg.sender, riteType, declaration, stake, requiredWitnesses, 0, false, false));
        id = rites.length - 1;
        emit RiteBegun(id, msg.sender, riteType);
    }

    function witnessRite(uint256 id) external {
        Rite storage r = rites[id];
        require(!r.sealedRite && !r.cancelled, "Closed");
        require(msg.sender != r.initiate, "Cannot witness own rite");
        require(!hasWitnessed[id][msg.sender], "Already witnessed");
        hasWitnessed[id][msg.sender] = true;
        r.witnessed++;
        emit RiteWitnessed(id, msg.sender, r.witnessed);

        if (r.witnessed >= r.required) {
            r.sealedRite = true;
            if (r.stake > 0) require(prana.transfer(r.initiate, r.stake), "stake return failed");
            // Permanent seal on the initiate's Prism (registry must be a soul oracle).
            try soul.inscribeMemorySeal(r.tokenId, r.riteType, block.timestamp) {} catch {}
            emit RiteSealed(id, r.tokenId, r.riteType);
        }
    }

    /// Abandoning a vow forfeits the stake to the community fund.
    function cancelRite(uint256 id) external {
        Rite storage r = rites[id];
        require(msg.sender == r.initiate, "Not initiate");
        require(!r.sealedRite && !r.cancelled, "Closed");
        r.cancelled = true;
    }

    function sweepForfeits(address to, uint256 amount) external onlyOwner {
        require(prana.transfer(to, amount), "sweep failed");
    }

    function riteCount() external view returns (uint256) { return rites.length; }
}

// ═════════════════════════════════════════════════════════════════
// #8 MIRROR DAO — governance weighted by inner coherence.
// Voting power = balance × consistency, decaying with neglect.
// Power must be continuously earned through practice.
// ═════════════════════════════════════════════════════════════════
contract MirrorDAO {
    ISoul public immutable soul;

    struct Proposal {
        string  description;
        uint256 deadline;
        uint256 forPower;
        uint256 againstPower;
    }

    Proposal[] public proposals;
    mapping(uint256 => mapping(uint256 => bool)) public voted; // proposal -> prism -> voted

    event Proposed(uint256 indexed id, string description);
    event Voted(uint256 indexed id, uint256 indexed prismId, bool support, uint256 power);

    constructor(ISoul soul_) { soul = soul_; }

    /// balance (0-100) × consistency factor. Neglect decays power toward zero.
    function votingPower(uint256 prismId) public view returns (uint256) {
        uint256 flow = soul.flowOf(prismId);
        uint256 last = soul.lastActivity(prismId);
        if (last == 0) return 0;
        uint256 idle = block.timestamp - last;
        uint256 factor =
            idle <= 7 days  ? 100 :
            idle <= 30 days ? 60  :
            idle <= 90 days ? 25  : 5;
        return (flow * factor) / 100;
    }

    function propose(string calldata description, uint256 votingSeconds) external returns (uint256 id) {
        proposals.push(Proposal(description, block.timestamp + votingSeconds, 0, 0));
        id = proposals.length - 1;
        emit Proposed(id, description);
    }

    function vote(uint256 id, uint256 prismId, bool support) external {
        require(soul.ownerOf(prismId) == msg.sender, "Not your Prism");
        Proposal storage p = proposals[id];
        require(block.timestamp <= p.deadline, "Voting closed");
        require(!voted[id][prismId], "Already voted");
        uint256 power = votingPower(prismId);
        require(power > 0, "No coherence, no vote");
        voted[id][prismId] = true;
        if (support) p.forPower += power; else p.againstPower += power;
        emit Voted(id, prismId, support, power);
    }

    function result(uint256 id) external view returns (uint256 forP, uint256 againstP, bool passed) {
        Proposal storage p = proposals[id];
        return (p.forPower, p.againstPower, p.forPower > p.againstPower);
    }

    function proposalCount() external view returns (uint256) { return proposals.length; }
}

// ═════════════════════════════════════════════════════════════════
// #10 THE SHADOW MARKET — Medicine Stories. Only a soul whose wound
// is verifiably healed (that chakra open on their Prism) may mint the
// story of the crossing. Others facing the same darkness acquire it —
// suffering, once transmuted, becomes wealth.
// ═════════════════════════════════════════════════════════════════
contract MedicineStory is ERC721, Ownable {
    using Strings for uint256;

    IERC20 public immutable prana;
    ISoul  public immutable soul;

    struct Story {
        address author;
        uint256 prismId;
        uint8   chakraIdx;   // 0..6 root..crown — the wound that was crossed
        string  title;
        bytes32 contentHash; // hash of narrative + protocol (content served off-chain)
        uint256 price;       // in $PRANA
        uint256 acquisitions;
    }

    uint256 public nextId = 1;
    mapping(uint256 => Story) public stories;
    mapping(uint256 => mapping(address => bool)) public hasAccess;
    uint16 public constant AUTHOR_BPS = 9000; // 90% author / 10% commons

    string[7] private CHAKRA_NAMES = ["Root","Sacral","Solar","Heart","Throat","Third Eye","Crown"];

    event StoryMinted(uint256 indexed id, address indexed author, uint8 chakraIdx, string title);
    event StoryAcquired(uint256 indexed id, address indexed seeker, uint256 price);

    constructor(IERC20 prana_, ISoul soul_) ERC721("Medicine Story", "MEDSTORY") Ownable(msg.sender) {
        prana = prana_; soul = soul_;
    }

    /// Only the healed may sell the map of the crossing.
    function mintStory(
        uint256 prismId,
        uint8 chakraIdx,
        string calldata title,
        bytes32 contentHash,
        uint256 price
    ) external returns (uint256 id) {
        require(soul.ownerOf(prismId) == msg.sender, "Not your Prism");
        require(chakraIdx < 7, "Bad chakra");
        require(soul.chakraStateOf(prismId, chakraIdx) == 2, "Wound not yet healed");
        id = nextId++;
        stories[id] = Story(msg.sender, prismId, chakraIdx, title, contentHash, price, 0);
        _safeMint(msg.sender, id);
        hasAccess[id][msg.sender] = true;
        emit StoryMinted(id, msg.sender, chakraIdx, title);
    }

    function acquire(uint256 id) external {
        Story storage s = stories[id];
        require(s.author != address(0), "No story");
        require(!hasAccess[id][msg.sender], "Already acquired");
        if (s.price > 0) {
            uint256 toAuthor = (s.price * AUTHOR_BPS) / 10000;
            require(prana.transferFrom(msg.sender, s.author, toAuthor), "author pay failed");
            require(prana.transferFrom(msg.sender, owner(), s.price - toAuthor), "commons pay failed");
        }
        hasAccess[id][msg.sender] = true;
        s.acquisitions++;
        emit StoryAcquired(id, msg.sender, s.price);
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        require(_ownerOf(id) != address(0), "Nonexistent");
        Story memory s = stories[id];
        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"Medicine Story #', id.toString(), ': ', s.title, '",',
            '"description":"The verified map of a crossing - minted only by a soul whose wound is healed on-chain.",',
            '"attributes":[',
                '{"trait_type":"Wound","value":"', CHAKRA_NAMES[s.chakraIdx], '"},',
                '{"trait_type":"Souls Guided","value":', s.acquisitions.toString(), '},',
                '{"trait_type":"Archetype","value":"Wounded Healer"}',
            ']}'
        ))));
        return string(abi.encodePacked("data:application/json;base64,", json));
    }
}
