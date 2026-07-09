# EvolveEarth — Build Roadmap

The NFT is now called **Prism** (token name/symbol `Prism`/`PRISM`; everyday term "your Prism").
"White light refracted into your unique dosha/chakra signature."

Two surfaces:
- **`../Charka Journey/chakra-destiny.html`** — the assessment app (frontend, self-contained).
- **`EVOLVEEARTH/`** — the Prism NFT contract + bridge (Solidity on Bittensor/Subtensor EVM).

Status legend: ✅ done · �doing · ⬜ planned · 🔗 needs contract deploy / TAO

---

## Phase 1 — brand + high-value frontend (no blockchain) ✅ DONE
- ✅ **Rename NFT → Prism** (contract name/symbol + app: mint button, blueprint title, status). Tests 6/6, on-chain name = "Prism #1".
- ✅ **#2 Your Daily Medicine** — consolidated per-dosha daily protocol + one action per blocked center, copy button. Data: `DOSHA_DAILY` + `AYURVEDA`.
- ✅ **#4 Progress over time** — snapshots each full reading to `localStorage['chakra_progress']`; "Your Journey Over Time" panel with flow % + delta per reading.

## Phase 2 — make Prism live + retention (mostly frontend) ✅ DONE
- ✅ **#3 Evolving Prism** — on-chain SVG now gains a golden ring per sadhana stage (100/500/1000/2500) + a gold border at Elder; `tokenURI()` re-renders on `addSadhana`/tier change (no re-mint). 7/7 tests. In-app: "Prism Evolution" caption under the canvas (stage name, ●○ dots, next-layer hint) — thresholds mirror the contract exactly.
- ✅ **#5 Symptom-first triage** — "What's heavy today?" on the intro screen → 12 symptoms map to chakra+dosha → immediate ayurvedic medicine + frequency tone + CTAs (Oracle / full journey). Data: `SYMPTOM_MAP`.
- ✅ **#8 Daily Oracle + check-in** — date-seeded daily oracle card (dosha-framed) + 10-sec practice check-in (`PRACTICES`, weighted) → awards sadhana + builds a streak (`localStorage['chakra_dailycheck']`). Feeds the Prism evolution meter directly. Entry points: intro link + button on the Prism meter. Streak logic verified.
- ✅ **#12 Shareable Prism + referral** — Share My Prism (Web Share API w/ glyph PNG + text, falls back to download + copy), Gift a Reading (invite message + link), Copy invite link with `?ref=` code, inbound `?ref=` acknowledged on the intro. Card on results via `buildShareCard()`.

## Phase 3 — the marketplace (needs contract work + TAO) 🔗
- ✅ **#1 Chakra Condition Marketplace (frontend MVP)** — in-app Marketplace tab: offerings by chakra × dosha × type (practitioner/course/kit/sound/retreat/book/therapy), filters default to the user's wounded chakra; seed (`MARKETPLACE_SEED`, 15 items) + admin customs. TAO payments/splits still ⬜ (needs deploy).
- ✅ **#7 Healing Kits** — seeded as marketplace `kit` type entries.

## Capstone (2026-07) — comprehensive platform ✅
- ✅ **Master Question DB** — `QUESTION_DB_SEED` (21 Qs, one per chakra×dosha) + admin customs (`chakra_question_db_custom`), merged into each gate's deep-dive via `_deepListFor()` (matched by chakra + archetype dosha).
- ✅ **Admin backend** (`admin.html` → "Master Database" section) — CRUD for Questions (chakra+dosha+4 scored options), Marketplace offerings, and Resource Library (video/image/text/oracle). Shared localStorage keys with the app.
- ✅ **Resource Library** — admin resources render in the Marketplace tab: video thumbnails, images, text passages, oracle prompts that open seeded Oracle sessions.
- ✅ **Master Healing Dashboard** — full-screen panel from results: per-chakra childhood-wound framing + healing modalities (inner-child, IFS, NLP, MKP men's work, somatic/breathwork, chakra medicine) with practice tracking (`chakra_heal_progress`, +2/practice, opens at 10). All 7 open → **FULLY BALANCED** banner → Prism mints with unbroken `2222222` balance halo. Includes not-medical-advice disclaimer.
- ⬜ **#6 Practitioner matching + booking** — Healer NFT directory, TAO escrow released on session rating.
- ⬜ **#9 Sound medicine prescription** — per-chakra solfeggio playlist gated by Prism; musicians earn TAO per verified listen.

## Phase 4 — community + depth
- ⬜ **#10 Chakra Circles** — auto-match users by deficient chakra into small groups (extends community section).
- ⬜ **#11 Shadow-work companion with memory** — Oracle that remembers profile + past sessions (privacy-preserving).

---

## Design & balance pass (done)
- ✅ **Modern design layer** — aurora mesh bg, film grain, vignette, glassmorphism cards, Cinzel/Chakra Petch/Cormorant fonts, custom scrollbar.
- ✅ **Authentic chakra yantras** (sacred geometry, rotating, glowing) replace emoji at the focal orbs: intro spine, gate orbs, triage, transition reveal, spine map. (`chakraGlyph()` + `YANTRA`.) Small solid-color badges kept emoji to avoid same-colour blend.
- ✅ **Balance in the image/NFT** — the Prism's outer ring is now a 7-chakra **balance halo**: each arc bright + whole when that centre is open, dim + broken (dashed) when blocked. Reads in/out-of-balance at a glance. Contract: `chakraStates` param + `setChakraStates()` (re-tests) + `_balanceRing`/`_balancePct`/`_balanceLabel`; metadata gains **Balance** ("In/Finding/Out of Balance") + **Flow** %. Bridge/inline/widget/scripts all pass `chakraStates`. In-app balance badge on the Prism meter. 8/8 contract tests + pipeline verified.

## Gamified Evolution (2026-07) — the $PRANA economy ✅
Joseph picked ideas 1, 2, 4, 6, 7, 12 from the gamification brainstorm; all built & verified (14/14 contract tests, reward math parity frontend↔contract):
- ✅ **#1 $PRANA token** — `contracts/PranaToken.sol` (ERC-20 "Prana"/"PRANA"): emitter-gated `mintReward` (practice is the only faucet), per-wallet daily cap, 10% referral royalty built into every mint. Frontend mirror: local ledger `localStorage['chakra_prana']` + `pranaAward()` toast.
- ✅ **#2 XP levels** — Seed→Seeker→Adept→Luminary→Elder (contract `levelName`/`_levelReward`; drops 50/100/200/500 PRANA per level via `addSadhana` stage-crossing, try/catch so rewards never brick practice-logging). App level-up ceremony `_checkLevelUp()` mirrors thresholds; "Level" trait in metadata + level name on the glyph label.
- ✅ **#4 Quest lines** — Healing Dashboard cards are 3-part quests: 5 practices + explore-a-resource (+5, jumps to marketplace) + oracle-session (+5); chakra opens = +50; quest flags in `chakra_heal_progress` (`r{i}`/`o{i}` keys).
- ✅ **#6 Daily Oracle Loot** — every check-in draws a card: common +2 (84%), rare +10 (15%), GOLDEN LOTUS +100 (1%); rarity card rendered in the confirmation.
- ✅ **#7 Tamagotchi Prism** — contract: `lastActivity` touched by every practice fn; "Vitality" trait Radiant/Dimming(>7d)/Dormant(>30d) + petals SVG dims (opacity 1/.55/.30); care revives. App: `prismVitality()`/`applyPrismVitality()` dims the canvas + "Your Prism is Dimming" banner → opens the daily panel.
- ✅ **#12 Evolution royalties** — on-chain: `referrerOf` + `referralBps` (10%) auto-mint to guide on every earn; app: `?ref=` persists to `chakra_ref`, royalty noted on the Prism meter.
- Deploy order for chain: deploy PranaToken → deploy SoulSignature → `prana.setEmitter(soul, true)` → `soul.setPrana(prana)`.
- Remaining gamification ideas (#3 streak shields, #5 tribe seasons, #8 witness bonds, #9 achievement seals, #10 delta leaderboard, #11 milestone airdrops) ⬜.

## Civilization Layer (2026-07) — profound ideas #4–#10 ✅ (on-chain + subnet spec; app UI ⬜)
Joseph: "create 4-10". All verified — **21/21 contract tests** + flourishing-reward assertions:
- ✅ **#4 Flourishing AI** — `subnet/flourishing_reward.py` + `subnet/README.md`: the loss function rewarding miners for months-later measured flow improvement. Longitudinal-only (14d min lag), cohort-baseline-adjusted (trimmed mean), best-single-event credit per miner-soul (anti-spam), per-soul cap, 45d decay. Two real design flaws caught & fixed during verification (sparse-snapshot attribution; event-stacking beat honesty).
- ✅ **#5 Ancestor Stone** — SoulSignature: `setLegacyGuardian`/`memorialize(epitaph, memoirHash)` → soulbound forever (`_update` override), halo closes to 2222222, Vitality="Eternal" (never dims), gold double-frame + "ANCESTOR STONE" on the art.
- ✅ **#6 PranaPool** — mutual healing pools: `premiumBps()` falls 10%→1% as `collectiveFlow()` rises; claims paid by 2-member attestation, no adjusters.
- ✅ **#7 InitiationRegistry** — rites staked in $PRANA, sealed at N witnesses → permanent Memory Seal inscribed on the initiate's Prism (registry = soul oracle); abandoning a vow forfeits the stake.
- ✅ **#8 MirrorDAO** — votingPower = flowOf × consistency factor (100%/60%/25%/5% by lastActivity age). Verified: a consistent low-flow soul (7) outvotes a lapsed master (100→5).
- ✅ **#9 Entangled Prisms** — propose/accept (mutual consent) /dissolve (either side); "Entangled: Prism #N" trait on both.
- ✅ **#10 MedicineStory (Shadow Market)** — ERC-721; `mintStory` REQUIRES that chakra open on the author's Prism ("Wound not yet healed" otherwise); `acquire` pays 90% author / 10% commons in $PRANA; "Wounded Healer" + "Souls Guided" traits.
- Contracts in `contracts/Civilization.sol` (+ SoulSignature additions: `flowOf`, `chakraStateOf`, entangle/ancestor).
- ✅ **App UI: The Soul Sanctum** (`openSanctum()`, CTA on results under the Healing Dashboard) — six tabs: 🔗 Bonds (propose/dissolve, `chakra_entangle`), 📿 Medicine Stories (mint gated by healed chakras only — mirrors contract revert; 3 seeded stories; acquire spends $PRANA via new `pranaSpend()`; Oracle walk-the-map button), 🕯️ Legacy (guardian+epitaph+memoir covenant, `chakra_legacy`), 🏛️ Council (votingPower=flow×consistency, 3 seeded proposals, `chakra_dao`), 🌊 Pool (premium falls with collective flow; join/contribute, `chakra_pool`), 🔥 Rites (stake 10 → declaration → 2 witnesses → sealed +35, `chakra_rites`). All verified live in browser incl. wallet arithmetic.

## Ideas 21–32 (2026-07) — Depth · Reciprocity · Ritual · Sovereignty ✅ (app MVPs, all verified live)
- ✅ **#21 Tongue+Pulse diagnostics** — `openDiagnostics()` panel: guided jihva/nadi questionnaires (`TONGUE_QUIZ`/`PULSE_QUIZ`, snake/frog/swan) → dosha lean stored in `chakra_diagnostics`, refines constitution.
- ✅ **#22 Agni tracker** — meal logs (`chakra_agni`) → 7+ logs classify Sama/Vishama/Tikshna/Manda with advice (`_agniClassify`).
- ✅ **#23 Dream journal** — `dreamLog()` keyword dosha-reads dreams (`chakra_dreams`, device-private), 90-entry pattern surfacing.
- ✅ **#24 Mentorship** — Sanctum 🧭 tab: 90-day elder–seeker covenant + check-ins + completion (+40) (`chakra_mentor`).
- ✅ **#25 Reciprocity Web** — Sanctum 🧰 tab: offer/need skill board, exchanges +15 (`chakra_skills`).
- ✅ **#26 Lineage** — Sanctum 🌳 tab: dharma-family tree (guide from `chakra_ref` + souls you brought, `chakra_lineage`).
- ✅ **#27 Moon ceremony kits** — `openRhythms()`: synodic moon-phase calc, dosha-personalized new/full kits (`MOON_KITS`), lunar sadhana track (`chakra_lunar`).
- ✅ **#28 Milestone tokens** — `MILESTONE_DEFS` (10 rites-of-passage) auto-detected in `buildMilestones()` gallery on results, +20 each (`chakra_milestones`); transferable NFTs at deploy.
- ✅ **#29 Convergence** — solstice/equinox table (`EQUINOX_SOLSTICE` through 2027), 24h-window logging mints Convergence Seal +50 (`chakra_convergence`).
- ✅ **#30 Healing Vault** — `vaultExport()/vaultImport()`: full sovereign JSON export/restore of all 26 `chakra_*` keys; buttons on results.
- ✅ **#31 Radio-lite** — Rhythms panel: time-of-day dosha programming (morning Kapha-clear 528 / afternoon Vata 396 / evening Pitta 639 / night 963) via the chord engine.
- ✅ **#32 Akashic Archive** — new results tab 📜: seeded classics (Charaka Samhita, Ashtanga Hridayam, Yoga Sutras — archive.org/gutenberg) + admin resources + member offerings (+8, `chakra_archive_subs`).
- Entry points: results CTAs (👅 Diagnostics, 🌙 Rhythms), Sanctum grew 6→9 chambers, Archive tab, Vault buttons.
- Live-verified: tongue→Vata, pulse→Kapha, agni→Tikshna, dream→Kapha, moon renders, next convergence 2026-09-22, skills/lineage/mentor flows, milestone auto-award, archive submit, wallet math.

## The Witnessing Oracle — Level 3 (2026-07) ✅
The north-star spec ("the oracle is the heart of everything") implemented on the app's own longitudinal corpus:
- `_witnessCorpus()` — full-arc read: progress deltas, streak/practice, agni class, dream leans, heal progress incl. **untouched** wounded gates, rites begun-vs-sealed, offers-vs-swaps, bonds/mentor/lineage, repeated oracle asks, diagnostics contradictions. **Absence is data.**
- `_witnessInsights()` — 9 structural detectors (upper-flight · containers-never-entered · streak-as-armor · collector · give-armor · body-dissent · night-school · asking-not-acting · alone), weighted, prose written to witness, not diagnose.
- `buildWitnessScript()` — the three-movement ceremony: ⚭ I. The Mirror (plain recital of their own numbers) → II. The Pattern (structural insight) → III. The Question (somatic, unresolved). Honest thin-data path when the record is too young.
- Standard readings upgraded too: mirror opening + top insight + somatic close. Every ask now logged (`chakra_oracle_history`) — repeated themes become future witnessing data.
- Ethics per spec: reads only self-created data, witnesses rather than diagnoses, sovereignty note on the button, closable anytime.
- `ORACLE_CHARTER` = the Phase-2/3 system prompt for Claude API → Bittensor subnet (consistent Level-3 at scale).
- Live-verified with a seeded 68-day corpus: 3 movements rendered; 6 insights detected; pattern output was the spec's own example insight, generated from data.

## Standing blockers
- A **live mint** needs the contract deployed to Bittensor testnet + test TAO (request in Bittensor Discord). Phase 1/2 frontend all work without it.
- After deploy: set `SOUL_CONTRACT_ADDRESS` in `EVOLVEEARTH/.env` AND in `chakra-destiny.html` (mint script block).
