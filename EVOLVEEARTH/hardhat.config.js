require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
// Bittensor Subtensor EVM endpoints (TAO is the native gas token).
const SUBTENSOR_RPC = process.env.SUBTENSOR_RPC || "https://lite.chain.opentensor.ai";
const SUBTENSOR_TESTNET_RPC =
  process.env.SUBTENSOR_TESTNET_RPC || "https://test.chain.opentensor.ai";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,            // needed for the large on-chain string concatenation
      evmVersion: "shanghai", // Subtensor EVM supports Cancun, but Shanghai avoids the
                              // known ERC-721 "invalid opcode: MCOPY" runtime issue.
    },
  },
  networks: {
    // Local in-memory chain (default — no setup, no real money).
    hardhat: {},

    // Bittensor testnet (Subtensor EVM). Deploy here first.
    // Test TAO is available on request via the Bittensor Discord.
    subtensorTestnet: {
      url: SUBTENSOR_TESTNET_RPC,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 945,
    },

    // Bittensor mainnet (Subtensor EVM). Real TAO. Only after testnet + an audit.
    subtensor: {
      url: SUBTENSOR_RPC,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 964,
    },
  },
};
