import { useState, useEffect } from "react";
import { createSplit, payShare, getSplit, verifySplit } from "../lib/contract";

export default function SplitBill({ publicKey, onPaymentSuccess, onNotification }) {
  // Create Split Form State
  const [participants, setParticipants] = useState("");
  const [shareAmount, setShareAmount] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createStatus, setCreateStatus] = useState(null);

  // Pay Share State
  const [splitId, setSplitId] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payStatus, setPayStatus] = useState(null);

  // Active Splits Display
  const [activeSplits, setActiveSplits] = useState([]);
  const [splitsLoading, setSplitsLoading] = useState(false);

  // Verify Split State
  const [verifySplitId, setVerifySplitId] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);

  async function handleCreateSplit() {
    if (!publicKey) {
      setCreateStatus("Error: Connect your wallet first");
      return;
    }

    if (!participants.trim()) {
      setCreateStatus("Error: Enter at least one participant address");
      return;
    }

    const amount = parseFloat(shareAmount);
    if (!amount || amount <= 0) {
      setCreateStatus("Error: Enter a valid share amount");
      return;
    }

    setCreateLoading(true);
    setCreateStatus(null);

    try {
      const participantList = participants
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      // Validate addresses
      const validAddrs = participantList.every((a) => a.startsWith("G") && a.length >= 50);
      if (!validAddrs) {
        setCreateStatus("Error: All addresses must start with G and be 56 characters long");
        return;
      }

      const amountStroops = BigInt(Math.round(amount * 1e7));
      const result = await createSplit(publicKey, participantList, amountStroops);

      setCreateStatus(`Success: Split created for ${participantList.length} participants!`);
      setParticipants("");
      setShareAmount("");

      if (onNotification) {
        onNotification("➕", "blue", "New Split Created", `${participantList.length}-person split of ${amount} XLM created.`);
      }

      // Refresh active splits
      await fetchActiveSplits();
    } catch (err) {
      setCreateStatus(`Error: ${err.message || "Split creation failed"}`);
    } finally {
      setCreateLoading(false);
    }
  }

  async function handlePayShare() {
    if (!publicKey) {
      setPayStatus("Error: Connect your wallet first");
      return;
    }

    if (!splitId || isNaN(parseInt(splitId))) {
      setPayStatus("Error: Enter a valid split ID");
      return;
    }

    setPayLoading(true);
    setPayStatus(null);

    try {
      const splitIdNum = parseInt(splitId);
      await payShare(publicKey, splitIdNum);

      setPayStatus("Success: Share paid successfully!");
      setSplitId("");

      // Try to verify settlement
      try {
        const isSettled = await verifySplit(publicKey, splitIdNum);
        if (isSettled) {
          if (onNotification) {
            onNotification("✔", "green", "Split Settled", `Split ${splitIdNum} has been fully settled!`);
          }
        } else {
          if (onNotification) {
            onNotification("💳", "blue", "Share Paid", `Your share for split ${splitIdNum} paid.`);
          }
        }
      } catch {
        if (onNotification) {
          onNotification("💳", "blue", "Share Paid", `Your share for split ${splitIdNum} paid.`);
        }
      }

      if (onPaymentSuccess) {
        onPaymentSuccess(splitIdNum);
      }

      await fetchActiveSplits();
    } catch (err) {
      setPayStatus(`Error: ${err.message || "Payment failed"}`);
    } finally {
      setPayLoading(false);
    }
  }

  async function handleVerify() {
    if (!publicKey) {
      setPayStatus("Error: Connect your wallet first");
      return;
    }

    if (!verifySplitId || isNaN(parseInt(verifySplitId))) {
      setPayStatus("Error: Enter a valid split ID");
      return;
    }

    try {
      const splitIdNum = parseInt(verifySplitId);
      const result = await verifySplit(publicKey, splitIdNum);
      setVerifyResult(result);
      setPayStatus(result ? "Split is SETTLED" : "Split is still PENDING");
    } catch (err) {
      setPayStatus(`Error: ${err.message || "Verification failed"}`);
    }
  }

  async function fetchActiveSplits() {
    if (!publicKey) return;

    setSplitsLoading(true);
    try {
      // Try to fetch a few common split IDs (in production, would query from contract)
      const fetchedSplits = [];

      for (let i = 1; i <= 5; i++) {
        try {
          const splitData = await getSplit(publicKey, i);
          if (splitData) {
            fetchedSplits.push({
              id: i,
              ...splitData,
            });
          }
        } catch {
          // Continue to next ID
        }
      }

      setActiveSplits(fetchedSplits);
    } catch (err) {
      console.error("Failed to fetch splits:", err);
    } finally {
      setSplitsLoading(false);
    }
  }

  // Fetch splits on mount
  useEffect(() => {
    if (publicKey) {
      fetchActiveSplits();
    }
  }, [publicKey]);

  return (
    <div className="split-bill-panel" style={{ maxWidth: "800px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "24px", fontSize: "24px", fontWeight: "700" }}>
        Split Expense Management
      </h2>

      {/* Create Split Section */}
      <div style={{ marginBottom: "32px", padding: "20px", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
          Create New Split
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "8px" }}>
              Participant Addresses (comma-separated)
            </label>
            <textarea
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="G... , G... , G..."
              style={{
                width: "100%",
                minHeight: "80px",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                fontFamily: "monospace",
                fontSize: "12px",
                resize: "vertical",
              }}
            />
          </div>
          <input
            placeholder="Share amount per person (XLM)"
            type="number"
            step="0.01"
            value={shareAmount}
            onChange={(e) => setShareAmount(e.target.value)}
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
            }}
          />
          <button
            onClick={handleCreateSplit}
            disabled={createLoading}
            style={{
              padding: "12px 20px",
              background: createLoading ? "var(--text-muted)" : "var(--accent-purple)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: createLoading ? "not-allowed" : "pointer",
              opacity: createLoading ? 0.6 : 1,
            }}
          >
            {createLoading ? "Creating..." : "Create Split"}
          </button>
        </div>

        {createStatus && (
          <div style={{
            marginTop: "16px",
            padding: "12px",
            borderRadius: "8px",
            background: createStatus.includes("Success") ? "rgba(0,229,160,0.1)" : "rgba(255,77,106,0.1)",
            borderLeft: `3px solid ${createStatus.includes("Success") ? "var(--accent-green)" : "var(--accent-red)"}`,
            color: createStatus.includes("Success") ? "var(--accent-green)" : "var(--accent-red)",
            fontSize: "14px",
          }}>
            {createStatus}
          </div>
        )}
      </div>

      {/* Pay Share Section */}
      <div style={{ marginBottom: "32px", padding: "20px", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
          Pay My Share
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            placeholder="Split ID"
            type="number"
            value={splitId}
            onChange={(e) => setSplitId(e.target.value)}
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
            }}
          />
          <button
            onClick={handlePayShare}
            disabled={payLoading}
            style={{
              padding: "12px 20px",
              background: payLoading ? "var(--text-muted)" : "var(--accent-green)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: payLoading ? "not-allowed" : "pointer",
              opacity: payLoading ? 0.6 : 1,
            }}
          >
            {payLoading ? "Processing..." : "Pay Share"}
          </button>
        </div>

        {payStatus && (
          <div style={{
            marginTop: "16px",
            padding: "12px",
            borderRadius: "8px",
            background: payStatus.includes("Success") || payStatus.includes("SETTLED") ? "rgba(0,229,160,0.1)" : "rgba(255,179,64,0.1)",
            borderLeft: `3px solid ${payStatus.includes("Success") || payStatus.includes("SETTLED") ? "var(--accent-green)" : "var(--accent-amber)"}`,
            color: payStatus.includes("Success") || payStatus.includes("SETTLED") ? "var(--accent-green)" : "var(--accent-amber)",
            fontSize: "14px",
          }}>
            {payStatus}
          </div>
        )}
      </div>

      {/* Verify Settlement Section */}
      <div style={{ marginBottom: "32px", padding: "20px", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
          Verify Settlement
        </h3>
        <div style={{ display: "flex", gap: "12px" }}>
          <input
            placeholder="Split ID"
            type="number"
            value={verifySplitId}
            onChange={(e) => setVerifySplitId(e.target.value)}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
            }}
          />
          <button
            onClick={handleVerify}
            style={{
              padding: "12px 20px",
              background: "var(--neon)",
              color: "black",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Verify
          </button>
        </div>

        {verifyResult !== null && (
          <div style={{
            marginTop: "16px",
            padding: "12px",
            borderRadius: "8px",
            background: verifyResult ? "rgba(0,229,160,0.1)" : "rgba(0,212,255,0.1)",
            borderLeft: `3px solid ${verifyResult ? "var(--accent-green)" : "var(--neon)"}`,
            color: verifyResult ? "var(--accent-green)" : "var(--neon)",
            fontSize: "14px",
          }}>
            {verifyResult ? "✓ Split is SETTLED - Funds transferred to payer" : "⏳ Split is PENDING - Awaiting more payments"}
          </div>
        )}
      </div>

      {/* Active Splits Display */}
      {activeSplits.length > 0 && (
        <div style={{ padding: "20px", background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
            Active Splits ({activeSplits.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {activeSplits.map((split) => (
              <div key={split.id} style={{
                padding: "12px",
                background: "var(--bg-input)",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontWeight: "600" }}>Split #{split.id}</span>
                  <span style={{
                    fontSize: "12px",
                    padding: "4px 8px",
                    background: split.settled ? "var(--accent-green)" : "var(--accent-amber)",
                    color: "white",
                    borderRadius: "4px",
                  }}>
                    {split.settled ? "Settled" : "Pending"}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Participants: {split.participants?.length || 0} | Share: {(Number(split.share_amount) / 1e7).toFixed(4)} XLM | Collected: {(Number(split.collected) / 1e7).toFixed(4)} / {(Number(split.total_expected) / 1e7).toFixed(4)} XLM
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
