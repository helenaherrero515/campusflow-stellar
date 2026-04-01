import React, { useState } from "react";
import { connectWallet } from "../lib/wallet.js";

export default function ConnectWallet({ onConnect }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const { publicKey, network } = await connectWallet();
      if (onConnect) onConnect(publicKey, network);
    } catch (err) {
      setError(err.message || "Failed to connect wallet.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleConnect} disabled={loading}>
        {loading ? "Connecting..." : "Connect Freighter Wallet"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}