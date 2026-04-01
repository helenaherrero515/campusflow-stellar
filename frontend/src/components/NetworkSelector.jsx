/**
 * NetworkSelector.jsx - UI component to switch between networks
 * Displays current network and allows switching to available networks
 */

import { useState, useEffect } from "react";
import { NETWORKS, getCurrentNetwork, setCurrentNetwork } from "../lib/networkConfig";

export default function NetworkSelector() {
  const [currentNetwork, setCurrentNetworkState] = useState("TESTNET");
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const network = getCurrentNetwork();
    setCurrentNetworkState(network);

    // Listen for network changes from other instances (tabs, etc.)
    const handleNetworkChanged = (e) => {
      setCurrentNetworkState(e.detail.network);
    };
    window.addEventListener("networkChanged", handleNetworkChanged);
    return () => window.removeEventListener("networkChanged", handleNetworkChanged);
  }, []);

  const config = NETWORKS[currentNetwork];

  function handleNetworkChange(networkKey) {
    // Validate contract is deployed on target network
    if (!NETWORKS[networkKey].contractId) {
      setError(
        `Contract not deployed on ${NETWORKS[networkKey].name}. Please deploy first.`
      );
      setTimeout(() => setError(null), 3000);
      return;
    }

    setCurrentNetwork(networkKey);
    setCurrentNetworkState(networkKey);
    setShowDropdown(false);
    setError(null);

    // Notify app that network changed (reload may be needed)
    window.location.reload();
  }

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
      }}
    >
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          padding: "8px 16px",
          borderRadius: "8px",
          border: "1px solid var(--border-color)",
          background: currentNetwork === "TESTNET" ? "var(--accent-testnet)" : "var(--accent-mainnet)",
          color: "white",
          cursor: "pointer",
          fontWeight: "600",
          fontSize: "14px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: currentNetwork === "TESTNET" ? "#10b981" : "#f59e0b",
          display: "inline-block",
        }} />
        {config?.name || "Unknown"}
        <span style={{ fontSize: "12px" }}>▼</span>
      </button>

      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "8px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            minWidth: "200px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 1000,
          }}
        >
          {Object.entries(NETWORKS).map(([key, net]) => (
            <button
              key={key}
              onClick={() => handleNetworkChange(key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                width: "100%",
                padding: "12px 16px",
                background: key === currentNetwork ? "var(--bg-hover)" : "transparent",
                border: "none",
                borderBottom: key !== Object.keys(NETWORKS)[Object.keys(NETWORKS).length - 1] ? "1px solid var(--border-color)" : "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.2s",
              }}
              onMouseOver={(e) => {
                if (key !== currentNetwork) {
                  e.target.style.background = "var(--bg-hover)";
                }
              }}
              onMouseOut={(e) => {
                if (key !== currentNetwork) {
                  e.target.style.background = "transparent";
                }
              }}
            >
              <div>
                <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-primary)" }}>
                  {net.name}
                  {key === currentNetwork && " ✓"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                  {net.description}
                </div>
                {!net.contractId && (
                  <div style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>
                    ⚠ Contract not deployed
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "8px",
            padding: "12px",
            background: "#fee",
            border: "1px solid #fcc",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#c00",
            zIndex: 999,
          }}
        >
          {error}
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {showDropdown && (
        <div
          onClick={() => setShowDropdown(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          }}
        />
      )}
    </div>
  );
}
