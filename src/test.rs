#[cfg(test)]
mod tests {
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        vec, Address, Env,
    };

    use crate::{CampusFlowWallet, CampusFlowWalletClient};

    // ────────────────────────────────────────────────────────────────────────
    // Test 1 — Happy Path
    //
    // Verifies the full end-to-end lifecycle:
    //   1. Parent deposits and locks an allowance for a student.
    //   2. One roommate creates a split expense (e.g. electricity bill).
    //   3. Each non-payer participant calls pay_share.
    //   4. After the last payment the split is auto-settled and
    //      verify_split returns true.
    // ────────────────────────────────────────────────────────────────────────
    #[test]
    fn test_happy_path_allowance_split_and_settlement() {
        let env = Env::default();

        // Disable auth checks in tests so we can drive the contract
        // without setting up full Stellar account signing.
        env.mock_all_auths();

        let contract_id = env.register_contract(None, CampusFlowWallet);
        let client = CampusFlowWalletClient::new(&env, &contract_id);

        // ── Actors ──────────────────────────────────────────────────────────
        let parent: Address = Address::generate(&env);
        let student: Address = Address::generate(&env);  // payer of the bill
        let roommate_a: Address = Address::generate(&env);
        let roommate_b: Address = Address::generate(&env);

        // ── Step 1: Deposit allowance ────────────────────────────────────────
        // Parent locks 7 000 000 stroops (0.7 XLM) with a daily drip of
        // 1 000 000 stroops (0.1 XLM) — roughly ₱3 per day.
        let locked_amount: i128 = 7_000_000;
        let daily: i128 = 1_000_000;
        client.deposit_allowance(&parent, &student, &locked_amount, &daily);

        // Verify the balance was recorded correctly.
        let balance = client.get_balance(&student);
        assert_eq!(balance, locked_amount, "locked balance should match deposit");

        // ── Step 2: Create a split ───────────────────────────────────────────
        // Student paid for a shared meal; each person owes 300 000 stroops.
        let share: i128 = 300_000;
        let participants = vec![&env, roommate_a.clone(), roommate_b.clone()];
        let split_id = client.create_split(&student, &participants, &share);

        // The student (payer) is auto-marked as paid; only roommates are pending.
        assert_eq!(split_id, 1, "first split should have ID 1");

        // ── Step 3: Roommates pay their shares ───────────────────────────────
        client.pay_share(&roommate_a, &split_id);
        client.pay_share(&roommate_b, &split_id);

        // ── Step 4: Verify settlement ────────────────────────────────────────
        // After roommate_b's payment the contract auto-settled.
        // verify_split should now return true.
        let is_settled = client.verify_split(&split_id);
        assert!(is_settled, "split should be settled after all participants paid");

        // Double-check via get_split.
        let record = client.get_split(&split_id);
        assert!(record.settled, "SplitRecord.settled should be true");
        assert_eq!(
            record.collected,
            share * 3, // student + two roommates
            "collected should equal total_expected"
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // Test 2 — Edge Case: Duplicate Payment Rejected
    //
    // Confirms that a participant who has already paid cannot submit a second
    // payment for the same split, preventing double-counting and exploitation.
    // ────────────────────────────────────────────────────────────────────────
    #[test]
    #[should_panic(expected = "participant has already paid")]
    fn test_duplicate_payment_is_rejected() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, CampusFlowWallet);
        let client = CampusFlowWalletClient::new(&env, &contract_id);

        let payer: Address = Address::generate(&env);
        let participant: Address = Address::generate(&env);

        // Create a split with one non-payer participant.
        let share: i128 = 500_000;
        let participants = vec![&env, participant.clone()];
        let split_id = client.create_split(&payer, &participants, &share);

        // First payment — should succeed.
        client.pay_share(&participant, &split_id);

        // Second payment by the same participant — must panic.
        // The #[should_panic] attribute asserts the exact message is raised.
        client.pay_share(&participant, &split_id);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Test 3 — State Verification After Settlement
    //
    // Validates that contract storage correctly reflects:
    //   * The allowance balance decreases after a daily release.
    //   * The split's `settled` flag is true and `collected == total_expected`.
    //   * `verify_split` returns true and the split record is consistent.
    // ────────────────────────────────────────────────────────────────────────
    #[test]
    fn test_state_reflects_split_status_and_allowance_after_settlement() {
        let env = Env::default();
        env.mock_all_auths();

        // ── Ledger setup ─────────────────────────────────────────────────────
        // Start at timestamp 0 so we control the time progression precisely.
        env.ledger().set(LedgerInfo {
            timestamp: 0,
            protocol_version: 20,
            sequence_number: 1,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 10,
            min_persistent_entry_ttl: 10,
            max_entry_ttl: 3_110_400,
        });

        let contract_id = env.register_contract(None, CampusFlowWallet);
        let client = CampusFlowWalletClient::new(&env, &contract_id);

        let parent: Address = Address::generate(&env);
        let student: Address = Address::generate(&env);
        let roommate: Address = Address::generate(&env);

        // ── Deposit allowance ────────────────────────────────────────────────
        let locked: i128 = 5_000_000;
        let daily: i128 = 1_000_000;
        client.deposit_allowance(&parent, &student, &locked, &daily);

        assert_eq!(
            client.get_balance(&student),
            locked,
            "initial balance should equal locked amount"
        );

        // ── Advance ledger clock by 25 hours and release daily allowance ──────
        env.ledger().set(LedgerInfo {
            timestamp: 90_000, // 25 hours — past the 24-hour cooldown
            protocol_version: 20,
            sequence_number: 2,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 10,
            min_persistent_entry_ttl: 10,
            max_entry_ttl: 3_110_400,
        });

        let released = client.release_allowance(&student);
        assert_eq!(released, daily, "released amount should equal daily limit");

        let balance_after_release = client.get_balance(&student);
        assert_eq!(
            balance_after_release,
            locked - daily,
            "balance should decrease by one daily amount"
        );

        // ── Create and fully settle a split ──────────────────────────────────
        let share: i128 = 200_000;
        let participants = vec![&env, roommate.clone()];
        let split_id = client.create_split(&student, &participants, &share);

        // Roommate pays.
        client.pay_share(&roommate, &split_id);

        // ── Assert final state ───────────────────────────────────────────────
        let record = client.get_split(&split_id);

        assert!(
            record.settled,
            "split record should be marked settled after all shares received"
        );
        assert_eq!(
            record.collected, record.total_expected,
            "collected should equal total_expected after settlement"
        );

        // verify_split must agree with the stored record.
        let verified = client.verify_split(&split_id);
        assert!(verified, "verify_split should return true for a settled split");

        // Allowance balance should be unchanged by the split (splits are separate).
        assert_eq!(
            client.get_balance(&student),
            balance_after_release,
            "split settlement must not affect the student's allowance balance"
        );
    }
}