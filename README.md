# campusflow-wallet
On-chain allowance scheduling and split-billing coordination for Southeast Asian university students, built on Stellar's Soroban platform. Parents lock a weekly allowance that drips daily to a student wallet; roommates create shared expense groups, pay their share into contract escrow, and the contract automatically settles to the original payer the moment the last contribution arrives.

## Contract Deployment

**Network:** Stellar Testnet  
**Contract ID:** `CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG`  
**Soroban RPC URL:** `https://soroban-testnet.stellar.org`

### View on Stellar Explorer
- [Contract on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG)
- [Contract on Testnet](https://testnet.sorobanexpert.com/contract/CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG)

**Note:** The same contract handles both allowance scheduling and split billing functionality. Legacy environment variable names (`VITE_ALLOWANCE_CONTRACT_ID`, `VITE_SPLIT_CONTRACT_ID`) point to this same contract ID for backwards compatibility.

## WebApp Deployment
**Deployed Website:** https://campusflow-stellar-rho.vercel.app
**Screenshot of UI:**
<img width="1845" height="889" alt="image" src="https://github.com/user-attachments/assets/ddc50a6e-6b5e-49ce-ac4f-6d4cf17e803d" />
<img width="1855" height="881" alt="image" src="https://github.com/user-attachments/assets/05ba98aa-94cc-4574-97f8-60c607ad6650" />
<img width="1840" height="890" alt="image" src="https://github.com/user-attachments/assets/1044f7ca-2591-4d7b-91b6-88392b76b8c9" />
<img width="1842" height="883" alt="image" src="https://github.com/user-attachments/assets/16700014-00d7-4fb4-ae2a-35e85e08dc23" />
<img width="1831" height="887" alt="image" src="https://github.com/user-attachments/assets/6d8ea36b-24b2-4f5b-8fcf-560e8437713c" />
<img width="1837" height="884" alt="image" src="https://github.com/user-attachments/assets/a0e68c0f-8e61-456c-9d86-4c9370da2e57" />

## Features & Web Interface

### Frontend Features
The web app provides a complete interface for both allowance scheduling and split expense management:

1. **Wallet Connection** - Connect your Freighter wallet directly to the app
2. **Balance Dashboard** - View your current locked allowance and daily release amounts
3. **Allowance Management** - 
   - Deposit allowance (parent/sponsor role)
   - Release daily drips (student role, with 24-hour cooldown protection)
4. **Split Expenses** - 
   - Create shared expense groups with roommates
   - See all active and settled splits
   - Pay your share into a split with one click
   - Auto-settlement happens when the last participant pays
5. **Real-time Status Updates** - All data fetches directly from the deployed contract

### How to Use

#### As a Parent/Sponsor
1. Connect wallet (ensure you have testnet XLM)
2. Go to "Manage Allowance" tab
3. Click "Deposit Allowance for Student"
4. Enter student address, amount, and daily release limit
5. Sign the transaction in Freighter
6. The funds are now locked on-chain and ready for daily releases

#### As a Student
1. Connect wallet
2. **Release allowance:** Go to "My Allowance" → "Release Today's Drip"
3. **Create a split:** Go to "Split Expenses" → "Create New Split"
   - Add roommate addresses as participants
   - Set the share amount each person owes
   - You're automatically marked as paid (you covered the bill)
4. **Pay a share:** When a split involves you as a participant, click "Pay My Share"
5. Once all participants pay, the split auto-settles and funds go to the payer

## How It Works
```
Parent      ──► deposit_allowance(depositor, student, amount, daily_release)
                    │  AllowanceBalance += amount
                    │  DailyRelease and LastRelease recorded
                    ▼
Student     ──► release_allowance(student)
                    │  requires now >= last_release + 86_400
                    │  releases min(daily_release, remaining_balance)
                    ▼
             AllowanceBalance reduced; event emitted

Student     ──► create_split(payer, participants, share_amount)
                    │  payer auto-marked paid (they covered the bill upfront)
                    │  remaining participants marked unpaid
                    │  total_expected = share_amount × participant_count
                    ▼
             SplitRecord persisted; unique split_id returned

Roommate    ──► pay_share(participant, split_id)
                    │  validates participant exists and has not already paid
                    │  marks paid, increments collected
                    │
            ┌─── last participant paid? ──────────────────────────────────────┐
            │                                                                  │
            │  NO                                                    YES       │
            │  event emitted                              settle_split() called │
            │  waiting for others                         automatically         │
            │                                                                  │
            │                                          collected paid out       │
            │                                          to original payer        │
            │                                          SplitRecord.settled = true
            │
Anyone      ──► verify_split(split_id)
                    │  returns bool; emits verification event
                    ▼
             true  — settled; false — still pending
```

## Split Accounting
```
total_expected  =  share_amount × len(participants)   // payer's share included
collected       =  share_amount                        // seeded at creation (payer already paid)
                +  Σ share_amount per pay_share call
settled         =  true when collected >= total_expected
```
The payer's share is counted from the moment the split is created, so `collected` starts at `share_amount` and climbs by the same increment each time a roommate calls `pay_share`.

## Split Status
| Status | Description |
|---|---|
| Pending | Split created; one or more participants have not yet paid |
| Settled | All participants have paid; funds transferred to payer; `settled = true` |

## Storage Layout
| Key | Type | Scope | Description |
|---|---|---|---|
| `AllowanceBalance(addr)` | `i128` | Persistent | Locked allowance remaining for a student |
| `DailyRelease(addr)` | `i128` | Persistent | Maximum stroops releasable per day |
| `LastRelease(addr)` | `u64` | Persistent | Ledger timestamp of most recent release |
| `SplitCounter` | `u64` | Persistent | Auto-incrementing split ID counter |
| `Split(id)` | `SplitRecord` | Persistent | Full split record keyed by split ID |

## Public Interface

### Allowance Management

#### deposit_allowance
```rust
pub fn deposit_allowance(
    env: Env,
    depositor: Address,   // parent or sponsor; must authorize
    student: Address,     // address that receives daily drips
    amount: i128,         // total stroops to lock
    daily_release: i128,  // maximum stroops releasable per day
)
```
Lock an allowance for a student. Additive — calling again adds to the existing balance. Seeds `LastRelease` to now so the first drip is available exactly 24 hours later.

#### release_allowance
```rust
pub fn release_allowance(env: Env, student: Address) -> i128
```
Release today's scheduled drip to the student. Enforces a 24-hour cooldown. Releases `min(daily_release, remaining_balance)` and returns the amount released. Student must authorize.

### Split Billing

#### create_split
```rust
pub fn create_split(
    env: Env,
    payer: Address,              // student who paid the bill upfront; must authorize
    participants: Vec<Address>,  // roommates who owe a share
    share_amount: i128,          // stroops each participant must contribute
) -> u64                         // returns unique split_id
```
Create a shared expense group. The payer is automatically marked as paid and their share counted toward `collected`. Returns a unique `split_id`.

Validations: `participants` non-empty; `share_amount > 0`.

#### pay_share
```rust
pub fn pay_share(env: Env, participant: Address, split_id: u64)
```
Pay a participant's share into the split. Caller must be listed as a participant and must not have already paid. If this is the final outstanding share, `settle_split` is called automatically. Participant must authorize.

#### settle_split
```rust
pub fn settle_split(env: Env, split_id: u64)
```
Transfer all collected funds to the original payer. Called automatically by `pay_share` when the last participant pays, but may also be invoked manually. Requires `collected >= total_expected` and `settled == false`.

#### verify_split
```rust
pub fn verify_split(env: Env, split_id: u64) -> bool
```
Returns `true` if the split has been fully settled. Also emits a verification event. Read-only; does not mutate state.

### Queries
| Function | Returns |
|---|---|
| `get_balance(env, student)` | `i128` — current locked allowance in stroops |
| `get_split(env, split_id)` | `SplitRecord` — full split record |

## Data Types

### SplitRecord
```rust
pub struct SplitRecord {
    pub payer: Address,             // student who paid upfront; receives settlement
    pub participants: Vec<Address>, // all addresses (payer + roommates)
    pub share_amount: i128,         // stroops each person owes
    pub paid: Map<Address, bool>,   // per-participant payment status
    pub collected: i128,            // stroops received so far
    pub total_expected: i128,       // share_amount × participant count
    pub settled: bool,              // true after funds transferred to payer
}
```

## Getting Testnet Funds

Before using the application, you'll need testnet XLM in your Freighter wallet:

1. Visit [Stellar Friendbot](https://friendbot.stellar.org/)
2. Paste your Freighter public key (starting with `G`)
3. Claim 10,000 testnet XLM (worth ~0 in real money)
4. Switch your Freighter wallet to **Stellar Testnet**
5. The app will automatically detect your balance

## Getting Started

### Prerequisites

#### For Smart Contract Development
- Rust with `wasm32-unknown-unknown` target
- Soroban CLI ≥ 21.x
```bash
rustup target add wasm32-unknown-unknown
cargo install --locked soroban-cli
```

#### For Frontend & Usage
- Node.js ≥ 16.x
- npm or yarn
- [Freighter Wallet](https://www.freighter.app/) browser extension installed

### Setup & Run Locally

#### 1. Clone the repository
```bash
git clone https://github.com/helenaherrero515/campusflow-stellar.git
cd campusflow-stellar
```

#### 2. (Optional) Build the Smart Contract Locally
```bash
soroban contract build
```
Output:
```
target/wasm32-unknown-unknown/release/campusflow_wallet.wasm
```

The contract is already deployed on Stellar Testnet. If you want to redeploy:
```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/campusflow_wallet.wasm \
  --source your-account --network testnet
```

#### 3. Run Smart Contract Tests (Optional)
```bash
cargo test
```
All 3 tests verify allowance scheduling, split billing, and auto-settlement:
```
running 3 tests
test tests::test_happy_path_allowance_split_and_settlement ... ok
test tests::test_duplicate_payment_is_rejected ... ok
test tests::test_state_reflects_split_status_and_allowance_after_settlement ... ok

test result: ok. 3 passed; 0 failed
```

#### 4. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
The app will open at `http://localhost:5173`

#### 5. Connect Your Wallet & Use the App
- Click "Connect Wallet" in the app
- Authorize Freighter to connect to the app
- Your Freighter must be on **Stellar Testnet** with testnet XLM (get from Friendbot above)
- The app will automatically fetch your real balance from the deployed contract
- Start by depositing an allowance (parent role) or releasing daily drips (student role)

## Configuration

All configuration is in `/frontend/.env`:
```env
VITE_CONTRACT_ID=CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG
VITE_STELLAR_NETWORK=TESTNET
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```

**Legacy env vars** (for backwards compatibility):
```env
VITE_ALLOWANCE_CONTRACT_ID=CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG
VITE_SPLIT_CONTRACT_ID=CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG
```

Both allowance and split features are in the same deployed contract.

## Deployment Verification

### View Live Contract on Stellar Testnet
- **[Stellar Expert Explorer](https://stellar.expert/explorer/testnet/contract/CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG)**
- **[Soroban Expert](https://testnet.sorobanexpert.com/contract/CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG)**

Both explorers display the full contract code, state layout, and recent transactions.

## Example Walkthrough: End-to-End Flow

This example shows a complete flow from deposit → release → split creation → payment → settlement.

### Scenario
- **Parent Account:** Has testnet XLM; wants to fund student's weekly allowance
- **Student Account:** Needs daily drips and wants to split meal expenses with roommates
- **Roommates:** Need to pay their shares

### Step-by-Step

#### 1. Parent Deposits Weekly Allowance (7 XLM, 1 XLM/day release limit)
**Via Web UI:**
1. Parent connects wallet
2. Go to "Manage Allowance" tab
3. Enter student address, 7 XLM, 1 XLM daily limit
4. Click "Deposit Allowance for Student"
5. Freighter prompts to sign transaction
6. Parent's 7 XLM is now locked in the contract for the student

**Or via CLI:**
```bash
soroban contract invoke \
  --id CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG \
  --source parent-account \
  --network testnet \
  -- deposit_allowance \
  --depositor <PARENT_ADDRESS> \
  --student <STUDENT_ADDRESS> \
  --amount 70000000 \
  --daily_release 10000000
```

#### 2. Student Releases Today's Drip (1 XLM)
**Via Web UI:**
1. Student connects wallet
2. Go to "My Allowance" tab
3. Click "Release Today's Drip"
4. 1 XLM (10,000,000 stroops) is immediately available

**24-hour cooldown enforced:** The next release can only happen ≥24 hours later.

#### 3. Student Creates a Meal Split (₱ 480 total = ₱ 120/person × 4)
**Via Web UI:**
1. Go to "Split Expenses" tab
2. Click "Create New Split"
3. Enter roommate addresses (comma-separated)
4. Set share amount (120 per person)
5. Click "Create Split"
6. Contract auto-marks student as **paid** (they covered the bill)
7. Roommates receive payment requests

**Or via CLI:**
```bash
soroban contract invoke \
  --id CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG \
  --source student-account \
  --network testnet \
  -- create_split \
  --payer <STUDENT_ADDRESS> \
  --participants '["<ROOMMATE_A>", "<ROOMMATE_B>", "<ROOMMATE_C>"]' \
  --share_amount 1200000
# Returns: split_id = 1
```

#### 4. Roommates Pay Their Shares
**Via Web UI (Roommate A):**
1. Roommate A connects wallet
2. See "Jollibee Run" in pending splits
3. Click "Pay My Share"
4. 120 is deducted and sent to contract escrow

**Via CLI:**
```bash
soroban contract invoke \
  --id CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG \
  --source roommate-a-account \
  --network testnet \
  -- pay_share \
  --participant <ROOMMATE_A> \
  --split_id 1
```

#### 5. Last Roommate Pays & Auto-Settlement Triggers
When Roommate C pays their share:
- Contract checks: `collected >= total_expected` (✓ 480 >= 480)
- Automatically calls `settle_split()` inline
- All 480 stroops transferred to student
- Split marked as **Settled**
- Event emitted; UI updates to "Settlement confirmed"

**Roommate C's transaction automatically triggers settlement** — no manual step needed.

#### 6. Verify Settlement (Optional)
**Via Web UI:**
1. View split status → shows **Settled**

**Or via CLI:**
```bash
soroban contract invoke \
  --id CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG \
  --source anyone \
  --network testnet \
  -- verify_split \
  --split_id 1
# Returns: true (settled)
```

## Test Coverage
| Category | Tests |
|---|---|
| Allowance deposit | balance stored, additive top-up, daily release recorded, last release seeded to now |
| Allowance release | correct drip amount returned, balance decremented, 24-hour cooldown enforced, zero balance panics |
| Split creation | record persisted, sequential IDs, payer auto-marked paid, total_expected calculated correctly, empty participants panics, zero share panics |
| Participant payment | paid flag set, collected incremented, non-participant rejected, duplicate payment rejected |
| Auto-settlement | settle_split invoked inline on final payment, settled flag set, event emitted |
| Verify split | returns true after settlement, returns false while pending, event emitted on both |
| State consistency | allowance balance unaffected by split settlement, collected == total_expected after all pay, split storage correct after full lifecycle |
| End-to-end | full lifecycle (deposit → release → create_split → pay × N → auto-settle → verify), duplicate payment rejected mid-split, ledger-clock advance validates cooldown |

## Suggested Timeline
| Week | Milestone |
|---|---|
| 1 | Contract logic complete; all 3 tests passing locally |
| 2 | Deploy to Stellar Testnet; validate all CLI invocations end-to-end |
| 3 | Minimal React/Next.js web app — wallet connect, allowance dashboard, split UI |
| 4 | User testing with 5–10 dorm students; iterate on UX and error messaging |
| 5 | Testnet demo day; walkthrough video; open-source release |

## License
MIT
