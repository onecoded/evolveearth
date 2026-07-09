// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title  SoulSignature
 * @notice Fully on-chain healing-passport NFT for the EvolveEarth ecosystem.
 *         The image (an SVG dosha/chakra mandala) is generated inside the
 *         contract and returned as a base64 data URI from tokenURI(). There is
 *         no IPFS, no hosted server, no external link — the art IS the contract.
 *
 *         Same pattern as Nouns / Loot / Autoglyphs. The token survives any
 *         server, company, or gateway going offline.
 */
interface IPrana {
    function mintReward(address to, uint256 amount, string calldata reason) external;
}

contract SoulSignature is ERC721, Ownable {
    using Strings for uint256;

    // ─────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────

    struct Seal {
        string  label;      // e.g. "Spring Equinox Retreat 2026"
        uint256 timestamp;  // when it was inscribed
    }

    struct SoulData {
        uint8   vataPct;        // 0-100  (vata + pitta + kapha must == 100)
        uint8   pittaPct;
        uint8   kaphaPct;
        string  dominantChakra; // e.g. "Ajna"
        string  tribe;          // Akasha / Vayu / Agni / Jala / Prithvi
        string  tier;           // Seeker / Practitioner / Elder
        uint256 sadhanaPoints;  // accumulated daily-practice points
        string  chakraStates;   // 7 chars root..crown: '2' open / '1' partial / '0' blocked
    }

    uint256 public nextTokenId = 1;

    mapping(uint256 => SoulData) public soulData;
    mapping(uint256 => Seal[])   private _seals;
    mapping(address => bool)     public oracles; // trusted updaters (multisig in prod)

    // ── Gamified evolution ──
    // XP level names per stage (thresholds in _stage: 0/100/500/1000/2500).
    // $PRANA dropped to the holder when a level is crossed (idea #2).
    address public prana; // PranaToken; zero = rewards off (never blocks sadhana)
    mapping(uint256 => uint256) public lastActivity; // tokenId -> last practice timestamp

    event LevelUp(uint256 indexed tokenId, uint256 newLevel, string levelName);

    function levelName(uint256 stage) public pure returns (string memory) {
        if (stage >= 4) return "Elder";
        if (stage == 3) return "Luminary";
        if (stage == 2) return "Adept";
        if (stage == 1) return "Seeker";
        return "Seed";
    }

    function _levelReward(uint256 stage) internal pure returns (uint256) {
        if (stage >= 4) return 500e18;
        if (stage == 3) return 200e18;
        if (stage == 2) return 100e18;
        if (stage == 1) return 50e18;
        return 0;
    }

    function setPrana(address token) external onlyOwner {
        prana = token;
    }

    // ── Read-helpers for the civilization layer (pools, DAO, market) ──
    function flowOf(uint256 tokenId) public view returns (uint256) {
        return _balancePct(soulData[tokenId].chakraStates);
    }

    /// 0 blocked / 1 partial / 2 open for chakra index 0..6 (root..crown).
    function chakraStateOf(uint256 tokenId, uint256 idx) public view returns (uint8) {
        bytes memory s = bytes(soulData[tokenId].chakraStates);
        if (idx >= s.length) return 1;
        if (s[idx] == "2") return 2;
        if (s[idx] == "1") return 1;
        return 0;
    }

    // ═══════════════════════════════════════════════════════════
    // ENTANGLED PRISMS — the bond as the atom. Two souls may, with
    // mutual consent, entangle their Prisms; each glyph then carries
    // the other. Either side may dissolve (life happens).
    // ═══════════════════════════════════════════════════════════
    mapping(uint256 => uint256) public entangledWith;                 // tokenId -> partner (0 = none)
    mapping(uint256 => string)  public bondType;                      // "union" / "kindred" / "blood"
    mapping(uint256 => mapping(uint256 => bool)) private _entangleOffer;

    event Entangled(uint256 indexed a, uint256 indexed b, string bond);
    event Dissolved(uint256 indexed a, uint256 indexed b);

    function proposeEntangle(uint256 mine, uint256 theirs, string calldata bond) external {
        require(ownerOf(mine) == msg.sender, "Not your Prism");
        require(mine != theirs && _ownerOf(theirs) != address(0), "Bad partner");
        require(entangledWith[mine] == 0 && entangledWith[theirs] == 0, "Already entangled");
        _entangleOffer[mine][theirs] = true;
        bondType[mine] = bond;
    }

    function acceptEntangle(uint256 mine, uint256 theirs) external {
        require(ownerOf(mine) == msg.sender, "Not your Prism");
        require(_entangleOffer[theirs][mine], "No offer");
        require(entangledWith[mine] == 0 && entangledWith[theirs] == 0, "Already entangled");
        entangledWith[mine] = theirs;
        entangledWith[theirs] = mine;
        bondType[mine] = bondType[theirs];
        delete _entangleOffer[theirs][mine];
        emit Entangled(theirs, mine, bondType[mine]);
        emit MetadataUpdate(mine);
        emit MetadataUpdate(theirs);
    }

    function dissolveEntangle(uint256 mine) external {
        require(ownerOf(mine) == msg.sender, "Not your Prism");
        uint256 other = entangledWith[mine];
        require(other != 0, "Not entangled");
        entangledWith[mine] = 0;
        entangledWith[other] = 0;
        emit Dissolved(mine, other);
        emit MetadataUpdate(mine);
        emit MetadataUpdate(other);
    }

    // ═══════════════════════════════════════════════════════════
    // THE ANCESTOR STONE — a death protocol. At the end of a life the
    // Prism transmutes: permanent, soulbound, gold-framed, complete.
    // Descendants sit with it; it never dims and never moves again.
    // ═══════════════════════════════════════════════════════════
    mapping(uint256 => bool)    public isAncestorStone;
    mapping(uint256 => address) public legacyGuardian;  // who may memorialize
    mapping(uint256 => string)  public epitaph;
    mapping(uint256 => bytes32) public memoirHash;      // hash of consented writings (oracle seed)

    event Memorialized(uint256 indexed tokenId, string epitaph);

    function setLegacyGuardian(uint256 tokenId, address guardian) external {
        require(ownerOf(tokenId) == msg.sender, "Not your Prism");
        legacyGuardian[tokenId] = guardian;
    }

    function memorialize(uint256 tokenId, string calldata epitaph_, bytes32 memoirHash_) external {
        require(msg.sender == _ownerOf(tokenId) || msg.sender == legacyGuardian[tokenId], "Not guardian");
        require(!isAncestorStone[tokenId], "Already a Stone");
        isAncestorStone[tokenId] = true;
        epitaph[tokenId] = epitaph_;
        memoirHash[tokenId] = memoirHash_;
        // A completed life is shown whole: the halo closes.
        soulData[tokenId].chakraStates = "2222222";
        emit Memorialized(tokenId, epitaph_);
        emit MetadataUpdate(tokenId);
    }

    /// Ancestor Stones are soulbound — they never move again.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        require(!isAncestorStone[tokenId] || _ownerOf(tokenId) == address(0), "Ancestor Stones do not move");
        return super._update(to, tokenId, auth);
    }

    // ─────────────────────────────────────────────────────────────
    // Events  (EIP-4906 style — lets marketplaces refresh metadata)
    // ─────────────────────────────────────────────────────────────

    event MetadataUpdate(uint256 _tokenId);
    event SealInscribed(uint256 indexed tokenId, string label, uint256 timestamp);
    event SadhanaUpdated(uint256 indexed tokenId, uint256 newTotal);
    event TierChanged(uint256 indexed tokenId, string newTier);

    // ─────────────────────────────────────────────────────────────

    modifier onlyOracle() {
        require(oracles[msg.sender] || msg.sender == owner(), "Not an oracle");
        _;
    }

    constructor() ERC721("Prism", "PRISM") Ownable(msg.sender) {
        oracles[msg.sender] = true;
    }

    // ─────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────

    function setOracle(address who, bool allowed) external onlyOwner {
        oracles[who] = allowed;
    }

    // ─────────────────────────────────────────────────────────────
    // Mint  (called when a user completes the dosha/chakra assessment)
    // ─────────────────────────────────────────────────────────────

    function mint(
        address to,
        uint8 vata,
        uint8 pitta,
        uint8 kapha,
        string calldata dominantChakra,
        string calldata tribe,
        string calldata chakraStates
    ) external returns (uint256 tokenId) {
        require(uint16(vata) + pitta + kapha == 100, "Dosha must sum to 100");

        tokenId = nextTokenId++;
        soulData[tokenId] = SoulData({
            vataPct: vata,
            pittaPct: pitta,
            kaphaPct: kapha,
            dominantChakra: dominantChakra,
            tribe: tribe,
            tier: "Seeker",
            sadhanaPoints: 0,
            chakraStates: chakraStates
        });

        _safeMint(to, tokenId);
        lastActivity[tokenId] = block.timestamp;
    }

    // ─────────────────────────────────────────────────────────────
    // Evolution  (the NFT changes as the holder heals)
    // ─────────────────────────────────────────────────────────────

    /// Quarterly trait refresh — your constitution shifts with the seasons.
    function updateTraits(uint256 tokenId, uint8 vata, uint8 pitta, uint8 kapha)
        external
        onlyOracle
    {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        require(uint16(vata) + pitta + kapha == 100, "Dosha must sum to 100");

        SoulData storage s = soulData[tokenId];
        s.vataPct = vata;
        s.pittaPct = pitta;
        s.kaphaPct = kapha;

        emit MetadataUpdate(tokenId);
    }

    /// Re-tests change which centres are open — update the balance halo.
    function setChakraStates(uint256 tokenId, string calldata states) external onlyOracle {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        soulData[tokenId].chakraStates = states;
        lastActivity[tokenId] = block.timestamp;
        emit MetadataUpdate(tokenId);
    }

    /// Proof-of-Sadhana — daily practice points, batched on-chain by an oracle.
    /// Crossing an XP level (Seed→Seeker→Adept→Luminary→Elder) drops $PRANA
    /// to the holder automatically. Practice IS the faucet.
    function addSadhana(uint256 tokenId, uint256 points) external onlyOracle {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");

        SoulData storage s = soulData[tokenId];
        uint256 before = _stage(s.sadhanaPoints);
        s.sadhanaPoints += points;
        uint256 after_ = _stage(s.sadhanaPoints);
        lastActivity[tokenId] = block.timestamp;

        // Tier promotion thresholds (Elder is the highest auto-tier).
        if (s.sadhanaPoints >= 2500 && _notEqual(s.tier, "Elder")) {
            s.tier = "Elder";
            emit TierChanged(tokenId, "Elder");
        }

        // Level-up ceremony: one $PRANA drop per level crossed.
        if (after_ > before && prana != address(0)) {
            uint256 total;
            for (uint256 st = before + 1; st <= after_; st++) total += _levelReward(st);
            emit LevelUp(tokenId, after_, levelName(after_));
            // Rewards must never brick practice-logging — swallow token failures.
            try IPrana(prana).mintReward(ownerOf(tokenId), total, "level-up") {} catch {}
        }

        emit SadhanaUpdated(tokenId, s.sadhanaPoints);
        emit MetadataUpdate(tokenId);
    }

    /// Retreat attendance verified at the event → a Memory Seal is inscribed.
    function inscribeMemorySeal(uint256 tokenId, string calldata label, uint256 timestamp)
        external
        onlyOracle
    {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");

        _seals[tokenId].push(Seal(label, timestamp));
        lastActivity[tokenId] = block.timestamp;
        emit SealInscribed(tokenId, label, timestamp);
        emit MetadataUpdate(tokenId);
    }

    function sealCount(uint256 tokenId) public view returns (uint256) {
        return _seals[tokenId].length;
    }

    function getSeal(uint256 tokenId, uint256 index)
        external
        view
        returns (string memory label, uint256 timestamp)
    {
        Seal memory s = _seals[tokenId][index];
        return (s.label, s.timestamp);
    }

    // ─────────────────────────────────────────────────────────────
    // tokenURI — builds the full metadata JSON + image, all on-chain
    // ─────────────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        SoulData memory soul = soulData[tokenId];

        string memory svg = _buildSVG(tokenId, soul);

        string memory image = string(abi.encodePacked(
            "data:image/svg+xml;base64,",
            Base64.encode(bytes(svg))
        ));

        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"Prism #', tokenId.toString(), '",',
            '"description":"A living Prism of your energy field on EvolveEarth. White light refracted into your unique dosha/chakra signature. All image data is stored on-chain.",',
            '"image":"', image, '",',
            '"attributes":[',
                '{"trait_type":"Vata","value":',  uint256(soul.vataPct).toString(),  '},',
                '{"trait_type":"Pitta","value":', uint256(soul.pittaPct).toString(), '},',
                '{"trait_type":"Kapha","value":', uint256(soul.kaphaPct).toString(), '},',
                '{"trait_type":"Dominant Chakra","value":"', soul.dominantChakra, '"},',
                '{"trait_type":"Tribe","value":"', soul.tribe, '"},',
                '{"trait_type":"Tier","value":"', soul.tier, '"},',
                '{"trait_type":"Sadhana Points","value":', soul.sadhanaPoints.toString(), '},',
                '{"trait_type":"Memory Seals","value":', sealCount(tokenId).toString(), '},',
                '{"trait_type":"Balance","value":"', _balanceLabel(soul.chakraStates), '"},',
                '{"trait_type":"Flow","value":', _balancePct(soul.chakraStates).toString(), '},',
                '{"trait_type":"Level","value":"', levelName(_stage(soul.sadhanaPoints)), '"},',
                '{"trait_type":"Vitality","value":"', _vitality(tokenId), '"},',
                '{"trait_type":"Entangled","value":"', entangledWith[tokenId] == 0 ? "None" : string(abi.encodePacked("Prism #", entangledWith[tokenId].toString())), '"},',
                '{"trait_type":"Ancestor","value":"', isAncestorStone[tokenId] ? "Stone" : "Living", '"}',
            ']}'
        ))));

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    // ─────────────────────────────────────────────────────────────
    // On-chain SVG generation
    // ─────────────────────────────────────────────────────────────

    // Dosha → petal length. Higher percentage = longer petal.
    function _petalLen(uint8 pct) internal pure returns (string memory) {
        // 0% -> 20, 100% -> 70
        uint256 len = 20 + (uint256(pct) * 50) / 100;
        return len.toString();
    }

    // ── Vitality (Tamagotchi Prism): the glyph dims when neglected and
    //    brightens again with care. No re-mint — tokenURI() reads the clock.
    function _vitality(uint256 tokenId) internal view returns (string memory) {
        if (isAncestorStone[tokenId]) return "Eternal"; // the dead are never dimmed
        uint256 last = lastActivity[tokenId];
        if (last == 0 || block.timestamp - last > 30 days) return "Dormant";
        if (block.timestamp - last > 7 days) return "Dimming";
        return "Radiant";
    }

    function _vitalityOpacity(uint256 tokenId) internal view returns (string memory) {
        if (isAncestorStone[tokenId]) return "1";
        uint256 last = lastActivity[tokenId];
        if (last == 0 || block.timestamp - last > 30 days) return "0.30";
        if (block.timestamp - last > 7 days) return "0.55";
        return "1";
    }

    // Gold double-frame + epitaph for a completed life.
    function _ancestorFrame(uint256 tokenId) internal view returns (string memory) {
        if (!isAncestorStone[tokenId]) return "";
        return string(abi.encodePacked(
            '<circle cx="120" cy="120" r="112" fill="none" stroke="#c9a84c" stroke-width="3" opacity="0.9"/>',
            '<circle cx="120" cy="120" r="106" fill="none" stroke="#c9a84c" stroke-width="1" opacity="0.6"/>',
            '<text x="120" y="14" text-anchor="middle" fill="#c9a84c" font-size="9" font-family="monospace" letter-spacing="3">ANCESTOR STONE</text>'
        ));
    }

    // Evolution stage from accumulated sadhana (daily practice / journey / retreats).
    function _stage(uint256 sadhana) internal pure returns (uint256) {
        if (sadhana >= 2500) return 4;
        if (sadhana >= 1000) return 3;
        if (sadhana >= 500)  return 2;
        if (sadhana >= 100)  return 1;
        return 0;
    }

    // The Prism gains a golden ring per stage, and a full gold border at Elder.
    // The art visibly grows as the holder heals — no re-mint; tokenURI() re-renders.
    function _evolutionLayers(uint256 sadhana, string memory tier)
        internal
        pure
        returns (string memory layers)
    {
        uint256 st = _stage(sadhana);
        for (uint256 i = 0; i < st; i++) {
            uint256 r = 60 + i * 12; // 60, 72, 84, 96
            layers = string(abi.encodePacked(
                layers,
                '<circle cx="120" cy="120" r="', r.toString(),
                '" fill="none" stroke="#c9a84c" stroke-width="0.7" opacity="0.',
                (2 + i).toString(), '"/>'
            ));
        }
        if (keccak256(bytes(tier)) == keccak256(bytes("Elder"))) {
            layers = string(abi.encodePacked(
                layers,
                '<circle cx="120" cy="120" r="116" fill="none" stroke="#c9a84c" stroke-width="2" opacity="0.85"/>'
            ));
        }
    }

    // ── Balance halo ── chakraStates is 7 chars root..crown: '2' open / '1' partial / '0' blocked.
    function _sumStates(string memory states) internal pure returns (uint256 sum) {
        bytes memory s = bytes(states);
        for (uint256 i = 0; i < 7; i++) {
            if (i < s.length) {
                if (s[i] == "2") sum += 2;
                else if (s[i] == "1") sum += 1;
            }
        }
    }
    function _balancePct(string memory states) internal pure returns (uint256) {
        return (_sumStates(states) * 100) / 14; // 7 chakras × max 2
    }
    function _balanceLabel(string memory states) internal pure returns (string memory) {
        uint256 p = _balancePct(states);
        if (p >= 65) return "In Balance";
        if (p >= 35) return "Finding Balance";
        return "Out of Balance";
    }

    // The outer ring becomes a 7-chakra balance halo: each arc bright + whole when that
    // centre is open, dim + broken when blocked. Reads as in/out of balance at a glance.
    function _balanceRing(string memory states) internal pure returns (string memory ring) {
        string[8] memory px = ["120","198.2","217.5","163.4","76.6","22.5","41.8","120"];
        string[8] memory py = ["20","57.6","142.3","210.1","210.1","142.3","57.6","20"];
        string[7] memory col = ["#cc2222","#ff6600","#ddaa00","#00bb44","#0099cc","#6622cc","#bb00ff"];
        bytes memory s = bytes(states);
        for (uint256 i = 0; i < 7; i++) {
            bytes1 st = i < s.length ? s[i] : bytes1("1");
            string memory w; string memory op; string memory dash;
            if (st == "2") { w = "3.2"; op = "0.92"; dash = ""; }
            else if (st == "0") { w = "1.4"; op = "0.22"; dash = ' stroke-dasharray="2 6"'; }
            else { w = "2"; op = "0.5"; dash = ""; }
            ring = string(abi.encodePacked(
                ring,
                '<path d="M', px[i], ',', py[i], ' A100,100 0 0,1 ', px[i + 1], ',', py[i + 1],
                '" fill="none" stroke="', col[i], '" stroke-width="', w, '" opacity="', op, '"', dash,
                ' stroke-linecap="round"/>'
            ));
        }
    }

    function _buildSVG(uint256 tokenId, SoulData memory soul)
        internal
        view
        returns (string memory)
    {
        string memory petals = string(abi.encodePacked(
            // Vata (air) — violet
            _petalSet("#7c5cbf", "0.70", _petalLen(soul.vataPct),  "0",  "60", "120"),
            // Pitta (fire) — amber
            _petalSet("#ff6b35", "0.55", _petalLen(soul.pittaPct), "30", "90", "150"),
            // Kapha (earth) — emerald
            _petalSet("#7cb87a", "0.45", _petalLen(soul.kaphaPct), "15", "75", "135")
        ));

        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">',
            '<defs><radialGradient id="g" cx="50%" cy="50%" r="50%">',
            '<stop offset="0%" stop-color="#7c5cbf" stop-opacity="0.3"/>',
            '<stop offset="100%" stop-color="#0a0a0f" stop-opacity="0"/></radialGradient></defs>',
            '<rect width="240" height="240" fill="#0a0a0f"/>',
            '<circle cx="120" cy="120" r="110" fill="url(#g)"/>',
            '<circle cx="120" cy="120" r="100" fill="none" stroke="#16161f" stroke-width="6"/>',
            _balanceRing(soul.chakraStates),
            '<circle cx="120" cy="120" r="80" fill="none" stroke="#3a2a5a" stroke-width="0.5"/>',
            _evolutionLayers(soul.sadhanaPoints, soul.tier),
            '<g transform="translate(120,120)" opacity="', _vitalityOpacity(tokenId), '">', petals, '</g>',
            '<circle cx="120" cy="120" r="22" fill="#1a0a3a" stroke="#7c5cbf" stroke-width="1.5"/>',
            _sealMarkers(sealCount(tokenId)),
            _ancestorFrame(tokenId),
            _label(tokenId, soul),
            '</svg>'
        ));
    }

    function _petalSet(
        string memory color,
        string memory opacity,
        string memory len,
        string memory r1,
        string memory r2,
        string memory r3
    ) internal pure returns (string memory) {
        return string(abi.encodePacked(
            _petal(color, opacity, len, r1),
            _petal(color, opacity, len, r2),
            _petal(color, opacity, len, r3)
        ));
    }

    function _petal(
        string memory color,
        string memory opacity,
        string memory len,
        string memory rot
    ) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<ellipse rx="16" ry="', len, '" fill="', color,
            '" opacity="', opacity, '" transform="rotate(', rot, ')"/>'
        ));
    }

    // Gold seal dots placed around the ring, one per inscribed Memory Seal (max 8 shown).
    function _sealMarkers(uint256 count) internal pure returns (string memory) {
        if (count == 0) return "";
        if (count > 8) count = 8;

        // Pre-computed coordinates at radius 100 around center (120,120).
        string[8] memory xs = ["120","191","220","191","120","49","20","49"];
        string[8] memory ys = ["20","49","120","191","220","191","120","49"];

        string memory dots;
        for (uint256 i = 0; i < count; i++) {
            dots = string(abi.encodePacked(
                dots,
                '<circle cx="', xs[i], '" cy="', ys[i],
                '" r="5" fill="#c9a84c" stroke="#0a0a0f" stroke-width="1"/>'
            ));
        }
        return dots;
    }

    function _label(uint256 tokenId, SoulData memory soul)
        internal
        pure
        returns (string memory)
    {
        return string(abi.encodePacked(
            '<text x="120" y="228" text-anchor="middle" fill="#4a4460" font-size="8" ',
            'font-family="monospace">#', tokenId.toString(), ' \xC2\xB7 ',
            soul.tribe, ' \xC2\xB7 ', levelName(_stage(soul.sadhanaPoints)), '</text>'
        ));
    }

    // ─────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────

    function _notEqual(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) != keccak256(bytes(b));
    }
}
