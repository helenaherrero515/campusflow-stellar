import { useState, useEffect } from "react";
import { getCurrentNetwork, setCurrentNetwork, NETWORKS, validateNetworkSetup } from "../lib/networkConfig";

export default function NetworkSwitcher() {
  const [currentNetwork, setCurrentNetworkState] = useState("TESTNET");
  const [isOpen, setIsOpen] = useState(false);
  const [networkError, setNetworkError] = useState(null);

  useEffect(() => {
    const network = getCurrentNetwork();
    setCurrentNetworkState(network);
    
    // Listen for network changes from other tabs/windows
    const handleNetworkChange = (event) => {
      setCurrentNetworkState(event.detail.network);
    };
    window.addEventListener("networkChanged", handleNetworkChange);
    
    return () => window.removeEventListener("networkChanged", handleNetworkChange);
  }, []);

  const handleNetworkSwitch = (networkKey) => {
    const validation = validateNetworkSetup(networkKey);
    
    if (!validation.valid) {
      setNetworkError(validation.error);
      setTimeout(() => setNetworkError(null), 3000);
      return;
    }

    try {
      setCurrentNetwork(networkKey);
      setCurrentNetworkState(networkKey);
      setIsOpen(false);
      setNetworkError(null);
      window.location.reload(); // Refresh to apply network change
    } catch (error) {
      setNetworkError(error.message);
      setTimeout(() => setNetworkError(null), 3000);
    }
  };

  const config = NETWORKS[currentNetwork];

  return (
    <div style={{ position: "relative" }}>
      {/* Network Badge/Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          borderRadius: "6px",
          border: "1px solid var(--border-color)",
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          fontSize: "12px",
          fontWeight: "600",
          cursor: "pointer",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.target.style.background = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          e.target.style.background = "var(--bg-card)";
        }}
      >
        <span style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: currentNetwork === "MAINNET" ? "#f59e0b" : "#10b981",
        }} />
        {config?.name || "Network"}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "8px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
            minWidth: "280px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: "12px" }}>
            <p style={{
              margin: "0 0 12px 0",
              fontSize: "12px",
              fontWeight: "600",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
              Select Network
            </p>

            {Object.entries(NETWORKS).map(([key, network]) => (
              <button
                key={key}
                onClick={() => handleNetworkSwitch(key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "10px",
                  marginBottom: key === "TESTNET" ? "8px" : "0",
                  border: "1px solid " + (key === currentNetwork ? "var(--accent-primary)" : "var(--border-color)"),
                  borderRadius: "6px",
                  background: key === currentNetwork ? "var(--accent-primary)" + "15" : "transparent",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: key === currentNetwork ? "600" : "500",
                  transition: "all 0.2s",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  if (key !== currentNetwork) {
                    e.target.style.background = "var(--bg-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (key !== currentNetwork) {
                    e.target.style.background = "transparent";
                  }
                }}
              >
                <span style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: key === "MAINNET" ? "#f59e0b" : "#10b981",
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600" }}>{network.name}</div>
                  <div style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    marginTop: "2px",
                  }}>
                    {network.description}
                  </div>
                </div>
                {key === currentNetwork && (
                  <span style={{
                    color: "var(--accent-primary)",
                    fontWeight: "bold",
                  }}>
                    ✓
                  </span>
                )}
              </button>
            ))}

            {/* Network Info */}
            <div style={{
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: "1px solid var(--border-color)",
              fontSize: "11px",
              color: "var(--text-muted)",
            }}>
              <div style={{ marginBottom: "6px" }}>
                <strong>Current:</strong> {config?.name}
              </div>
              <div style={{ marginBottom: "6px" }}>
                <strong>RPC:</strong> {config?.rpcUrl.split("//")[1]}
              </div>
              {config?.contractId && (
                <div style={{
                  wordBreak: "break-all",
                  fontFamily: "monospace",
                }}>
                  <strong>Contract:</strong> {config.contractId.substring(0, 20)}...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {networkError && (
        <div style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          background: "#ef4444",
          color: "white",
          padding: "12px 16px",
          borderRadius: "6px",
          fontSize: "13px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 2000,
        }}>
          {networkError}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
