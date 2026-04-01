/**
 * Enhanced contract integration helper utilities
 * Extends the basic contract.js with higher-level operations
 */

import { payShare as basePayShare, getSplit } from "./contract";

/**
 * Pay a share for a split with enhanced feedback
 * Automatically checks if split is settled after payment
 */
export async function payShareWithFeedback(callerKey, splitId, callbacks = {}) {
  const { onSuccess, onError, onSettle } = callbacks;

  try {
    await basePayShare(callerKey, splitId);
    onSuccess?.();

    // Verify split status after payment
    try {
      const splitData = await getSplit(callerKey, splitId);
      if (splitData && splitData.settled) {
        onSettle?.(splitData);
      }
    } catch {
      // Silent fail if split fetch doesn't work
    }
  } catch (err) {
    onError?.(err);
    throw err;
  }
}

/**
 * Helper to convert stroops to XLM and PHP
 */
export function convertBalance(stroops) {
  const xlm = Number(stroops) / 1e7;
  const php = Math.round(xlm * 117.9);
  return {
    xlm: xlm.toFixed(4),
    php: php.toLocaleString(),
    rawXlm: xlm,
    rawPhp: php,
  };
}

/**
 * Format participant data for display
 */
export function formatParticipantData(splitRecord) {
  if (!splitRecord || !splitRecord.participants) return [];

  return splitRecord.participants.map((addr, idx) => ({
    address: addr,
    isPayer: addr === splitRecord.payer,
    hasPaid: splitRecord.paid?.[addr] || false,
    shareAmount: splitRecord.share_amount,
    shortAddr: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
  }));
}
