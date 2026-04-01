import { useState } from "react";
import { depositAllowance, releaseAllowance, getBalance } from "../lib/contract";

export default function Allowance({ publicKey, onBalanceUpdate, onNotification }) {
  const [studentAddress, setStudentAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [dailyRelease, setDailyRelease] = useState("");
  const [balance, setBalance] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleDeposit() {
    if (!publicKey) {
      setStatus("Error: Connect your wallet first");
      return;
    }

    // Validate student address
    if (!studentAddress.startsWith("G") || studentAddress.length < 50) {
      setStatus("Error: Enter a valid Stellar address (starts with G)");
      return;
    }

    // Validate amounts
    const amountVal = parseFloat(amount);
    const dailyVal = parseFloat(dailyRelease);

    if (!amountVal || amountVal <= 0) {
      setStatus("Error: Enter a valid total amount");
      return;
    }

    if (!dailyVal || dailyVal <= 0) {
      setStatus("Error: Enter a valid daily ceiling");
      return;
    }

    if (dailyVal > amountVal) {
      setStatus("Error: Daily ceiling cannot exceed total amount");
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const amountStroops = BigInt(Math.round(amountVal * 1e7));
      const dailyStroops = BigInt(Math.round(dailyVal * 1e7));

      await depositAllowance(publicKey, studentAddress, amountStroops, dailyStroops);

      setStatus(`Success: Allowance of ${amountVal} XLM locked for ${studentAddress.slice(0, 6)}…`);
      setStudentAddress("");
      setAmount("");
      setDailyRelease("");

      // Notify parent component
      if (onNotification) {
        onNotification("💰", "amber", "Allowance Deposited", `${amountVal} XLM locked for ${studentAddress.slice(0, 6)}…${studentAddress.slice(-4)}`);
      }
    } catch (err) {
      setStatus(`Error: ${err.message || "Deposit failed"}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleRelease() {
    if (!publicKey) {
      setStatus("Error: Connect your wallet first");
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const result = await releaseAllowance(publicKey);
      setStatus("Success: Allowance released for today. Check your balance.");

      // Refresh balance
      const newBalance = await getBalance(publicKey);
      const xlm = Number(newBalance) / 1e7;
      setBalance(xlm.toFixed(4));

      if (onBalanceUpdate) {
        onBalanceUpdate(newBalance);
      }

      if (onNotification) {
        onNotification("📤", "blue", "Allowance Released", `Daily drip sent to your wallet. 24-hour cooldown restarted.`);
      }
    } catch (err) {
      // Handle cooldown error specifically
      if (err.message && err.message.includes("cooldown")) {
        setStatus("Error: You can only release once every 24 hours. Try again tomorrow.");
      } else {
        setStatus(`Error: ${err.message || "Release failed"}`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGetBalance() {
    if (!publicKey && !studentAddress) {
      setStatus("Error: Enter a student address or connect wallet");
      return;
    }

    try {
      const addr = studentAddress || publicKey;
      const bal = await getBalance(addr);
      const xlm = Number(bal) / 1e7;
      setBalance(xlm.toFixed(4));
      setStatus(`Balance: ${xlm.toFixed(4)} XLM (${Math.round(xlm * 117.9).toLocaleString()} PHP)`);
    } catch (err) {
      setStatus(`Error: ${err.message || "Failed to fetch balance"}`);
    }
  }

  return (
    <div className="allowance-panel" style={{ maxWidth: "600px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "24px", fontSize: "24px", fontWeight: "700" }}>
        Allowance Management
      </h2>

      {/* Deposit Section */}
      <div style={{ marginBottom: "32px", padding: "20px", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
          Deposit Allowance for Student
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            placeholder="Student address (G...)"
            value={studentAddress}
            onChange={(e) => setStudentAddress(e.target.value)}
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              fontFamily: "monospace",
              fontSize: "12px",
            }}
          />
          <input
            placeholder="Total amount (XLM)"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
            }}
          />
          <input
            placeholder="Daily ceiling (XLM)"
            type="number"
            step="0.01"
            value={dailyRelease}
            onChange={(e) => setDailyRelease(e.target.value)}
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
            }}
          />
          <button
            onClick={handleDeposit}
            disabled={loading}
            style={{
              padding: "12px 20px",
              background: loading ? "var(--text-muted)" : "var(--accent-purple)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Processing..." : "Lock Allowance"}
          </button>
        </div>
      </div>

      {/* Release Section */}
      <div style={{ marginBottom: "32px", padding: "20px", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
          Release Today's Drip
        </h3>
        <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "16px" }}>
          Released funds become available immediately. Next release available in 24 hours.
        </p>
        <button
          onClick={handleRelease}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px 20px",
            background: loading ? "var(--text-muted)" : "var(--accent-green)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Processing..." : "Release Allowance"}
        </button>
      </div>

      {/* Check Balance Section */}
      <div style={{ marginBottom: "32px", padding: "20px", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
          Check Balance
        </h3>
        <button
          onClick={handleGetBalance}
          style={{
            width: "100%",
            padding: "12px 20px",
            background: "var(--neon)",
            color: "black",
            border: "none",
            borderRadius: "8px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Get Balance
        </button>
        {balance !== null && (
          <div style={{ marginTop: "16px", padding: "12px", background: "rgba(0,212,255,0.1)", borderRadius: "8px", borderLeft: "3px solid var(--neon)" }}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Balance</div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--neon)" }}>
              {balance} XLM
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              ≈ {Math.round(parseFloat(balance) * 117.9).toLocaleString()} PHP
            </div>
          </div>
        )}
      </div>

      {/* Status Message */}
      {status && (
        <div style={{
          padding: "16px",
          borderRadius: "8px",
          background: status.includes("Success") ? "rgba(0,229,160,0.1)" : "rgba(255,77,106,0.1)",
          borderLeft: `3px solid ${status.includes("Success") ? "var(--accent-green)" : "var(--accent-red)"}`,
          color: status.includes("Success") ? "var(--accent-green)" : "var(--accent-red)",
          fontSize: "14px",
        }}>
          {status}
        </div>
      )}
    </div>
  );
}
