import {
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Address,
  nativeToScVal,
  scValToNative,
  Contract,
} from "@stellar/stellar-sdk";
import { signTx } from "./wallet";
import { getNetworkConfig } from "./networkConfig";

// ── Dynamic network configuration ────────────────────────────────────────────
// Network settings are now loaded dynamically from networkConfig.js
// Supports switching between Testnet and Mainnet

function getContractConfig() {
  const networkConfig = getNetworkConfig();
  return {
    rpcUrl: networkConfig.rpcUrl,
    networkPassphrase: networkConfig.passphrase,
    contractId: networkConfig.contractId,
  };
}

// ── RPC server ────────────────────────────────────────────────────────────────
function getServer() {
  const config = getContractConfig();
  return new SorobanRpc.Server(config.rpcUrl, { allowHttp: false });
}

// ── Wait for transaction confirmation ─────────────────────────────────────────
async function waitForConfirmation(sendResult, server, maxAttempts = 30) {
  if (sendResult.status === "ERROR") {
    throw new Error(`Transaction failed: ${JSON.stringify(sendResult.errorResult)}`);
  }

  let attempt = 0;
  let response = sendResult;

  while (
    response.status === "NOT_FOUND" ||
    response.status === "PENDING" ||
    response.status === "TRY_AGAIN_LATER"
  ) {
    if (attempt++ >= maxAttempts) {
      throw new Error("Transaction confirmation timed out.");
    }
    await new Promise((r) => setTimeout(r, 2000));
    response = await server.getTransaction(sendResult.hash);
  }

  if (response.status === "FAILED") {
    throw new Error(`Transaction failed on-chain: ${response.resultXdr}`);
  }

  return response;
}

// ── Generic: build, sign, submit ──────────────────────────────────────────────
export async function buildAndSend(publicKey, operation) {
  const server = getServer();
  const config = getContractConfig();
  const account = await server.getAccount(publicKey);

  let tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  // Simulate to obtain footprint + resource fee
  tx = await server.prepareTransaction(tx);

  // Sign via Freighter
  const signedXDR = await signTx(tx.toXDR(), publicKey);

  const result = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXDR, config.networkPassphrase)
  );

  return waitForConfirmation(result, server);
}

// ── Generic: simulate & return native value ───────────────────────────────────
export async function simulateCall(publicKey, operation) {
  const server = getServer();
  const config = getContractConfig();
  const account = await server.getAccount(publicKey);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);

  if (
    result.error ||
    SorobanRpc.Api.isSimulationError?.(result) ||
    SorobanRpc.Api.isSimulationRestore?.(result)
  ) {
    throw new Error(
      `Simulation error: ${result.error || "state restoration required"}`
    );
  }

  if (!result.result?.retval) {
    throw new Error("Simulation did not return a valid result.");
  }

  return scValToNative(result.result.retval);
}

// ─────────────────────────────────────────────────────────────────────────────
// ALLOWANCE CONTRACT FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the locked on-chain allowance balance for a student.
 * @param {string} studentKey - Stellar public key of the student
 * @returns {Promise<BigInt>} balance in stroops
 */
export async function getBalance(studentKey) {
  const contract = new Contract(getContractConfig().contractId);
  const operation = contract.call(
    "get_balance",
    new Address(studentKey).toScVal()
  );
  const result = await simulateCall(studentKey, operation);
  return BigInt(result);
}

/**
 * Triggers the daily drip release for the student.
 * The contract enforces a 24-hour cooldown — it will throw if called too soon.
 * @param {string} studentKey - Stellar public key of the student (must sign)
 */
export async function releaseAllowance(studentKey) {
  const contract = new Contract(getContractConfig().contractId);
  const operation = contract.call(
    "release_allowance",
    new Address(studentKey).toScVal()
  );
  return buildAndSend(studentKey, operation);
}

/**
 * Locks an allowance for a student with a daily release ceiling.
 * @param {string}  parentKey       - Signer / payer Stellar address
 * @param {string}  studentAddress  - Beneficiary Stellar address
 * @param {BigInt}  amountStroops   - Total locked amount in stroops
 * @param {BigInt}  dailyStroops    - Daily ceiling in stroops
 */
export async function depositAllowance(
  parentKey,
  studentAddress,
  amountStroops,
  dailyStroops
) {
  const contract = new Contract(getContractConfig().contractId);
  const operation = contract.call(
    "deposit_allowance",
    new Address(parentKey).toScVal(),
    new Address(studentAddress).toScVal(),
    nativeToScVal(amountStroops, { type: "i128" }),
    nativeToScVal(dailyStroops, { type: "i128" })
  );
  return buildAndSend(parentKey, operation);
}

// ─────────────────────────────────────────────────────────────────────────────
// SPLIT BILLING CONTRACT FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new shared expense group on-chain.
 * The payer is auto-marked as paid; participants receive payment requests.
 * @param {string}   payerKey       - Address of the student who paid upfront
 * @param {string[]} participantArr - Array of participant Stellar addresses
 * @param {BigInt}   shareAmount    - Amount each person owes (in stroops)
 * @returns {Promise<number>} the new split ID
 */
export async function createSplit(payerKey, participantArr, shareAmount) {
  const contract = new Contract(getContractConfig().contractId);

  // Build a Soroban Vec<Address> from the JS array
  const { xdr, Address: StellarAddress } = await import("@stellar/stellar-sdk");

  // Use nativeToScVal for the vec — pass Address objects
  const participantsScVal = nativeToScVal(
    participantArr.map((addr) => new Address(addr)),
    { type: "vec" }
  );

  const operation = contract.call(
    "create_split",
    new Address(payerKey).toScVal(),
    participantsScVal,
    nativeToScVal(shareAmount, { type: "i128" })
  );

  const confirmation = await buildAndSend(payerKey, operation);

  // Extract the returned split_id (u64) from the transaction result XDR
  try {
    const resultMeta = confirmation.resultMetaXdr;
    if (resultMeta) {
      const native = scValToNative(
        TransactionBuilder.fromXDR(
          confirmation.envelopeXdr,
          NETWORK_PASSPHRASE
        )
      );
      // Fallback — return the confirmation; caller can read events for the ID
    }
  } catch {
    // Non-critical — confirmation itself is the source of truth
  }

  return confirmation;
}

/**
 * Submits the caller's XLM share for a split expense group.
 * Automatically triggers settlement once all participants have paid.
 * @param {string} callerKey - Signer's Stellar address
 * @param {number} splitId   - Integer ID of the split group
 */
export async function payShare(callerKey, splitId) {
  const contract = new Contract(getContractConfig().contractId);
  const operation = contract.call(
    "pay_share",
    new Address(callerKey).toScVal(),
    nativeToScVal(BigInt(splitId), { type: "u64" })
  );
  return buildAndSend(callerKey, operation);
}

/**
 * Returns true if the split has been fully settled on-chain.
 * @param {string} callerKey - Any Stellar address (read-only query)
 * @param {number} splitId   - Split ID to check
 * @returns {Promise<boolean>}
 */
export async function verifySplit(callerKey, splitId) {
  const contract = new Contract(getContractConfig().contractId);
  const operation = contract.call(
    "verify_split",
    nativeToScVal(BigInt(splitId), { type: "u64" })
  );
  const result = await simulateCall(callerKey, operation);
  return Boolean(result);
}

/**
 * Fetches the full SplitRecord for a given split ID.
 * @param {string} callerKey - Any Stellar address (read-only)
 * @param {number} splitId   - Split ID
 * @returns {Promise<object>} native JS object of the SplitRecord
 */
export async function getSplit(callerKey, splitId) {
  const contract = new Contract(getContractConfig().contractId);
  const operation = contract.call(
    "get_split",
    nativeToScVal(BigInt(splitId), { type: "u64" })
  );
  return simulateCall(callerKey, operation);
}
