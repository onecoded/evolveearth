# Changelog — EvolveEarth / Chakra Journey

## v0.2.0 — Sharing & Infrastructure release
- **Version archive**: `Charka Journey/versions/` preserves v1-original (2026-03-04) and v2-mid (2026-03-09); live file is v3-modern.
- **Deploy to URL**: GitHub Pages workflow (`.github/workflows/pages.yml`) + `index.html` entry redirect. One repo-setting flip publishes the app.
- **CI**: `.github/workflows/ci.yml` — Hardhat contract tests (21) + `tools/validate-app.js` (script-block syntax + seed-data validation) on every push.
- **Demo Mode**: 👁 button on the intro seeds a rich 68-day corpus and jumps straight to full results + Witnessing-ready state.
- **PWA**: `manifest.json` + `sw.js` + icon — installable, offline-capable when served over HTTP(S).
- **Storage adapter**: `Store` object now fronts localStorage (single seam for future Supabase/Ceramic sync).
- **Session Handoff**: compact copy/paste code moves a reading between devices (until wallet identity lands).
- **Deploy manifest**: `EVOLVEEARTH/deployments.json` — deploy script records contract addresses; app + mint widget read it with graceful fallback.
- **Data snapshots**: `tools/extract-data.js` exports the app's inline datasets to `Charka Journey/data/*.json` for editing/review.
- **Docs**: `ARCHITECTURE.md` (feature → function → storage key → contract map), this changelog, version tags.

## v0.1.0 — commit `04fe2ea`
The full platform drop: deepened 7-gate assessment + master question DB + admin backend; Light Column; Master Healing Dashboard; Soul Sanctum (9 chambers); marketplace by chakra×dosha; Diagnostics (tongue/pulse/agni/dreams); Rhythms (moon kits, convergence, radio); milestone tokens; sovereign Vault; Akashic Archive; $PRANA economy (XP levels, loot, vitality, royalties); the Witnessing Oracle (Level 3, three-movement ceremony); hold-to-select + gate navigation. On-chain: SoulSignature (Prism NFT, balance halo, evolution, entanglement, Ancestor Stones), PranaToken, Civilization layer (Pool/Registry/MirrorDAO/MedicineStory), flourishing-reward subnet function — 21/21 tests.
