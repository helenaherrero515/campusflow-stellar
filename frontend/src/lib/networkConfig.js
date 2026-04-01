/**
 * Network Configuration for CampusFlow
 * Supports Stellar Testnet and Mainnet switching
 */

export const NETWORKS = {
  TESTNET: {
    name: "Testnet",
    passphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    freighterNetwork: "TESTNET",
    horizonUrl: "https://horizon-testnet.stellar.org",
    description: "Development and testing network",
    contractId: import.meta.env.VITE_CONTRACT_ID || "CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG",
  },
  MAINNET: {
    name: "Mainnet",
    passphrase: "Public Global Stellar Network ; September 2015",
    rpcUrl: "https://soroban-mainnet.stellar.org",
    freighterNetwork: "PUBLIC",
    horizonUrl: "https://horizon.stellar.org",
    description: "Production network with real XLM",
    contractId: import.meta.env.VITE_MAINNET_CONTRACT_ID || "", // User must deploy to mainnet
  },
};

// Default to Testnet, but allow override via env var
export const DEFAULT_NETWORK = import.meta.env.VITE_DEFAULT_NETWORK || "TESTNET";

/**
 * Get current network configuration
 * Stored in localStorage for persistence across sessions
 */
export function getCurrentNetwork() {
  const stored = localStorage.getItem("campusflow_network");
  const networkKey = stored || DEFAULT_NETWORK;
  return NETWORKS[networkKey] ? networkKey : DEFAULT_NETWORK;
}

/**
 * Set the current network
 */
export function setCurrentNetwork(networkKey) {
  if (!NETWORKS[networkKey]) {
    throw new Error(`Unknown network: ${networkKey}`);
  }
  localStorage.setItem("campusflow_network", networkKey);
  window.dispatchEvent(
    new CustomEvent("networkChanged", { detail: { network: networkKey } })
  );
}

/**
 * Get network config object for current network
 */
export function getNetworkConfig() {
  const networkKey = getCurrentNetwork();
  return NETWORKS[networkKey];
}

/**
 * Validate contract ID exists for network
 */
export function validateNetworkSetup(networkKey) {
  const config = NETWORKS[networkKey];
  if (!config) {
    return { valid: false, error: `Unknown network: ${networkKey}` };
  }
  if (!config.contractId) {
    return {
      valid: false,
      error: `No contract deployed on ${config.name}. Please deploy first.`,
    };
  }
  return { valid: true };
}
