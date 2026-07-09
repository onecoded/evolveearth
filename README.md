# EvolveEarth — The Seven Sacred Gates ✦ Prism

A chakra & dosha healing journey with an evolving on-chain soul: take the
seven-gate assessment, receive your reading, heal the wounded centers through
guided quests — and mint your **Prism**, a fully on-chain NFT whose art
reflects your actual balance and grows as you do.

**Try it:** open [`Charka Journey/chakra-destiny.html`](Charka%20Journey/chakra-destiny.html)
in any browser (works offline, from a plain file). Press **👁 Demo** on the
intro screen to see a finished 68-day journey instantly — then press
**🪞 Request a Witnessing**.

## What's inside

| | |
|---|---|
| `Charka Journey/` | The app — assessment, Light Column, Healing Dashboard, Soul Sanctum, marketplace, Diagnostics, Rhythms, $PRANA economy, the Witnessing Oracle. Single self-contained HTML + PWA. |
| `Charka Journey/admin.html` | Content backend: question bank, marketplace, resources. |
| `Charka Journey/versions/` | Preserved eras (v1-original, v2-mid). |
| `EVOLVEEARTH/` | Solidity contracts for Bittensor's EVM: the Prism NFT (on-chain SVG, balance halo, evolution, Ancestor Stones), PRANA token, healing pools, initiation registry, Mirror DAO, Medicine Stories. 21 passing tests. |
| `EVOLVEEARTH/subnet/` | The flourishing-reward function — an AI loss function paying for *measured months-later healing*, not engagement. |
| `ARCHITECTURE.md` | Feature → function → storage → contract map. |

## Develop

```bash
# the app: just open it, or serve the folder
npx http-server "Charka Journey" -p 8080

# the contracts
cd EVOLVEEARTH && npm install && npx hardhat test   # 21 passing

# validate the app (CI runs this)
node tools/validate-app.js
```

## License

All rights reserved — see [LICENSE](LICENSE). Viewing and evaluation welcome;
contact Joseph.Schneek@gmail.com for anything more.
