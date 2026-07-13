// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// ─────────────────────────────────────────────────────────────────────────
/// WITNESS ESCROW — the attention economy gets teeth.
///
/// A member books a session (Council of Two, a practitioner from the
/// Healer's Bazaar, a Star Council reading) by escrowing $PRANA here.
/// The tokens release to the witness only when BOTH parties attest that
/// the session happened. Either party can cancel before mutual attestation;
/// after a timeout the seeker can always reclaim. Disputes go to the
/// arbiter (MirrorDAO / multisig in production).
/// ─────────────────────────────────────────────────────────────────────────
contract WitnessEscrow is Ownable {
    IERC20 public immutable prana;
    address public arbiter; // MirrorDAO or multisig; may resolve disputes

    uint256 public constant TIMEOUT = 14 days;

    enum Status { None, Booked, Released, Refunded }

    struct Session {
        address seeker;    // pays
        address witness;   // holds space, gets paid
        uint256 amount;
        uint64  bookedAt;
        bool    seekerAttested;
        bool    witnessAttested;
        Status  status;
    }

    uint256 public nextSessionId = 1;
    mapping(uint256 => Session) public sessions;

    event Booked(uint256 indexed id, address indexed seeker, address indexed witness, uint256 amount);
    event Attested(uint256 indexed id, address indexed by);
    event Released(uint256 indexed id, uint256 amount);
    event Refunded(uint256 indexed id, uint256 amount);

    constructor(address prana_) Ownable(msg.sender) {
        prana = IERC20(prana_);
        arbiter = msg.sender;
    }

    function setArbiter(address a) external onlyOwner { arbiter = a; }

    /// Seeker escrows the session fee. Requires prior approve().
    function book(address witness, uint256 amount) external returns (uint256 id) {
        require(witness != address(0) && witness != msg.sender, "Witness yourself elsewhere");
        require(amount > 0, "Attention has a price");
        require(prana.transferFrom(msg.sender, address(this), amount), "Escrow transfer failed");
        id = nextSessionId++;
        sessions[id] = Session(msg.sender, witness, amount, uint64(block.timestamp), false, false, Status.Booked);
        emit Booked(id, msg.sender, witness, amount);
    }

    /// Both parties attest -> funds flow to the witness. One signature is
    /// a claim; two signatures are a ceremony.
    function attest(uint256 id) external {
        Session storage s = sessions[id];
        require(s.status == Status.Booked, "Not open");
        if (msg.sender == s.seeker) s.seekerAttested = true;
        else if (msg.sender == s.witness) s.witnessAttested = true;
        else revert("Not a party");
        emit Attested(id, msg.sender);
        if (s.seekerAttested && s.witnessAttested) {
            s.status = Status.Released;
            require(prana.transfer(s.witness, s.amount), "Release failed");
            emit Released(id, s.amount);
        }
    }

    /// Before mutual attestation the seeker may withdraw; after TIMEOUT the
    /// seeker may always reclaim an unfinished booking.
    function refund(uint256 id) external {
        Session storage s = sessions[id];
        require(s.status == Status.Booked, "Not open");
        bool timedOut = block.timestamp > s.bookedAt + TIMEOUT;
        require(
            msg.sender == s.seeker && (!s.witnessAttested || timedOut) ||
            msg.sender == s.witness && !s.seekerAttested ||
            msg.sender == arbiter,
            "Cannot refund"
        );
        s.status = Status.Refunded;
        require(prana.transfer(s.seeker, s.amount), "Refund failed");
        emit Refunded(id, s.amount);
    }

    /// Arbiter may force-release when the seeker disappears after a real
    /// session (the witness should not carry the cost of ghosting).
    function arbiterRelease(uint256 id) external {
        require(msg.sender == arbiter, "Arbiter only");
        Session storage s = sessions[id];
        require(s.status == Status.Booked && s.witnessAttested, "Witness must attest first");
        s.status = Status.Released;
        require(prana.transfer(s.witness, s.amount), "Release failed");
        emit Released(id, s.amount);
    }
}
