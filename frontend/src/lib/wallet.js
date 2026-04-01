/**
 * wallet.js — Freighter wallet integration for CampusFlow
 *
 * Freighter API v2 changed return shapes across versions.
 * This module handles every variant defensively.
 *
 * Quirks handled:
 *  - isConnected() → { isConnected: bool } OR plain boolean OR throws
 *  - isAllowed()   → { isAllowed: bool }   OR plain boolean OR throws  
 *  - requestAccess() → { address } OR { publicKey } OR throws
 *  - Extension may lose the page-load race → retry with 300ms delay
 */

import {
  isConnected,
  isAllowed,
  requestAccess,
  getAddress,
  signTransaction,
} from "@stellar/freighter-api";
import { getNetworkConfig } from "./networkConfig";

// Normalise any return shape to a plain boolean
function unwrapBool(result, key) {
  if (result === null || result === undefined) return false;
  if (typeof result === "boolean") return result;
  if (typeof result === "object" && key in result) return Boolean(result[key]);
  if (typeof result === "object" && "result" in result) return Boolean(result.result);
  return false;
}

/**
 * Prompts the user to connect their Freighter wallet.
 * Returns { publicKey: string } on success.
 * Throws a descriptive Error — err.freighterMissing = true when not installed.
 */
export async function connectWallet() {
  // Check #1 — initial call
  let connected = false;
  try {
    const r = await isConnected();
    connected = unwrapBool(r, "isConnected");
  } catch { connected = false; }

  // Check #2 — retry after 300ms to handle page-load race condition
  if (!connected) {
    await new Promise((r) => setTimeout(r, 300));
    try {
      const r = await isConnected();
      connected = unwrapBool(r, "isConnected");
    } catch { connected = false; }
  }

  if (!connected) {
    const err = new Error("FREIGHTER_NOT_FOUND");
    err.freighterMissing = true;
    throw err;
  }

  // Open Freighter popup
  let accessObj;
  try { accessObj = await requestAccess(); }
  catch (e) { throw new Error(e.message || "Freighter access request failed."); }

  if (accessObj?.error) {
    throw new Error(
      typeof accessObj.error === "string"
        ? accessObj.error
        : accessObj.error?.message || "User denied access."
    );
  }

  const address =
    accessObj?.address ||
    accessObj?.publicKey ||
    (typeof accessObj === "string" ? accessObj : null);

  if (!address) throw new Error("Freighter did not return a wallet address.");
  return { publicKey: address };
}

/**
 * Returns the connected public key if Freighter is already allowed, or null.
 */
export async function getWalletPublicKey() {
  try {
    const c = await isConnected();
    if (!unwrapBool(c, "isConnected")) return null;
    const a = await isAllowed();
    if (!unwrapBool(a, "isAllowed")) return null;
    const obj = await getAddress();
    const addr = obj?.address || obj?.publicKey || (typeof obj === "string" ? obj : null);
    if (obj?.error || !addr) return null;
    return addr;
  } catch { return null; }
}

/**
 * Signs an XDR transaction via Freighter and returns the signed XDR string.
 * Uses the current network configuration from networkConfig.js
 */
export async function signTx(xdr, publicKey) {
  const networkConfig = getNetworkConfig();
  let result;
  try {
    result = await signTransaction(xdr, {
      network: networkConfig.freighterNetwork,
      address: publicKey,
    });
  } catch (e) {
    throw new Error(e.message || "Transaction signing failed.");
  }

  if (result?.error) {
    throw new Error(
      typeof result.error === "string" ? result.error : result.error?.message || "Signing failed."
    );
  }

  const signed =
    result?.signedTxXdr ||
    result?.xdr ||
    (typeof result === "string" ? result : null);

  if (!signed) throw new Error("Freighter did not return a signed transaction.");
  return signed;
}
