# EvolveEarth — Soul Signature (on-chain NFT, on Bittensor)

The **on-chain Soul Signature NFT** from `soul-signature-architecture.html`, built for
real and wired to the **Chakra Journey assessment** you already have
(`../Charka Journey/chakra-destiny.html`).

**Chain: Bittensor (Subtensor EVM).** Chosen because it is fast, cheap, scalable, and
significantly **more decentralized than Solana** — Bittensor is built on Substrate
(Polkadot SDK), which holds one of the highest Nakamoto coefficients in the industry.
Crucially, **TAO is the native gas token**, so the project's whole economy (the healing
subnet, miner rewards, marketplace splits — all denominated in TAO) lives on one chain
with **no bridge**. And because Subtensor exposes a full EVM, the Solidity contract
deploys unchanged.

The NFT image (a dosha/chakra mandala) lives **inside the contract** as a base64 SVG —
no IPFS, no server, no link to break. Same pattern as Nouns / Loot / Autoglyphs.

```
Chakra Journey assessment  →  soul-bridge.js  →  SoulSignature.mint()  →  permanent on-chain glyph
   (already built)             (maps traits)       (Solidity, on Bittensor)   (survives any server dying)
```

---

## What's here

| File | What it is |
|------|------------|
| `contracts/SoulSignature.sol` | The ERC-721. Stores dosha/chakra/tribe/tier/seals; builds the SVG + metadata on-chain in `tokenURI()`. Evolves via `addSadhana`, `inscribeMemorySeal`, `updateTraits`. |
| `test/SoulSignature.test.js` | 6 passing tests — minting, validation, on-chain image, tier promotion, seals, access control. |
| `scripts/deploy.js` | Deploy to local / Bittensor testnet / Bittensor mainnet. |
| `scripts/mint.js` | Mint a sample + add sadhana + inscribe a seal. |
| `scripts/preview.js` | Decode `tokenURI()` and write a local HTML file so you can SEE the on-chain art. |
| `bridge/soul-bridge.js` | Pure function: assessment result → `mint()` params. Works in Node + browser. |
| `bridge/demo.js` | Proves the whole pipeline with no blockchain and no setup. |
| `bridge/mint-widget.html` | Drop-in "Mint your Soul Signature" UI — reads the assessment from localStorage, connects a wallet, mints on Bittensor. |

**Build settings:** Solidity 0.8.24, OpenZeppelin **5.0.2**, EVM target **Shanghai**.
Subtensor EVM supports Cancun, but Shanghai avoids a known ERC-721 `MCOPY` runtime
issue and needs nothing Cancun-specific.

---

## Setup (one time)

```bash
cd EVOLVEEARTH
npm install
```

### Try it with ZERO blockchain, zero cost

Compiles the contract, runs the pipeline (assessment → traits → minted glyph), prints
the result. Nothing leaves your machine:

```bash
npx hardhat run bridge/demo.js
```

Run the test suite:

```bash
npx hardhat test
```

Preview the actual on-chain art in your browser (deploys + mints on a throwaway local
chain, then writes `preview-token-1.html`):

```bash
npx hardhat run scripts/preview.js
```

---

## Deploying to Bittensor testnet

You only need this for a *live*, shareable NFT.

**1. Make a throwaway H160 wallet** in MetaMask (don't use your main one). Copy its
private key: Account details → Show private key.

**2. Add the Bittensor testnet to MetaMask** (or let the mint widget add it for you):
- Network name: `Bittensor Testnet (Subtensor EVM)`
- RPC: `https://test.chain.opentensor.ai`
- Chain ID: `945`
- Currency: `TAO`

**3. Get test TAO.** Unlike Ethereum testnets, there's no public faucet — **test TAO is
available on request via the Bittensor Discord**. Ask in their dev/EVM channel with your
H160 address.

**4. Create your `.env`:**

```bash
cp .env.example .env
```
Edit it:
```
PRIVATE_KEY=<your throwaway wallet's private key>
```
(The public Subtensor RPCs are already the defaults.)

**5. Deploy:**

```bash
npx hardhat run scripts/deploy.js --network subtensorTestnet
```
It prints the contract address. Put it in `.env`:
```
SOUL_CONTRACT_ADDRESS=0x...the address it printed...
```

**6. Mint a test token:**

```bash
npx hardhat run scripts/mint.js --network subtensorTestnet
```

---

## Connecting the assessment (the real product loop)

`bridge/mint-widget.html` bridges your existing assessment and the chain:

1. A user completes the **Chakra Journey** — the app already saves their result to
   `localStorage["chakra_sessions"]`.
2. Open `mint-widget.html` (set `CONTRACT_ADDRESS` at the top to your deployed address).
   It reads their latest session, converts it with `soul-bridge.js`, shows the traits,
   and mints on a wallet click. The widget targets Bittensor testnet by default and will
   prompt MetaMask to add the network automatically.

To embed it directly inside `chakra-destiny.html`, drop a "Mint" button on the results
screen that calls `SoulBridge.assessmentToSoul(...)` with the in-memory `mainAnswers`,
`lsAnswers`, `healingScores` and reuses the ethers mint flow from the widget.

---

## How the trait mapping works

| NFT trait | Source in the assessment |
|-----------|--------------------------|
| Vata / Pitta / Kapha % | One vote per gate from each archetype's dosha (MAGICIAN/AFRAID→Vata, WARRIOR/EGO→Pitta, KING/SLEEPER→Kapha), rounded to sum 100. |
| Dominant chakra | Highest-flow gate (healthy archetype + open lifestyle + journey healing). |
| Deficient chakra | Lowest-flow gate. |
| Tribe | Dominant dosha → Vayu/Agni/Prithvi; near-balanced → Akasha; Pitta-Kapha mix → Jala. |
| Sadhana points | Sum of deep-journey `healingScores` (or derived from flow if the journey wasn't done). |
| Memory seals | None at mint. Added later by `inscribeMemorySeal()` when a retreat is attended. |

---

## Going to mainnet (later, deliberately)

Don't rush this. Before real TAO:
1. Get the contract audited.
2. Move the `owner`/oracle to a multisig (`setOracle`).
3. Deploy with `--network subtensor` (chainId 964) and a wallet holding real TAO.

Everything else in the architecture doc (DAO, the Bittensor healing subnet, marketplace
splits, land NFTs) is **Phase 2+** — and now it all lives on the same chain as this NFT,
natively in TAO, no bridge.
