/**
 * FreighterInstall.jsx
 *
 * Full-screen overlay shown when Freighter extension is not detected.
 * Design: deep-space dark, geometric grid, animated neon accents.
 * Shows step-by-step install guide + direct Chrome Web Store link.
 */

import { useState } from "react";

const steps = [
  {
    num: "01",
    icon: "🧩",
    title: "Install Freighter",
    desc: "Add the Freighter extension to Chrome or Brave from the Chrome Web Store.",
    action: {
      label: "Open Chrome Web Store →",
      href: "https://chrome.google.com/webstore/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk",
    },
  },
  {
    num: "02",
    icon: "🔑",
    title: "Create or Import Wallet",
    desc: "Open Freighter, create a new wallet, and save your 12-word recovery phrase somewhere safe.",
    action: null,
  },
  {
    num: "03",
    icon: "🌐",
    title: "Switch to Testnet",
    desc: 'In Freighter settings, change the network to "Testnet" to interact with CampusFlow.',
    action: null,
  },
  {
    num: "04",
    icon: "💧",
    title: "Fund Your Account",
    desc: "Get free Testnet XLM from the Stellar Friendbot to cover transaction fees.",
    action: {
      label: "Open Stellar Friendbot →",
      href: "https://laboratory.stellar.org/#account-creator?network=test",
    },
  },
  {
    num: "05",
    icon: "✅",
    title: "Refresh & Connect",
    desc: "Come back here, refresh the page, and click Connect Wallet.",
    action: {
      label: "Refresh page",
      onClick: () => window.location.reload(),
    },
  },
];

export default function FreighterInstall({ onRetry, onDismiss }) {
  const [hoveredStep, setHoveredStep] = useState(null);

  return (
    <div className="fi-root">
      {/* Animated background grid */}
      <div className="fi-grid" aria-hidden="true" />
      <div className="fi-orb fi-orb-1" aria-hidden="true" />
      <div className="fi-orb fi-orb-2" aria-hidden="true" />

      <div className="fi-content">
        {/* Header */}
        <div className="fi-header">
          <div className="fi-logo-row">
            <div className="fi-cf-mark">CF</div>
            <span className="fi-cf-name">CampusFlow Wallet</span>
          </div>

          <div className="fi-badge">
            <span className="fi-badge-dot" />
            Freighter Required
          </div>

          <h1 className="fi-title">
            One extension away from<br />
            <span className="fi-title-accent">on-chain finance.</span>
          </h1>

          <p className="fi-subtitle">
            CampusFlow uses <strong>Freighter</strong> — a free Stellar wallet
            extension — to sign transactions directly in your browser.
            No seed phrases sent to any server. Ever.
          </p>

          <a
            className="fi-cta-primary"
            href="https://chrome.google.com/webstore/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk"
            target="_blank"
            rel="noreferrer"
          >
            <span className="fi-cta-icon">🧩</span>
            Install Freighter Extension
            <span className="fi-cta-arrow">↗</span>
          </a>

          <button className="fi-cta-secondary" onClick={onRetry}>
            <span className="fi-spin-icon">↺</span>
            I already installed it — retry
          </button>

          {onDismiss && (
            <button className="fi-cta-tertiary" onClick={onDismiss}>
              ← Continue without wallet
            </button>
          )}
        </div>

        {/* Step-by-step guide */}
        <div className="fi-steps-wrap">
          <div className="fi-steps-label">Setup guide</div>
          <div className="fi-steps">
            {steps.map((step, i) => (
              <div
                key={step.num}
                className={`fi-step${hoveredStep === i ? " fi-step-hovered" : ""}`}
                onMouseEnter={() => setHoveredStep(i)}
                onMouseLeave={() => setHoveredStep(null)}
              >
                <div className="fi-step-num">{step.num}</div>
                <div className="fi-step-icon">{step.icon}</div>
                <div className="fi-step-body">
                  <div className="fi-step-title">{step.title}</div>
                  <div className="fi-step-desc">{step.desc}</div>
                  {step.action && (
                    step.action.href ? (
                      <a
                        className="fi-step-link"
                        href={step.action.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {step.action.label}
                      </a>
                    ) : (
                      <button
                        className="fi-step-link"
                        onClick={step.action.onClick}
                      >
                        {step.action.label}
                      </button>
                    )
                  )}
                </div>
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="fi-step-line" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Trust strip */}
        <div className="fi-trust">
          <div className="fi-trust-item">
            <span className="fi-trust-icon">🔒</span>
            <span>Non-custodial</span>
          </div>
          <div className="fi-trust-divider" />
          <div className="fi-trust-item">
            <span className="fi-trust-icon">⚡</span>
            <span>Stellar Testnet</span>
          </div>
          <div className="fi-trust-divider" />
          <div className="fi-trust-item">
            <span className="fi-trust-icon">🌏</span>
            <span>Built for SEA students</span>
          </div>
          <div className="fi-trust-divider" />
          <div className="fi-trust-item">
            <span className="fi-trust-icon">⭐</span>
            <span>
              <a
                href="https://freighter.app"
                target="_blank"
                rel="noreferrer"
                style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: "3px" }}
              >
                freighter.app
              </a>
            </span>
          </div>
        </div>
      </div>

      <style>{`
        /* ── Root ── */
        .fi-root {
          position: fixed; inset: 0;
          background: #050c18;
          display: flex; align-items: center; justify-content: center;
          overflow-y: auto;
          z-index: 9999;
          padding: 40px 24px;
          font-family: 'DM Sans', sans-serif;
        }

        /* ── Animated grid ── */
        .fi-grid {
          position: fixed; inset: 0;
          background-image:
            linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
          animation: fi-grid-drift 20s linear infinite;
        }
        @keyframes fi-grid-drift {
          from { background-position: 0 0; }
          to   { background-position: 48px 48px; }
        }

        /* ── Glowing orbs ── */
        .fi-orb {
          position: fixed; border-radius: 50%;
          pointer-events: none; filter: blur(80px);
          animation: fi-breathe 8s ease-in-out infinite;
        }
        .fi-orb-1 {
          width: 560px; height: 560px;
          top: -160px; left: -120px;
          background: radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%);
        }
        .fi-orb-2 {
          width: 400px; height: 400px;
          bottom: -100px; right: -60px;
          background: radial-gradient(circle, rgba(157,110,255,0.1) 0%, transparent 70%);
          animation-delay: -4s;
        }
        @keyframes fi-breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.1); opacity: 0.7; }
        }

        /* ── Content wrapper ── */
        .fi-content {
          position: relative; z-index: 1;
          width: 100%; max-width: 680px;
          display: flex; flex-direction: column; gap: 48px;
        }

        /* ── Header ── */
        .fi-header {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; gap: 20px;
        }

        .fi-logo-row {
          display: flex; align-items: center; gap: 10px;
        }
        .fi-cf-mark {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #00d4ff, #9d6eff);
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif;
          font-size: 14px; font-weight: 800; color: #050c18;
        }
        .fi-cf-name {
          font-family: 'Syne', sans-serif;
          font-size: 1.05rem; font-weight: 700;
          color: #e8f0fe;
        }

        .fi-badge {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(255,77,106,0.1);
          border: 1px solid rgba(255,77,106,0.25);
          border-radius: 20px; padding: 5px 16px;
          font-family: 'DM Mono', monospace;
          font-size: 0.72rem; color: #ff4d6a;
          letter-spacing: 0.08em;
        }
        .fi-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #ff4d6a;
          box-shadow: 0 0 6px #ff4d6a;
          animation: fi-pulse 2s ease-in-out infinite;
        }
        @keyframes fi-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }

        .fi-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(2rem, 5vw, 3.2rem);
          font-weight: 800; line-height: 1.1;
          color: #e8f0fe; letter-spacing: -0.02em;
          margin: 0;
        }
        .fi-title-accent {
          background: linear-gradient(90deg, #00d4ff, #9d6eff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .fi-subtitle {
          font-size: 0.95rem; color: #8da4c4;
          max-width: 480px; line-height: 1.7; margin: 0;
        }
        .fi-subtitle strong { color: #00d4ff; font-weight: 500; }

        /* ── CTAs ── */
        .fi-cta-primary {
          display: inline-flex; align-items: center; gap: 10px;
          background: linear-gradient(135deg, #00d4ff, #00aacb);
          color: #050c18;
          font-family: 'Syne', sans-serif;
          font-size: 0.95rem; font-weight: 700;
          padding: 14px 32px; border-radius: 14px;
          text-decoration: none; border: none; cursor: pointer;
          letter-spacing: 0.03em;
          box-shadow: 0 0 32px rgba(0,212,255,0.35), 0 4px 16px rgba(0,0,0,0.3);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .fi-cta-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 48px rgba(0,212,255,0.5), 0 8px 24px rgba(0,0,0,0.4);
        }
        .fi-cta-icon { font-size: 1.1rem; }
        .fi-cta-arrow { font-size: 0.9rem; opacity: 0.7; }

        .fi-cta-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          background: transparent;
          border: 1px solid rgba(0,212,255,0.2);
          color: #8da4c4;
          font-family: 'DM Mono', monospace;
          font-size: 0.8rem;
          padding: 10px 24px; border-radius: 10px;
          cursor: pointer; letter-spacing: 0.04em;
          transition: border-color 0.2s, color 0.2s;
        }
        .fi-cta-secondary:hover {
          border-color: rgba(0,212,255,0.4); color: #00d4ff;
        }
        .fi-spin-icon { display: inline-block; }
        .fi-cta-secondary:hover .fi-spin-icon {
          animation: fi-spin 0.5s linear;
        }
        @keyframes fi-spin {
          to { transform: rotate(360deg); }
        }

        .fi-cta-tertiary {
          display: inline-flex; align-items: center; gap: 6px;
          background: transparent;
          border: 1px solid rgba(157,110,255,0.25);
          color: #9d6eff;
          font-family: 'DM Mono', monospace;
          font-size: 0.75rem;
          padding: 9px 20px; border-radius: 8px;
          cursor: pointer; letter-spacing: 0.04em;
          transition: border-color 0.2s, color 0.2s, background 0.2s;
        }
        .fi-cta-tertiary:hover {
          border-color: rgba(157,110,255,0.5);
          color: #bb99ff;
          background: rgba(157,110,255,0.05);
        }

        /* ── Steps ── */
        .fi-steps-wrap {
          background: rgba(12,21,38,0.9);
          border: 1px solid rgba(0,212,255,0.1);
          border-radius: 20px;
          padding: 32px;
          backdrop-filter: blur(12px);
        }
        .fi-steps-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
          color: #4a6080; margin-bottom: 28px;
        }
        .fi-steps {
          display: flex; flex-direction: column; gap: 0;
        }
        .fi-step {
          display: grid;
          grid-template-columns: 36px 40px 1fr;
          gap: 0 14px;
          align-items: start;
          padding: 16px 12px;
          border-radius: 12px;
          position: relative;
          transition: background 0.2s;
          cursor: default;
        }
        .fi-step-hovered {
          background: rgba(0,212,255,0.04);
        }
        .fi-step-num {
          font-family: 'DM Mono', monospace;
          font-size: 0.68rem; color: #4a6080;
          padding-top: 3px; letter-spacing: 0.1em;
        }
        .fi-step-hovered .fi-step-num { color: #00d4ff; }
        .fi-step-icon {
          width: 36px; height: 36px;
          background: rgba(0,212,255,0.07);
          border: 1px solid rgba(0,212,255,0.12);
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
          transition: border-color 0.2s, background 0.2s;
        }
        .fi-step-hovered .fi-step-icon {
          background: rgba(0,212,255,0.12);
          border-color: rgba(0,212,255,0.3);
        }
        .fi-step-body { padding-top: 2px; }
        .fi-step-title {
          font-family: 'Syne', sans-serif;
          font-size: 0.92rem; font-weight: 700;
          color: #e8f0fe; margin-bottom: 4px;
        }
        .fi-step-desc {
          font-size: 0.8rem; color: #8da4c4; line-height: 1.6;
        }
        .fi-step-link {
          display: inline-flex; align-items: center; gap: 4px;
          color: #00d4ff;
          font-family: 'DM Mono', monospace;
          font-size: 0.75rem;
          text-decoration: none; background: none; border: none;
          cursor: pointer; padding: 0; margin-top: 8px;
          letter-spacing: 0.04em;
          transition: opacity 0.15s;
        }
        .fi-step-link:hover { opacity: 0.75; text-decoration: underline; text-underline-offset: 3px; }

        /* Vertical connector line */
        .fi-step-line {
          position: absolute;
          left: calc(36px + 14px + 18px);  /* num + gap + half of icon */
          top: calc(16px + 36px + 4px);    /* padding + icon height + margin */
          width: 1px; height: 20px;
          background: linear-gradient(to bottom, rgba(0,212,255,0.2), transparent);
        }

        /* ── Trust strip ── */
        .fi-trust {
          display: flex; align-items: center; justify-content: center;
          flex-wrap: wrap; gap: 12px;
        }
        .fi-trust-item {
          display: flex; align-items: center; gap: 7px;
          font-family: 'DM Mono', monospace;
          font-size: 0.72rem; color: #4a6080;
        }
        .fi-trust-icon { font-size: 14px; }
        .fi-trust-divider {
          width: 1px; height: 14px;
          background: rgba(255,255,255,0.08);
        }

        /* ── Responsive ── */
        @media (max-width: 520px) {
          .fi-steps-wrap { padding: 20px 16px; }
          .fi-step { grid-template-columns: 28px 34px 1fr; gap: 0 10px; }
          .fi-trust-divider { display: none; }
        }
      `}</style>
    </div>
  );
}
