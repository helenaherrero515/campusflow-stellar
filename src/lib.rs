#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, Map, Symbol, Vec,
};

// ─────────────────────────────────────────────
// Storage key definitions
// ─────────────────────────────────────────────

/// Keys used to namespace contract storage entries.
/// Each variant maps to a distinct record in persistent storage.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Locked allowance balance for a given student address.
    AllowanceBalance(Address),
    /// Timestamp of the last allowance release for a student.
    LastRelease(Address),
    /// Daily release amount configured for a student.
    DailyRelease(Address),
    /// Full split record keyed by a unique split ID.
    Split(u64),
    /// Auto-incrementing counter used to assign unique split IDs.
    SplitCounter,
}

// ─────────────────────────────────────────────
// Data structures
// ─────────────────────────────────────────────

/// Represents a shared expense group.
/// Tracks participants, their expected shares, and whether they have paid.
#[contracttype]
#[derive(Clone)]
pub struct SplitRecord {
    /// The student who paid upfront and will receive the settled funds.
    pub payer: Address,
    /// All participants (including the payer) who owe a share.
    pub participants: Vec<Address>,
    /// Amount (in stroops) each participant owes.
    pub share_amount: i128,
    /// Tracks which participants have already sent their share.
    /// Key = participant address string, Value = true if paid.
    pub paid: Map<Address, bool>,
    /// Total XLM collected so far (in stroops).
    pub collected: i128,
    /// Total XLM expected when all participants have paid.
    pub total_expected: i128,
    /// True once the contract has settled (transferred) funds to the payer.
    pub settled: bool,
}

// ─────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────

#[contract]
pub struct CampusFlowWallet;

#[contractimpl]
impl CampusFlowWallet {

    // ─────────────────────────────────────────
    // ALLOWANCE MANAGEMENT
    // ─────────────────────────────────────────

    /// `deposit_allowance` — A parent (or any depositor) locks an allowance for a student.
    ///
    /// The full `amount` is stored in persistent storage under the student's address.
    /// A `daily_release` ceiling is also recorded so `release_allowance` knows
    /// how much to drip each day.  The caller must have already transferred XLM
    /// to the contract address before invoking this function (native token custody
    /// is handled off-chain via the Stellar Horizon API; this function only
    /// records the bookkeeping state).
    ///
    /// # Arguments
    /// * `depositor`     – Address of the parent / sponsor; must authorize.
    /// * `student`       – Address that will receive daily drips.
    /// * `amount`        – Total stroops locked for the student.
    /// * `daily_release` – Maximum stroops releasable per day.
    pub fn deposit_allowance(
        env: Env,
        depositor: Address,
        student: Address,
        amount: i128,
        daily_release: i128,
    ) {
        // Require the depositor to sign this transaction.
        depositor.require_auth();

        // Validate inputs — amounts must be positive.
        assert!(amount > 0, "amount must be positive");
        assert!(daily_release > 0, "daily_release must be positive");
        assert!(daily_release <= amount, "daily_release cannot exceed total amount");

        // Add the new deposit on top of any existing locked balance
        // so a parent can top-up mid-week without resetting the balance.
        let existing: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::AllowanceBalance(student.clone()))
            .unwrap_or(0);

        env.storage()
            .persistent()
            .set(&DataKey::AllowanceBalance(student.clone()), &(existing + amount));

        // Record the daily drip ceiling.
        env.storage()
            .persistent()
            .set(&DataKey::DailyRelease(student.clone()), &daily_release);

        // Seed last-release timestamp to now so the first release is
        // available exactly one day after deposit.
        env.storage()
            .persistent()
            .set(&DataKey::LastRelease(student.clone()), &env.ledger().timestamp());

        // Emit an event so front-ends can react immediately.
        env.events().publish(
            (Symbol::new(&env, "allowance"), symbol_short!("deposit")),
            (student, amount),
        );
    }

    /// `release_allowance` — Releases today's scheduled portion to the student.
    ///
    /// Enforces a 24-hour cooldown between releases so students cannot drain
    /// the full balance in one call.  The amount released is the lesser of
    /// `daily_release` and whatever balance remains.
    ///
    /// In a production deployment the contract would call the Stellar token
    /// interface to transfer XLM; here we update bookkeeping state and emit
    /// an event that an off-chain relayer uses to trigger the actual transfer.
    ///
    /// # Arguments
    /// * `student` – The student requesting their daily drip; must authorize.
    pub fn release_allowance(env: Env, student: Address) -> i128 {
        student.require_auth();

        let balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::AllowanceBalance(student.clone()))
            .unwrap_or(0);

        assert!(balance > 0, "no allowance balance");

        // Enforce the 24-hour (86 400 second) cooldown.
        let last_release: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::LastRelease(student.clone()))
            .unwrap_or(0);

        let now = env.ledger().timestamp();
        assert!(
            now >= last_release + 86_400,
            "allowance already released today"
        );

        let daily: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::DailyRelease(student.clone()))
            .unwrap_or(0);

        // Release the smaller of the daily ceiling and the remaining balance.
        let release_amount = daily.min(balance);

        // Deduct from the locked balance.
        env.storage()
            .persistent()
            .set(&DataKey::AllowanceBalance(student.clone()), &(balance - release_amount));

        // Update the cooldown timestamp.
        env.storage()
            .persistent()
            .set(&DataKey::LastRelease(student.clone()), &now);

        env.events().publish(
            (Symbol::new(&env, "allowance"), symbol_short!("release")),
            (student, release_amount),
        );

        release_amount
    }

    // ─────────────────────────────────────────
    // SPLIT BILLING
    // ─────────────────────────────────────────

    /// `create_split` — Creates a shared expense group and returns its unique ID.
    ///
    /// The payer (the student who paid upfront) supplies a list of all
    /// participants who must reimburse them.  `share_amount` is what each
    /// person owes — the payer's own share is included in that figure, so
    /// the payer is also inserted into the participants list and marked as
    /// already paid (since they covered the bill first).
    ///
    /// # Arguments
    /// * `payer`        – Student who paid the bill and will be reimbursed.
    /// * `participants` – Everyone who owes a share (payer is added automatically).
    /// * `share_amount` – Stroops each participant must contribute.
    pub fn create_split(
        env: Env,
        payer: Address,
        participants: Vec<Address>,
        share_amount: i128,
    ) -> u64 {
        payer.require_auth();

        assert!(!participants.is_empty(), "participants list cannot be empty");
        assert!(share_amount > 0, "share_amount must be positive");

        // Fetch and increment the global split counter to get a unique ID.
        let split_id: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::SplitCounter)
            .unwrap_or(0)
            + 1;

        env.storage()
            .persistent()
            .set(&DataKey::SplitCounter, &split_id);

        // Build a paid-status map.  The payer is marked paid from the start
        // because they already covered the total bill upfront.
        let mut paid: Map<Address, bool> = Map::new(&env);
        paid.set(payer.clone(), true);

        for p in participants.iter() {
            // Non-payer participants start as unpaid.
            if p != payer {
                paid.set(p.clone(), false);
            }
        }

        // The payer's share counts toward the collected total immediately.
        let collected: i128 = share_amount;
        let participant_count = paid.len() as i128;
        let total_expected: i128 = share_amount * participant_count;

        // Persist the split record.
        let record = SplitRecord {
            payer: payer.clone(),
            participants: participants.clone(),
            share_amount,
            paid,
            collected,
            total_expected,
            settled: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Split(split_id), &record);

        env.events().publish(
            (Symbol::new(&env, "split"), symbol_short!("created")),
            (split_id, payer, total_expected),
        );

        split_id
    }

    /// `pay_share` — A participant sends their XLM share to the contract.
    ///
    /// Validates that:
    /// 1. The split exists and is not yet settled.
    /// 2. The caller is an actual participant.
    /// 3. The caller has not already paid (prevents double-payment).
    ///
    /// After recording the payment the function checks whether everyone has
    /// paid.  If so, it automatically calls `settle_split` to forward funds
    /// to the payer without requiring a separate transaction.
    ///
    /// # Arguments
    /// * `participant` – The student paying their share; must authorize.
    /// * `split_id`    – ID of the split to pay into.
    pub fn pay_share(env: Env, participant: Address, split_id: u64) {
        participant.require_auth();

        let mut record: SplitRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Split(split_id))
            .expect("split not found");

        assert!(!record.settled, "split already settled");

        // Confirm the caller is a participant.
        let is_participant = record.paid.contains_key(participant.clone());
        assert!(is_participant, "caller is not a participant");

        // Reject duplicate payments.
        let already_paid = record.paid.get(participant.clone()).unwrap_or(false);
        assert!(!already_paid, "participant has already paid");

        // Mark paid and accumulate collected amount.
        record.paid.set(participant.clone(), true);
        record.collected += record.share_amount;

        env.storage()
            .persistent()
            .set(&DataKey::Split(split_id), &record);

        env.events().publish(
            (Symbol::new(&env, "split"), symbol_short!("paid")),
            (split_id, participant.clone()),
        );

        // If everyone has paid, auto-settle without needing an extra call.
        if record.collected >= record.total_expected {
            Self::settle_split(env, split_id);
        }
    }

    /// `settle_split` — Transfers all collected funds to the original payer.
    ///
    /// Can be called manually but is also invoked automatically by `pay_share`
    /// when the last participant sends their contribution.  Marks the split as
    /// settled and emits a settlement event.
    ///
    /// In production this function calls the Stellar native token contract to
    /// transfer `record.collected` stroops to `record.payer`; in the current
    /// MVP the transfer is recorded as state and the event triggers an
    /// off-chain relayer.
    ///
    /// # Arguments
    /// * `split_id` – The split to settle.
    pub fn settle_split(env: Env, split_id: u64) {
        let mut record: SplitRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Split(split_id))
            .expect("split not found");

        assert!(!record.settled, "split already settled");
        assert!(
            record.collected >= record.total_expected,
            "not all participants have paid"
        );

        // Mark as settled before emitting the event to prevent re-entrancy.
        record.settled = true;

        env.storage()
            .persistent()
            .set(&DataKey::Split(split_id), &record);

        // Emit a settlement event.  The off-chain relayer listens for this
        // event and executes the XLM transfer from the contract's custody
        // account to `record.payer`.
        env.events().publish(
            (Symbol::new(&env, "split"), symbol_short!("settled")),
            (split_id, record.payer.clone(), record.collected),
        );
    }

    /// `verify_split` — Returns `true` if the split has been fully settled.
    ///
    /// Also emits a verification event so front-ends and monitoring tools can
    /// subscribe without polling storage.  This is a read-only helper; it does
    /// not mutate any state.
    ///
    /// # Arguments
    /// * `split_id` – The split to check.
    pub fn verify_split(env: Env, split_id: u64) -> bool {
        let record: SplitRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Split(split_id))
            .expect("split not found");

        // Emit a boolean verification event regardless of the result.
        env.events().publish(
            (Symbol::new(&env, "split"), symbol_short!("verify")),
            (split_id, record.settled),
        );

        record.settled
    }

    // ─────────────────────────────────────────
    // VIEW HELPERS
    // ─────────────────────────────────────────

    /// Returns the current locked allowance balance for a student (in stroops).
    pub fn get_balance(env: Env, student: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::AllowanceBalance(student))
            .unwrap_or(0)
    }

    /// Returns the full `SplitRecord` for inspection by front-ends.
    pub fn get_split(env: Env, split_id: u64) -> SplitRecord {
        env.storage()
            .persistent()
            .get(&DataKey::Split(split_id))
            .expect("split not found")
    }
}