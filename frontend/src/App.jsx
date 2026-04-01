import { useState, useEffect, useCallback } from "react";
import { connectWallet, getWalletPublicKey } from "./lib/wallet";
import FreighterInstall from "./components/FreighterInstall";
import NetworkSelector from "./components/NetworkSelector";
import {
  getBalance,
  releaseAllowance,
  depositAllowance,
  payShare,
  createSplit,
  verifySplit,
  getSplit,
} from "./lib/contract";

// ── Tiny reusable helpers ────────────────────────────────────────────────────

function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

function Toast({ msg, type, show }) {
  return (
    <div id="toast" className={[show ? "show" : "", type].filter(Boolean).join(" ")}>
      {msg}
    </div>
  );
}

// ── ExpenseCard sub-component ────────────────────────────────────────────────
function ExpenseCard({
  splitId, icon, name, sub, total, perPerson,
  badge, badgeText, progress, progressGradient,
  collected, participants, shareLabel, shareStyle,
  isSettled, isLoading, onPay,
}) {
  return (
    <div className={`expense-card${isSettled ? " settled" : ""}`}>
      <div className="expense-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="expense-group-icon">{icon}</div>
          <div>
            <div className="expense-group-name">{name}</div>
            <div className="expense-group-sub">{sub}</div>
          </div>
        </div>
        <span className={`badge ${isSettled ? "badge-paid" : badge}`}>
          {isSettled ? "Submitted" : badgeText}
        </span>
      </div>
      <div className="expense-total">{total}</div>
      <div className="expense-per-person">{perPerson}</div>
      <div className="participant-list">
        {participants.map((p) => (
          <div className="participant-row" key={p.name}>
            <div className="participant-name-wrap">
              <div className={`avatar avatar-${p.c}`}>{p.l}</div>
              <span className="participant-name">{p.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="participant-amount">{p.amount}</span>
              <span className={`badge ${p.badge}`}>{p.badgeText}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="expense-progress-wrap">
        <div className="expense-progress-meta">
          <span>Collected</span>
          <span>{collected}</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(isSettled ? Math.min(progress + 20, 100) : progress, 100)}%`,
              ...(progressGradient ? { background: progressGradient } : {}),
            }}
          />
        </div>
      </div>
      {isSettled ? (
        <div className="settled-overlay">✔ Your share submitted · pending settlement</div>
      ) : (
        <button
          className="btn-pay-share"
          style={shareStyle}
          onClick={onPay}
          disabled={isLoading}
        >
          {isLoading ? <><Spinner /> Signing…</> : shareLabel}
        </button>
      )}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── Wallet state ────────────────────────────────────────────
  const [showInstall, setShowInstall] = useState(false);
  const [connectedKey, setConnectedKey] = useState(null);
  const [walletShort, setWalletShort] = useState("");
  const [connectLoading, setConnectLoading] = useState(false);

  // ── Balance state ───────────────────────────────────────────
  const [balanceDisplay, setBalanceDisplay] = useState("₱ 480");
  const [balanceSub, setBalanceSub] = useState("≈ 4.08 XLM · Updated just now");

  // ── Action loading states ───────────────────────────────────
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [payLoadingId, setPayLoadingId] = useState(null);

  // ── Optimistic settled splits ───────────────────────────────
  const [settledSplits, setSettledSplits] = useState(new Set());

  // ── Toast ───────────────────────────────────────────────────
  const [toast, setToast] = useState({ msg: "", type: "", show: false });

  // ── Deposit form inputs ─────────────────────────────────────
  const [inputStudent, setInputStudent] = useState("");
  const [inputAmount, setInputAmount] = useState("");
  const [inputDaily, setInputDaily] = useState("");

  // ── Create split form ───────────────────────────────────────
  const [showCreateSplit, setShowCreateSplit] = useState(false);
  const [createSplitLoading, setCreateSplitLoading] = useState(false);
  const [splitParticipants, setSplitParticipants] = useState("");
  const [splitAmount, setSplitAmount] = useState("");

  // ── Deposit allowance form ──────────────────────────────────
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositFormLoading, setDepositFormLoading] = useState(false);

  // ── Active splits from contract ──────────────────────────────
  const [activeSplits, setActiveSplits] = useState([
    { id: 1, icon: "🍜", name: "Jollibee Run", sub: "Shared meal · 4 members", total: "₱ 480.00", perPerson: "₱ 120.00 per person", badge: "badge-pending", badgeText: "Pending", progress: 100, collected: "₱ 480 / ₱ 480", participants: [{ l: "H", c: "a", name: "Helena R. (payer)", badge: "badge-paid", badgeText: "Paid", amount: "₱ 120" }, { l: "M", c: "b", name: "Marco T.", badge: "badge-paid", badgeText: "Paid", amount: "₱ 120" }, { l: "A", c: "c", name: "Anna S.", badge: "badge-paid", badgeText: "Paid", amount: "₱ 120" }, { l: "J", c: "d", name: "Jose L.", badge: "badge-paid", badgeText: "Paid", amount: "₱ 120" }], shareLabel: "Settlement confirmed", isSettled: true },
  ]);

  // ── Notifications ───────────────────────────────────────────
  const [notifications, setNotifications] = useState([
    { icon: "✔",  color: "green",  title: "Split Settled — Jollibee Run",          desc: "All 4 participants paid. ₱ 480.00 transferred to Helena R. via Soroban auto-settlement.", time: "Mar 29 · 7:42 PM" },
    { icon: "📤", color: "blue",   title: "Allowance Released Today — Helena R.",  desc: "Daily drip of ₱ 160.00 XLM released to student wallet. 24-hour cooldown restarted.",     time: "Today · 8:00 AM" },
    { icon: "⚠",  color: "red",    title: "Overdue Contribution — Grocery Run",   desc: "Helena R. and Jose L. have not paid their ₱ 240.00 share. Payment is 2 days overdue.",   time: "Mar 28 · 11:00 PM" },
    { icon: "✔",  color: "green",  title: "Split Settled — Commute Pool",          desc: "All 3 participants paid. ₱ 360.00 transferred to Jose L. Settlement confirmed on Stellar Testnet.", time: "Mar 28 · 3:15 PM" },
    { icon: "💰", color: "amber",  title: "Allowance Deposited — Parent View",    desc: "₱ 3,200.00 locked for Helena R. by parent wallet G8XN...P2QV. Weekly schedule active.",  time: "Mar 24 · 9:00 AM" },
    { icon: "➕", color: "blue",   title: "New Split Created — March Electricity", desc: "Helena R. created a 3-person split of ₱ 600.00. Rico D. payment is pending. Split ID #004.", time: "Mar 27 · 6:30 PM" },
    { icon: "📥", color: "blue",   title: "Contribution Received — WiFi Subscription", desc: "Helena R. paid ₱ 300.00 share. 2 of 5 participants have contributed. Awaiting Marco T.", time: "Mar 27 · 4:10 PM" },
    { icon: "🔒", color: "purple", title: "Allowance Locked — Release Scheduled", desc: "Next release for Helena R. on Monday, Mar 31 at 8:00 AM. ₱ 160.00 locked in Soroban escrow.", time: "Mar 30 · 8:01 AM" },
  ]);

  // ── Toast helper ──────────────────────────────────────────��──
  const showToast = useCallback((msg, type = "info") => {
    setToast({ msg, type, show: true });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 4000);
  }, []);

  // ── Prepend notification ─────────────────────────────────────
  const prependNotif = useCallback((icon, color, title, desc) => {
    setNotifications((prev) => [
      { icon, color, title, desc, time: "Just now" },
      ...prev,
    ]);
  }, []);

  // ── Refresh on-chain balance ──────────────────────────────────
  const refreshBalance = useCallback(async (key) => {
    try {
      const raw = await getBalance(key);
      const xlm = Number(raw) / 1e7;
      const php = Math.round(xlm * 117.9);
      setBalanceDisplay(`₱ ${php.toLocaleString()}`);
      setBalanceSub(`≈ ${xlm.toFixed(4)} XLM · Just now`);
    } catch {
      // Contract not yet funded — keep static placeholder
    }
  }, []);

  // ── Apply wallet connected UI state ──────────────────────────
  const applyConnectedState = useCallback(
    (key) => {
      setConnectedKey(key);
      setWalletShort(key.slice(0, 4) + "..." + key.slice(-4));
      refreshBalance(key);
    },
    [refreshBalance]
  );

  // ── Auto-detect existing Freighter session ───────────────────
  useEffect(() => {
    (async () => {
      try {
        const key = await getWalletPublicKey();
        if (key) applyConnectedState(key);
      } catch {
        // Not connected — that's fine
      }
    })();
  }, [applyConnectedState]);

  // ── Connect wallet ────────────────────────────────────────────
  async function handleConnect() {
    setConnectLoading(true);
    try {
      const { publicKey } = await connectWallet();
      applyConnectedState(publicKey);
      setShowInstall(false);
      showToast(
        `Connected: ${publicKey.slice(0, 6)}\u2026${publicKey.slice(-4)}`,
        "success"
      );
    } catch (err) {
      if (err.freighterMissing || err.message === "FREIGHTER_NOT_FOUND") {
        setShowInstall(true);
      } else {
        showToast(err.message || "Connection failed", "error");
      }
    } finally {
      setConnectLoading(false);
    }
  }

  // ── Release today's allowance ─────────────────────────────────
  async function handleReleaseAllowance() {
    if (!connectedKey) return showToast("Connect your wallet first", "error");
    setReleaseLoading(true);
    try {
      await releaseAllowance(connectedKey);
      showToast("Allowance released! ₱ 160 added to your balance.", "success");
      await refreshBalance(connectedKey);
      prependNotif(
        "📤",
        "blue",
        "Allowance Released",
        "Daily drip sent to your wallet. 24-hour cooldown restarted."
      );
    } catch (err) {
      const msg = err.message || "Release failed";
      if (msg.includes("cooldown") || msg.includes("86400")) {
        showToast("24-hour cooldown active. Come back tomorrow.", "error");
      } else if (msg.includes("balance") || msg.includes("zero")) {
        showToast("No allowance locked. Deposit first.", "error");
      } else {
        showToast(msg, "error");
      }
    } finally {
      setReleaseLoading(false);
    }
  }

  // ── Deposit allowance (parent action) ─────────────────────────
  async function handleDeposit() {
    if (!connectedKey) return showToast("Connect your wallet first", "error");
    if (!inputStudent.startsWith("G") || inputStudent.length < 10)
      return showToast("Enter a valid Stellar address (starts with G)", "error");
    const amount = parseFloat(inputAmount);
    const daily = parseFloat(inputDaily);
    if (!amount || amount <= 0)
      return showToast("Enter a valid total amount", "error");
    if (!daily || daily <= 0)
      return showToast("Enter a valid daily ceiling", "error");
    if (daily > amount)
      return showToast("Daily ceiling cannot exceed total amount", "error");

    setDepositLoading(true);
    try {
      const amountStroops = BigInt(Math.round(amount * 1e7));
      const dailyStroops = BigInt(Math.round(daily * 1e7));
      await depositAllowance(connectedKey, inputStudent, amountStroops, dailyStroops);
      showToast(
        `Allowance of ${amount} XLM locked for ${inputStudent.slice(0, 6)}…`,
        "success"
      );
      setInputStudent("");
      setInputAmount("");
      setInputDaily("");
      prependNotif(
        "💰",
        "amber",
        "Allowance Deposited",
        `${amount} XLM locked for ${inputStudent.slice(0, 6)}…${inputStudent.slice(-4)}. Daily ceiling: ${daily} XLM.`
      );
    } catch (err) {
      showToast(err.message || "Deposit failed", "error");
    } finally {
      setDepositLoading(false);
    }
  }

  // ── Create a new split ──────────────────────────────────────
  async function handleCreateSplit() {
    if (!connectedKey) return showToast("Connect your wallet first", "error");
    if (!splitParticipants.trim())
      return showToast("Enter at least one participant address", "error");
    const amount = parseFloat(splitAmount);
    if (!amount || amount <= 0)
      return showToast("Enter a valid share amount", "error");

    setCreateSplitLoading(true);
    try {
      const participants = splitParticipants
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      // Validate addresses
      const validAddrs = participants.every((a) => a.startsWith("G") && a.length >= 50);
      if (!validAddrs)
        return showToast("Enter valid Stellar addresses (start with G)", "error");

      const amountStroops = BigInt(Math.round(amount * 1e7));
      await createSplit(connectedKey, participants, amountStroops);
      
      showToast(
        `Split created for ${participants.length} participants!`,
        "success"
      );
      setSplitParticipants("");
      setSplitAmount("");
      setShowCreateSplit(false);
      
      prependNotif(
        "➕",
        "blue",
        "New Split Created",
        `${participants.length}-person split of ${amount} XLM created. Awaiting payments.`
      );
    } catch (err) {
      showToast(err.message || "Split creation failed", "error");
    } finally {
      setCreateSplitLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Show Freighter install screen if extension not found
  if (showInstall) {
    return (
      <FreighterInstall
        onRetry={() => {
          setShowInstall(false);
          handleConnect();
        }}
        onDismiss={() => setShowInstall(false)}
      />
    );
  }

  return (
    <>
      <Toast msg={toast.msg} type={toast.type} show={toast.show} />

      {/* ════════════════════════════════════════════════════════
          NAV
      ════════════════════════════════════════════════════════ */}
      <nav>
        <div className="wrapper">
          <div className="nav-inner">
            <a href="#" className="nav-logo">
              <div className="nav-logo-mark">CF</div>
              <span className="nav-logo-text">
                Campus<span>Flow</span>
              </span>
            </a>

            <ul className="nav-links">
              <li><a href="#dashboard">Dashboard</a></li>
              <li><a href="#expenses">Expenses</a></li>
              <li><a href="#contributions">Contributions</a></li>
              <li><a href="#parent">Overview</a></li>
              <li><a href="#notifications">Alerts</a></li>
            </ul>

            <div className="nav-wallet-area">
              <NetworkSelector />

              {connectedKey ? (
                <div 
                  className="wallet-pill"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 14px",
                    background: "rgba(76,175,80,0.1)",
                    border: "1px solid rgba(76,175,80,0.3)",
                    borderRadius: "20px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(76,175,80,0.15)";
                    e.currentTarget.style.borderColor = "rgba(76,175,80,0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(76,175,80,0.1)";
                    e.currentTarget.style.borderColor = "rgba(76,175,80,0.3)";
                  }}
                  title={connectedKey}
                >
                  <span className="dot" style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#4CAF50",
                    display: "inline-block",
                  }} />
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>{walletShort}</span>
                  <span style={{ fontSize: "11px", opacity: 0.7 }}>✓</span>
                </div>
              ) : (
                <button
                  id="btn-connect-nav"
                  onClick={handleConnect}
                  disabled={connectLoading}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#2196F3",
                    color: "white",
                    cursor: connectLoading ? "not-allowed" : "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                    opacity: connectLoading ? 0.7 : 1,
                  }}
                >
                  {connectLoading ? (
                    <><Spinner /> Connecting…</>
                  ) : (
                    "Connect Wallet"
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════
          HERO
      ═════════════════════════════════��══════════════════════ */}
      <section className="hero" id="home">
        <div className="wrapper">
          <div className="hero-eyebrow">
            On-Chain Finance for Students · Southeast Asia
          </div>

          <h1 className="hero-title">
            Automate allowances.<br />
            <span className="highlight">Settle shared costs</span><br />
            without the friction.
          </h1>

          <p className="hero-desc">
            CampusFlow Wallet uses Stellar Soroban smart contracts to schedule
            daily allowance releases, coordinate shared expense groups, and
            settle roommate bills — transparently and automatically.
          </p>

          <div className="hero-cta-row">
            <a href="#dashboard" className="btn-primary">↓ View Dashboard</a>
            <a href="#expenses" className="btn-secondary">Shared Expenses →</a>
          </div>

          {/* Wallet Connection Banner */}
          <div
            id="wallet-banner"
            className={connectedKey ? "connected" : ""}
            style={{
              background: connectedKey ? "linear-gradient(135deg, rgba(76,175,80,0.1), rgba(56,142,60,0.1))" : "linear-gradient(135deg, rgba(33,150,243,0.1), rgba(21,101,192,0.1))",
              border: connectedKey ? "1px solid rgba(76,175,80,0.3)" : "1px solid rgba(33,150,243,0.3)",
              borderRadius: "12px",
              padding: "20px",
              marginTop: "20px",
            }}
          >
            <div className="banner-left">
              <div className={`banner-icon${connectedKey ? " green" : ""}`}>
                {connectedKey ? "✅" : "🔗"}
              </div>
              <div style={{ flex: 1 }}>
                <div className="banner-title">
                  {connectedKey
                    ? "Wallet Connected"
                    : "Connect Your Freighter Wallet"}
                </div>
                {connectedKey ? (
                  <div className="banner-sub">
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
                      <span style={{ 
                        background: "rgba(76,175,80,0.2)",
                        color: "#4CAF50",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}>
                        ✓ Active
                      </span>
                      <span className="addr" style={{ fontSize: "13px" }}>
                        {connectedKey.slice(0, 8)}...{connectedKey.slice(-8)}
                      </span>
                      <span style={{ fontSize: "12px", opacity: 0.7 }}>·</span>
                      <span style={{ fontSize: "12px", opacity: 0.8 }}>Stellar Testnet</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
                      <div style={{ 
                        background: "rgba(0,0,0,0.05)", 
                        padding: "8px 12px",
                        borderRadius: "6px",
                      }}>
                        <div style={{ fontSize: "11px", opacity: 0.7, marginBottom: "4px" }}>Available Balance</div>
                        <div style={{ fontSize: "14px", fontWeight: "600" }}>{balanceDisplay}</div>
                      </div>
                      <div style={{ 
                        background: "rgba(0,0,0,0.05)", 
                        padding: "8px 12px",
                        borderRadius: "6px",
                      }}>
                        <div style={{ fontSize: "11px", opacity: 0.7, marginBottom: "4px" }}>Contract ID</div>
                        <div style={{ fontSize: "12px", fontWeight: "600", fontFamily: "monospace", opacity: 0.8 }}>
                          CA4KZTR6…JGICNG
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="banner-sub">
                    Link your Stellar wallet to interact with the Soroban contract on Testnet.
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {connectedKey ? (
                <>
                  <button
                    onClick={handleConnect}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      border: "1px solid rgba(76,175,80,0.3)",
                      background: "rgba(76,175,80,0.1)",
                      color: "#2E7D32",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "rgba(76,175,80,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "rgba(76,175,80,0.1)";
                    }}
                  >
                    Switch Wallet
                  </button>
                  <button
                    onClick={() => {
                      setConnectedKey(null);
                      setWalletShort("");
                      showToast("Wallet disconnected", "success");
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      border: "1px solid rgba(244,67,54,0.3)",
                      background: "rgba(244,67,54,0.1)",
                      color: "#C62828",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "rgba(244,67,54,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "rgba(244,67,54,0.1)";
                    }}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  id="btn-connect-banner"
                  onClick={handleConnect}
                  disabled={connectLoading}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#2196F3",
                    color: "white",
                    cursor: connectLoading ? "not-allowed" : "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                    opacity: connectLoading ? 0.7 : 1,
                  }}
                >
                  {connectLoading ? (
                    <><Spinner /> Connecting…</>
                  ) : (
                    "Connect Freighter"
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="hero-stats">
            <div className="hero-stat-item">
              <span className="hero-stat-value">₱3,200</span>
              <span className="hero-stat-label">Weekly Allowance Pool</span>
            </div>
            <div className="hero-stat-item">
              <span className="hero-stat-value">6</span>
              <span className="hero-stat-label">Active Split Groups</span>
            </div>
            <div className="hero-stat-item">
              <span className="hero-stat-value">100%</span>
              <span className="hero-stat-label">Settlements On-Chain</span>
            </div>
            <div className="hero-stat-item">
              <span className="hero-stat-value">&lt;3s</span>
              <span className="hero-stat-label">Avg Settlement Time</span>
            </div>
          </div>

          <div className="feature-grid">
            {[
              { icon: "📅", title: "Scheduled Allowance Releases",    desc: "Daily drip mechanism prevents early overspending. Smart contract enforces the 24-hour release window." },
              { icon: "🔍", title: "Shared Expense Transparency",     desc: "Every contribution is logged on-chain. All group members see the same ledger in real time." },
              { icon: "⚡", title: "Instant Peer-to-Peer Settlement", desc: "XLM transfers settle within seconds. No manual reconciliation, no awkward reminders." },
              { icon: "🤖", title: "Automated Reconciliation",        desc: "Once the last participant pays, funds route automatically to the original payer. Zero intervention required." },
            ].map((f) => (
              <div className="feature-card" key={f.title}>
                <div className="feature-icon">{f.icon}</div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════��════════════════════
          ALLOWANCE DASHBOARD
      ════════════════════════════════════════════════════════ */}
      <section id="dashboard">
        <div className="wrapper">
          <div className="section-header">
            <div className="section-header-row">
              <div>
                <div className="role-chip student">◆ Student View</div>
                <div className="section-label">Allowance Dashboard</div>
                <h2 className="section-title">
                  Your Balance &amp; Release Schedule
                </h2>
                <p className="section-sub">
                  Your weekly allowance is locked on-chain and released daily by
                  the Soroban contract. You cannot withdraw more than the daily
                  ceiling in a 24-hour period.
                </p>
              </div>
              <span className="badge badge-pending">Released Today</span>
            </div>
          </div>

          <div className="dashboard-grid">
            {/* Balance Card */}
            <div className="balance-card" style={{ position: "relative" }}>
              <div
                className={`locked-overlay${connectedKey ? " hidden" : ""}`}
              >
                <span className="lock-icon">🔒</span>
                <p>
                  Connect your wallet to view live balance and release
                  allowance.
                </p>
              </div>

              <div className="balance-live-strip">
                <span className="balance-live-label">On-Chain Balance</span>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    className="btn-release"
                    onClick={handleReleaseAllowance}
                    disabled={!connectedKey || releaseLoading}
                  >
                    {releaseLoading ? (
                      <><Spinner /> Releasing…</>
                    ) : (
                      "Release Today's Allowance"
                    )}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setShowDepositForm(true)}
                    disabled={!connectedKey}
                    style={{ fontSize: "14px", whiteSpace: "nowrap" }}
                  >
                    💰 Deposit Allowance
                  </button>
                </div>
              </div>

              <div className="balance-label">Available Balance</div>
              <div className="balance-amount">
                {balanceDisplay} <span>XLM</span>
              </div>
              <div className="balance-sub">{balanceSub}</div>

              <div className="balance-progress-wrap">
                <div className="balance-progress-label">
                  <span>Used this week</span>
                  <span>₱ 2,720 / ₱ 3,200</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: "85%" }} />
                </div>
              </div>

              <div className="divider" />

              <div className="balance-meta-row">
                <div className="balance-meta-item">
                  <span className="balance-meta-val">₱ 160</span>
                  <span className="balance-meta-key">Daily Ceiling</span>
                </div>
                <div className="balance-meta-item">
                  <span className="balance-meta-val">3 days</span>
                  <span className="balance-meta-key">Remaining</span>
                </div>
                <div className="balance-meta-item">
                  <span className="balance-meta-val">₱ 3,200</span>
                  <span className="balance-meta-key">Locked Total</span>
                </div>
              </div>
            </div>

            {/* Release Timeline */}
            <div className="timeline-card">
              <div className="timeline-title">
                Weekly Release Schedule — Helena R.
              </div>
              <div className="timeline">
                {[
                  { day: "Mon, Mar 24", status: "done",   label: "Allowance Released",    badge: "badge-paid",    badgeText: "Paid" },
                  { day: "Tue, Mar 25", status: "done",   label: "Allowance Released",    badge: "badge-paid",    badgeText: "Paid" },
                  { day: "Wed, Mar 26", status: "done",   label: "Allowance Released",    badge: "badge-paid",    badgeText: "Paid" },
                  { day: "Thu, Mar 27", status: "done",   label: "Allowance Released",    badge: "badge-paid",    badgeText: "Paid" },
                  { day: "Fri, Mar 28", status: "done",   label: "Allowance Released",    badge: "badge-paid",    badgeText: "Paid" },
                  { day: "Sat, Mar 29", status: "done",   label: "Allowance Released",    badge: "badge-paid",    badgeText: "Paid" },
                  { day: "Sun, Mar 30", status: "today",  label: "Released Today",        badge: "badge-pending", badgeText: "Released Today" },
                  { day: "Mon, Mar 31", status: "locked", label: "Locked — Next Release", badge: "badge-locked",  badgeText: "Allowance Locked" },
                  { day: "Tue, Apr 1",  status: "locked", label: "Locked — Upcoming",     badge: "badge-locked",  badgeText: "Allowance Locked" },
                ].map((item) => (
                  <div className="timeline-item" key={item.day}>
                    <span className="timeline-day">{item.day}</span>
                    <div className="timeline-dot-wrap">
                      <div className={`timeline-dot ${item.status}`} />
                    </div>
                    <div className="timeline-info">
                      <div className="timeline-info-left">
                        <span
                          className="timeline-release-label"
                          style={
                            item.status === "locked"
                              ? { color: "var(--text-muted)" }
                              : {}
                          }
                        >
                          {item.label}
                        </span>
                        <span className="timeline-release-amount">
                          + ₱ 160 XLM
                        </span>
                      </div>
                      <span className={`badge ${item.badge}`}>
                        {item.badgeText}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          SHARED EXPENSES
      ════════════════════════════════════════════════════════ */}
      <section id="expenses">
        <div className="wrapper">
          <div className="section-header">
            <div className="section-header-row">
              <div>
                <div className="role-chip group">◆ Group Member View</div>
                <div className="section-label">Shared Expenses</div>
                <h2 className="section-title">Active Expense Groups</h2>
                <p className="section-sub">
                  Each group is a Soroban split contract. Funds are held in
                  escrow and released to the payer automatically once all
                  contributions are received.
                </p>
              </div>
              <button
                className="btn-primary"
                onClick={() => setShowCreateSplit(true)}
                style={{ whiteSpace: "nowrap" }}
              >
                ➕ Create Split
              </button>
            </div>
          </div>

          <div className="expense-grid">
            {/* Card 1: Settled */}
            <div className="expense-card settled">
              <div className="expense-card-header">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div className="expense-group-icon">🍜</div>
                  <div>
                    <div className="expense-group-name">Jollibee Run</div>
                    <div className="expense-group-sub">Shared meal · 4 members</div>
                  </div>
                </div>
                <span className="badge badge-paid">Settled</span>
              </div>
              <div className="expense-total">₱ 480.00</div>
              <div className="expense-per-person">₱ 120.00 per person</div>
              <div className="participant-list">
                {[
                  ["H", "a", "Helena R. (payer)"],
                  ["M", "b", "Marco T."],
                  ["A", "c", "Anna S."],
                  ["J", "d", "Jose L."],
                ].map(([l, c, n]) => (
                  <div className="participant-row" key={n}>
                    <div className="participant-name-wrap">
                      <div className={`avatar avatar-${c}`}>{l}</div>
                      <span className="participant-name">{n}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="participant-amount">₱ 120</span>
                      <span className="badge badge-paid">Paid</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="expense-progress-wrap">
                <div className="expense-progress-meta">
                  <span>Collected</span>
                  <span>₱ 480 / ₱ 480</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: "100%", background: "var(--accent-green)" }}
                  />
                </div>
              </div>
              <div className="settled-overlay">
                ✔ Smart contract settled · Mar 29, 2025
              </div>
            </div>

            {/* Card 2: Partially Paid */}
            <ExpenseCard
              splitId={2}
              icon="💡"
              name="March Electricity"
              sub="Utility split · 3 members"
              total="₱ 600.00"
              perPerson="₱ 200.00 per person"
              badge="badge-pending"
              badgeText="Pending"
              progress={66.6}
              progressGradient="linear-gradient(90deg,var(--neon),var(--accent-amber))"
              collected="₱ 400 / ₱ 600"
              participants={[
                { l: "H", c: "a", name: "Helena R. (payer)", badge: "badge-paid",    badgeText: "Paid",    amount: "₱ 200" },
                { l: "A", c: "c", name: "Anna S.",           badge: "badge-paid",    badgeText: "Paid",    amount: "₱ 200" },
                { l: "R", c: "e", name: "Rico D.",           badge: "badge-pending", badgeText: "Pending", amount: "₱ 200" },
              ]}
              shareLabel="↗ Pay My Share · ₱ 200"
              isSettled={settledSplits.has(2)}
              isLoading={payLoadingId === 2}
              onPay={() => handlePayShare(2)}
            />

            {/* Card 3: Overdue */}
            <ExpenseCard
              splitId={3}
              icon="🛒"
              name="Grocery Run"
              sub="Shared supplies · 4 members"
              total="₱ 960.00"
              perPerson="₱ 240.00 per person"
              badge="badge-overdue"
              badgeText="Overdue"
              progress={50}
              progressGradient="linear-gradient(90deg,var(--accent-red),var(--accent-amber))"
              collected="₱ 480 / ₱ 960"
              participants={[
                { l: "M", c: "b", name: "Marco T. (payer)", badge: "badge-paid",    badgeText: "Paid",    amount: "₱ 240" },
                { l: "H", c: "a", name: "Helena R.",        badge: "badge-overdue", badgeText: "Overdue", amount: "₱ 240" },
                { l: "J", c: "d", name: "Jose L.",          badge: "badge-overdue", badgeText: "Overdue", amount: "₱ 240" },
                { l: "A", c: "c", name: "Anna S.",          badge: "badge-paid",    badgeText: "Paid",    amount: "₱ 240" },
              ]}
              shareLabel="⚠ Pay Overdue Share · ₱ 240"
              shareStyle={{
                borderColor: "rgba(255,77,106,0.3)",
                color: "var(--accent-red)",
                background: "rgba(255,77,106,0.06)",
              }}
              isSettled={settledSplits.has(3)}
              isLoading={payLoadingId === 3}
              onPay={() => handlePayShare(3)}
            />

            {/* Card 4: Pending */}
            <ExpenseCard
              splitId={4}
              icon="📡"
              name="WiFi Subscription"
              sub="Monthly internet · 5 members"
              total="₱ 1,500.00"
              perPerson="₱ 300.00 per person"
              badge="badge-pending"
              badgeText="Pending"
              progress={40}
              collected="₱ 600 / ₱ 1,500"
              participants={[
                { l: "R", c: "e", name: "Rico D. (payer)", badge: "badge-paid",    badgeText: "Paid",    amount: "₱ 300" },
                { l: "H", c: "a", name: "Helena R.",       badge: "badge-paid",    badgeText: "Paid",    amount: "₱ 300" },
                { l: "M", c: "b", name: "Marco T.",        badge: "badge-pending", badgeText: "Pending", amount: "₱ 300" },
              ]}
              shareLabel="↗ Pay My Share · ₱ 300"
              isSettled={settledSplits.has(4)}
              isLoading={payLoadingId === 4}
              onPay={() => handlePayShare(4)}
            />

            {/* Card 5: New */}
            <ExpenseCard
              splitId={5}
              icon="🎂"
              name="Dorm Celebration"
              sub="Event fund · 6 members"
              total="₱ 1,200.00"
              perPerson="₱ 200.00 per person"
              badge="badge-pending"
              badgeText="Pending"
              progress={16.6}
              progressGradient="var(--accent-amber)"
              collected="₱ 200 / ₱ 1,200"
              participants={[
                { l: "A", c: "c", name: "Anna S. (payer)", badge: "badge-paid",    badgeText: "Paid",    amount: "₱ 200" },
                { l: "H", c: "a", name: "Helena R.",       badge: "badge-pending", badgeText: "Pending", amount: "₱ 200" },
                { l: "J", c: "d", name: "Jose L.",         badge: "badge-pending", badgeText: "Pending", amount: "₱ 200" },
              ]}
              shareLabel="↗ Pay My Share · ₱ 200"
              isSettled={settledSplits.has(5)}
              isLoading={payLoadingId === 5}
              onPay={() => handlePayShare(5)}
            />

            {/* Card 6: Settled */}
            <div className="expense-card settled">
              <div className="expense-card-header">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div className="expense-group-icon">🚌</div>
                  <div>
                    <div className="expense-group-name">Commute Pool</div>
                    <div className="expense-group-sub">Transport · 3 members</div>
                  </div>
                </div>
                <span className="badge badge-paid">Settled</span>
              </div>
              <div className="expense-total">₱ 360.00</div>
              <div className="expense-per-person">₱ 120.00 per person</div>
              <div className="participant-list">
                {[
                  ["J", "d", "Jose L. (payer)"],
                  ["H", "a", "Helena R."],
                  ["R", "e", "Rico D."],
                ].map(([l, c, n]) => (
                  <div className="participant-row" key={n}>
                    <div className="participant-name-wrap">
                      <div className={`avatar avatar-${c}`}>{l}</div>
                      <span className="participant-name">{n}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="participant-amount">₱ 120</span>
                      <span className="badge badge-paid">Paid</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="expense-progress-wrap">
                <div className="expense-progress-meta">
                  <span>Collected</span>
                  <span>₱ 360 / ₱ 360</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: "100%", background: "var(--accent-green)" }}
                  />
                </div>
              </div>
              <div className="settled-overlay">
                ✔ Smart contract settled · Mar 28, 2025
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          CONTRIBUTION TRACKER
      ════════════════════════════════════════════════════════ */}
      <section id="contributions">
        <div className="wrapper">
          <div className="section-header">
            <div className="section-header-row">
              <div>
                <div className="role-chip group">◆ Group Member View</div>
                <div className="section-label">Contribution Tracker</div>
                <h2 className="section-title">Who Owes What</h2>
                <p className="section-sub">
                  Real-time contribution status across all active splits.
                  Settlement status is verified on-chain by the Soroban
                  contract.
                </p>
              </div>
            </div>
          </div>
          <div className="tracker-table-wrap">
            <table className="tracker-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Group</th>
                  <th>Amount Owed</th>
                  <th>Amount Paid</th>
                  <th>Settlement</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { l: "H", c: "a", name: "Helena R.", group: "March Electricity", owed: "₱ 200.00", paid: "₱ 200.00", full: true,  settle: "Settled",    badge: "badge-paid",    bText: "Paid",                settleColor: "var(--accent-green)" },
                  { l: "R", c: "e", name: "Rico D.",   group: "March Electricity", owed: "₱ 200.00", paid: "₱ 0.00",   full: false, settle: "Awaiting",   badge: "badge-pending", bText: "Pending",             settleColor: "var(--neon)" },
                  { l: "H", c: "a", name: "Helena R.", group: "Grocery Run",       owed: "₱ 240.00", paid: "₱ 0.00",   full: false, settle: "2 days late",badge: "badge-overdue", bText: "Overdue",             settleColor: "var(--accent-red)" },
                  { l: "J", c: "d", name: "Jose L.",   group: "Grocery Run",       owed: "₱ 240.00", paid: "₱ 0.00",   full: false, settle: "2 days late",badge: "badge-overdue", bText: "Overdue",             settleColor: "var(--accent-red)" },
                  { l: "M", c: "b", name: "Marco T.",  group: "WiFi Subscription", owed: "₱ 300.00", paid: "₱ 0.00",   full: false, settle: "Awaiting",   badge: "badge-pending", bText: "Pending",             settleColor: "var(--neon)" },
                  { l: "H", c: "a", name: "Helena R.", group: "Dorm Celebration",  owed: "₱ 200.00", paid: "₱ 0.00",   full: false, settle: "Awaiting",   badge: "badge-pending", bText: "Pending Contribution",settleColor: "var(--neon)" },
                  { l: "A", c: "c", name: "Anna S.",   group: "Jollibee Run",      owed: "₱ 120.00", paid: "₱ 120.00", full: true,  settle: "Settled",    badge: "badge-paid",    bText: "Paid",                settleColor: "var(--accent-green)" },
                  { l: "H", c: "a", name: "Helena R.", group: "Commute Pool",      owed: "₱ 120.00", paid: "₱ 120.00", full: true,  settle: "Settled",    badge: "badge-paid",    bText: "Paid",                settleColor: "var(--accent-green)" },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>
                      <div className="td-name">
                        <div className={`avatar avatar-${row.c}`}>{row.l}</div>
                        {row.name}
                      </div>
                    </td>
                    <td>{row.group}</td>
                    <td>
                      <span className="td-mono owed-val">{row.owed}</span>
                    </td>
                    <td>
                      <span
                        className={`td-mono${row.full ? " paid-val" : ""}`}
                        style={!row.full ? { color: "var(--text-muted)" } : {}}
                      >
                        {row.paid}
                      </span>
                      <div className="micro-bar">
                        <div
                          className={`micro-fill ${row.full ? "full" : "none"}`}
                        />
                      </div>
                    </td>
                    <td>
                      <span
                        className="td-mono"
                        style={{ color: row.settleColor }}
                      >
                        {row.settle}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${row.badge}`}>{row.bText}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          PARENT OVERVIEW
      ════════════════════════════════════════════════════════ */}
      <section id="parent">
        <div className="wrapper">
          <div className="section-header">
            <div className="section-header-row">
              <div>
                <div className="role-chip parent">◆ Parent / Payer View</div>
                <div className="section-label">Payer Overview</div>
                <h2 className="section-title">
                  Allowance &amp; Settlement Summary
                </h2>
                <p className="section-sub">
                  Track deposited allowances, pending settlements across
                  students, and completed payouts. All funds are reconciled by
                  the on-chain contract.
                </p>
              </div>
              <span className="badge badge-deposited">Allowance Deposited</span>
            </div>
          </div>

          {/* Deposit Action Card */}
          <div className="action-card">
            <div className="action-card-title">Deposit Allowance On-Chain</div>
            <div className="action-card-sub">
              Lock funds for a student wallet. The Soroban contract will release
              the daily ceiling automatically.
            </div>
            <div className="action-form">
              <div className="form-field">
                <label className="form-label" htmlFor="input-student">
                  Student Address
                </label>
                <input
                  className="form-input"
                  id="input-student"
                  type="text"
                  placeholder="G... (Stellar address)"
                  style={{ width: "260px" }}
                  value={inputStudent}
                  onChange={(e) => setInputStudent(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="input-amount">
                  Total Amount (XLM)
                </label>
                <input
                  className="form-input"
                  id="input-amount"
                  type="number"
                  placeholder="e.g. 27.2"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="input-daily">
                  Daily Ceiling (XLM)
                </label>
                <input
                  className="form-input"
                  id="input-daily"
                  type="number"
                  placeholder="e.g. 1.36"
                  value={inputDaily}
                  onChange={(e) => setInputDaily(e.target.value)}
                />
              </div>
              <button
                className="btn-deposit"
                onClick={handleDeposit}
                disabled={!connectedKey || depositLoading}
              >
                {depositLoading ? (
                  <><Spinner /> Signing…</>
                ) : (
                  "Lock Allowance"
                )}
              </button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="parent-grid">
            {[
              { label: "Total Deposited This Month", value: "₱ 12,800", sub: "Across 4 students · April cycle",     accent: "💰", color: "" },
              { label: "Pending Settlements",        value: "₱ 3,240",  sub: "6 active splits awaiting completion", accent: "⏳", color: "var(--accent-amber)" },
              { label: "Completed Settlements",      value: "₱ 9,560",  sub: "14 splits settled this month",        accent: "✔", color: "var(--accent-green)" },
              { label: "Locked (Unreleased)",        value: "₱ 1,920",  sub: "Held in Soroban escrow · 3 students", accent: "🔒", color: "var(--accent-purple)" },
              { label: "Released Today",             value: "₱ 640",    sub: "Daily drip · 4 student wallets",       accent: "📤", color: "var(--neon)" },
              { label: "Overdue Contributions",      value: "₱ 480",    sub: "2 participants · Grocery Run split",   accent: "⚠️", color: "var(--accent-red)" },
            ].map((s) => (
              <div className="stat-card" key={s.label}>
                <div className="stat-card-label">{s.label}</div>
                <div
                  className="stat-card-value"
                  style={s.color ? { color: s.color } : {}}
                >
                  {s.value}
                </div>
                <div className="stat-card-sub">{s.sub}</div>
                <div className="stat-card-accent">{s.accent}</div>
              </div>
            ))}
          </div>

          {/* Per-Student Summaries */}
          <div className="student-summary-grid">
            {[
              { l: "H", bg: "rgba(0,212,255,0.15)",  color: "var(--neon)",          name: "Helena R.", id: "G5KX...A8QP", badge: "badge-deposited", bText: "Allowance Deposited", remaining: 480,  pct: 85, bar: "" },
              { l: "M", bg: "rgba(157,110,255,0.15)", color: "var(--accent-purple)", name: "Marco T.",  id: "G3RV...T2NM", badge: "badge-pending",   bText: "Pending Payment",     remaining: 960,  pct: 70, bar: "linear-gradient(90deg,var(--neon),var(--accent-amber))" },
              { l: "A", bg: "rgba(0,229,160,0.15)",   color: "var(--accent-green)",  name: "Anna S.",   id: "G7QM...B9KL", badge: "badge-paid",      bText: "Split Settled",       remaining: 1280, pct: 60, bar: "linear-gradient(90deg,var(--neon),var(--accent-green))" },
              { l: "J", bg: "rgba(255,179,64,0.15)",  color: "var(--accent-amber)",  name: "Jose L.",   id: "G2WP...F4DS", badge: "badge-overdue",   bText: "Overdue",             remaining: 640,  pct: 80, bar: "linear-gradient(90deg,var(--accent-amber),var(--accent-red))" },
            ].map((s) => (
              <div className="student-summary-card" key={s.name}>
                <div className="student-summary-header">
                  <div
                    style={{
                      background: s.bg,
                      color: s.color,
                      fontFamily: "var(--font-display)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "16px",
                      borderRadius: "10px",
                      width: "42px",
                      height: "42px",
                      flexShrink: 0,
                    }}
                  >
                    {s.l}
                  </div>
                  <div>
                    <div className="student-name">{s.name}</div>
                    <div className="student-id">{s.id} · Testnet</div>
                  </div>
                  <span
                    className={`badge ${s.badge}`}
                    style={{ marginLeft: "auto" }}
                  >
                    {s.bText}
                  </span>
                </div>
                <div className="student-summary-stats">
                  <div className="ss-stat">
                    <span className="ss-val">₱ 3,200</span>
                    <span className="ss-key">Weekly Total</span>
                  </div>
                  <div className="ss-stat">
                    <span className="ss-val">
                      ₱ {s.remaining.toLocaleString()}
                    </span>
                    <span className="ss-key">Remaining</span>
                  </div>
                  <div className="ss-stat">
                    <span className="ss-val">₱ 160 / day</span>
                    <span className="ss-key">Daily Ceiling</span>
                  </div>
                </div>
                <div className="summary-progress-wrap">
                  <div className="summary-progress-label">
                    <span>Allowance used</span>
                    <span>{s.pct}%</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${s.pct}%`,
                        ...(s.bar ? { background: s.bar } : {}),
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          NOTIFICATIONS
      ════════════════════════════════════════════════════════ */}
      <section id="notifications">
        <div className="wrapper">
          <div className="section-header">
            <div className="section-header-row">
              <div>
                <div className="section-label">Notifications &amp; Alerts</div>
                <h2 className="section-title">Recent Activity</h2>
                <p className="section-sub">
                  On-chain events emitted by the Soroban contract. All statuses
                  are read-only and verified against the ledger.
                </p>
              </div>
            </div>
          </div>

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "var(--text-muted)",
              }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>📭</div>
                <p style={{ fontSize: "14px" }}>No activity yet</p>
                <p style={{ fontSize: "12px", marginTop: "8px" }}>
                  Your on-chain transactions will appear here
                </p>
              </div>
            ) : (
              notifications.map((n, i) => (
                <div className="notif-card" key={i}>
                  <div className={`notif-icon ${n.color}`}>{n.icon}</div>
                  <div className={`notif-dot ${n.color}`} />
                  <div className="notif-body">
                    <div className="notif-title">{n.title}</div>
                    <div className="notif-desc">{n.desc}</div>
                  </div>
                  <span className="notif-time">{n.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════════ */}
      <footer>
        <div className="wrapper">
          <div className="footer-inner">
            <div className="footer-left">
              <div className="footer-logo-mark">CF</div>
              <span className="footer-name">CampusFlow Wallet</span>
            </div>
            <div className="footer-right">
              <a href="#home">Overview</a>
              <a href="#dashboard">Dashboard</a>
              <a href="#expenses">Expenses</a>
              <a href="#contributions">Contributions</a>
              <div className="footer-stellar">◆ Stellar Testnet · Soroban</div>
            </div>
          </div>
        </div>
      </footer>

      {/* ════════════════════════════════════════════════════════
          DEPOSIT ALLOWANCE MODAL
      ════════════════════════════════════════════════════════ */}
      {showDepositForm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowDepositForm(false)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "12px",
              padding: "32px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ marginBottom: "8px", fontSize: "20px", fontWeight: "600" }}>
                Deposit Allowance
              </h2>
              <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                Lock XLM for a student with daily release limits
              </p>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)" }}>
                Student Address (Recipient)
              </label>
              <input
                type="text"
                value={inputStudent}
                onChange={(e) => setInputStudent(e.target.value)}
                placeholder="G..."
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  fontFamily: "monospace",
                  fontSize: "12px",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)" }}>
                Total Amount (XLM)
              </label>
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder="0.5"
                step="0.1"
                min="0"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  fontSize: "14px",
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)" }}>
                Daily Release Ceiling (XLM)
              </label>
              <input
                type="number"
                value={inputDaily}
                onChange={(e) => setInputDaily(e.target.value)}
                placeholder="0.1"
                step="0.01"
                min="0"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  fontSize: "14px",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowDepositForm(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  background: "transparent",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeposit();
                  setShowDepositForm(false);
                }}
                disabled={depositLoading}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--accent-primary)",
                  color: "white",
                  cursor: depositLoading ? "default" : "pointer",
                  fontWeight: "600",
                  fontSize: "14px",
                  opacity: depositLoading ? 0.7 : 1,
                }}
              >
                {depositLoading ? <><Spinner /> Depositing…</> : "Lock Allowance"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          CREATE SPLIT MODAL
      ════════════════════════════════════════════════════════ */}
      {showCreateSplit && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreateSplit(false)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "12px",
              padding: "32px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ marginBottom: "8px", fontSize: "20px", fontWeight: "600" }}>
                Create New Split
              </h2>
              <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                Invite roommates to split shared expenses on-chain
              </p>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)" }}>
                Participant Addresses (comma-separated)
              </label>
              <textarea
                value={splitParticipants}
                onChange={(e) => setSplitParticipants(e.target.value)}
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

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)" }}>
                Share Amount per Person (XLM)
              </label>
              <input
                type="number"
                value={splitAmount}
                onChange={(e) => setSplitAmount(e.target.value)}
                placeholder="0.5"
                step="0.001"
                min="0"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  fontSize: "14px",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowCreateSplit(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  background: "transparent",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSplit}
                disabled={createSplitLoading}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--accent-primary)",
                  color: "white",
                  cursor: createSplitLoading ? "default" : "pointer",
                  fontWeight: "600",
                  fontSize: "14px",
                  opacity: createSplitLoading ? 0.7 : 1,
                }}
              >
                {createSplitLoading ? <><Spinner /> Creating…</> : "Create Split"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
