# EvolveEarth — Architecture Map

*The single-file app is deliberate: `Charka Journey/chakra-destiny.html` opens from
file://, works offline, and carries everything. This map is the module structure —
the physical split is deferred to protect that superpower.*

## Surfaces

| Surface | Path | Purpose |
|---|---|---|
| The app | `Charka Journey/chakra-destiny.html` | Assessment, results, oracle, economy — the product |
| Admin | `Charka Journey/admin.html` | Question bank, marketplace, resources CRUD (shared localStorage) |
| Version archive | `Charka Journey/versions/` | v1-original, v2-mid snapshots |
| Contracts | `EVOLVEEARTH/contracts/` | SoulSignature (Prism), PranaToken, Civilization |
| Bridge | `EVOLVEEARTH/bridge/` | assessment → mint params; standalone mint widget |
| Subnet | `EVOLVEEARTH/subnet/` | Flourishing-reward loss function + protocol spec |
| Tools | `tools/` | validate-app.js (CI), extract-data.js (data snapshots) |

## Feature → function → storage map (the app)

| Feature | Entry / key functions | localStorage keys |
|---|---|---|
| 7-gate assessment | `buildGateScreens` `selectMain` `selectLS` `beginDeepDive` `_deepListFor` | `chakra_sessions` |
| Hold-to-select | `addProximitySelect` (3s dwell) `startChargeTone` | — |
| Gate navigation | `navGate` `unlockGate` | — |
| Question DB | `QUESTION_DB_SEED` `getQuestionBank` | `chakra_question_db_custom` |
| Results | `buildResults` (all builders wrapped in `safe()`) | `chakra_progress` |
| Light Column | `buildLightColumn` `_lcState` | — |
| Constitution + diagnostics | `buildConstitution` `openDiagnostics` `_agniClassify` `dreamLog` | `chakra_diagnostics` `chakra_agni` `chakra_dreams` |
| Healing Dashboard | `openHealingDashboard` `healPractice` `HEAL_MODALITIES` | `chakra_heal_progress` |
| Soul Sanctum (9 chambers) | `openSanctum` `_scBonds/_scStories/_scLegacy/_scCouncil/_scPool/_scRites/_scSkills/_scLineage/_scMentor` | `chakra_entangle` `chakra_stories` `chakra_story_access` `chakra_legacy` `chakra_dao` `chakra_pool` `chakra_rites` `chakra_skills` `chakra_lineage` `chakra_mentor` |
| Marketplace | `buildMarketplaceTab` `MARKETPLACE_SEED` | `chakra_marketplace_custom` `chakra_resources_custom` |
| $PRANA economy | `pranaAward` `pranaSpend` `_checkLevelUp` `pranaLootDraw` | `chakra_prana` |
| Daily practice | `openDailyPanel` `submitCheckin` | `chakra_dailycheck` |
| Vitality (Tamagotchi) | `prismVitality` `applyPrismVitality` | (derives from dailycheck) |
| Rhythms | `openRhythms` `_moonPhase` `_nextConvergence` `_radioToggle` | `chakra_lunar` `chakra_convergence` |
| Milestones | `buildMilestones` `MILESTONE_DEFS` | `chakra_milestones` |
| Oracle (seeing) | `openOraclePanel` `buildOracleScript` `_oracleReflect` `_renderOracleSolutions` | `chakra_oracle_history` |
| **Witnessing Oracle (L3)** | `buildWitnessScript` `_witnessCorpus` `_witnessInsights` `_witnessMirror` `ORACLE_CHARTER` | reads everything above |
| Vault (sovereignty) | `vaultExport` `vaultImport` `VAULT_KEYS` | all of the above |
| Archive | `buildArchiveTab` `archSubmit` | `chakra_archive_subs` |
| Demo mode | `enterDemoMode` | seeds the above |
| Handoff | `handoffExport` `handoffImport` | core reading only |
| Storage seam | `Store` (get/set/remove) → localStorage today, sync backend later | — |
| Mint bridge (inline) | `mintSoulSignature` + inline bridge; reads `deployments.json` w/ fallback | — |

## Contracts (Bittensor Subtensor EVM · Solidity 0.8.24 · OZ 5.0.2 · Shanghai)

| Contract | Key surface |
|---|---|
| `SoulSignature` (Prism/PRISM) | on-chain SVG `tokenURI`; `mint(to,v,p,k,chakra,tribe,chakraStates)`; `addSadhana` (levels → PRANA drops); `inscribeMemorySeal`; `setChakraStates`; entangle trio; `memorialize` (Ancestor Stone, soulbound); helpers `flowOf`/`chakraStateOf` |
| `PranaToken` (PRANA) | `mintReward` (emitter-gated, daily cap, 10% referral royalty); `setReferrer` |
| `PranaPool` | `join/contribute/requestClaim/attestClaim`; `premiumBps` falls with `collectiveFlow` |
| `InitiationRegistry` | `beginRite` (stake) → `witnessRite` ×N → seal on Prism (needs `soul.setOracle(registry,true)`) |
| `MirrorDAO` | `votingPower = flowOf × consistency-decay`; propose/vote |
| `MedicineStory` | `mintStory` gated by healed chakra; `acquire` 90/10 split |

Deploy order: PranaToken → SoulSignature → `prana.setEmitter(soul)` → `soul.setPrana(prana)` → Civilization contracts → `soul.setOracle(registry)`. Addresses land in `EVOLVEEARTH/deployments.json`.

## Data flow to chain
`mainAnswers`+`lsAnswers`+`healingScores` → `SoulBridge.assessmentToSoul()` → mint params (dosha %, dominant chakra, tribe, `chakraStates` 7-char halo string). The Witnessing corpus stays sovereign (local/vault) — only aggregates feed the subnet later, consented.
