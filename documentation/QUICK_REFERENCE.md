# CampusFlow Quick Reference

## Live Contract
- **ID**: `CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG`
- **Network**: Stellar Testnet
- **Explorer**: https://stellar.expert/explorer/testnet/contract/CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG

## Quick Start
```bash
cd frontend && npm install && npm run dev
# Opens http://localhost:5173
```

## Get Testnet Funds
https://friendbot.stellar.org/ (paste your Freighter public key)

## User Roles

### Parent/Sponsor
- Deposits allowance for student
- Sets daily release ceiling
- Monitors funds

### Student
- Connects wallet
- Releases daily drip
- Creates expense splits
- Tracks payments

### Roommate
- Joins splits
- Pays their share
- Verifies settlement

## App Sections

| Section | Feature | Function |
|---------|---------|----------|
| Dashboard | Balance Display | Real on-chain balance in XLM/PHP |
| Allowance | Deposit & Release | Lock funds, claim daily drips |
| Expenses | Split Management | Create, pay, track expense groups |
| Contributions | Status Table | See who paid what |
| Overview | Parent View | Monitor all students/splits |
| Alerts | Notifications | All on-chain events |

## Smart Contract Functions

```
deposit_allowance(depositor, student, amount, daily_release)
  → Locks funds, records release schedule

release_allowance(student)
  → Claims daily drip (24-hour cooldown enforced)

create_split(payer, participants[], share_amount)
  → Creates expense group, auto-marks payer as paid

pay_share(participant, split_id)
  → Pays into split, auto-settles when complete

verify_split(split_id)
  → Checks if split is settled

get_balance(student)
  → Returns locked allowance in stroops

get_split(split_id)
  → Returns full split record
```

## Common Values

| Item | Value |
|------|-------|
| **1 XLM in stroops** | 10,000,000 |
| **PHP per XLM** | 117.9 |
| **Testnet XLM from Friendbot** | 10,000 |
| **Release cooldown** | 86,400 seconds (24 hours) |
| **Example deposit** | 1 XLM (10M stroops) |
| **Example daily ceiling** | 0.1 XLM (1M stroops) |
| **Example share amount** | 0.05 XLM (500K stroops) |

## Testing Scenarios

### Scenario 1: Simple Allowance
1. Parent: Deposit 1 XLM, 0.1 daily
2. Student: Release today's 0.1 XLM
3. Check balance updates

### Scenario 2: Split Meal
1. Student A: Create split (0.05 XLM × 3 people)
2. Student B: Pay share
3. Student C: Pay share (triggers auto-settlement)
4. Check notifications

### Scenario 3: Full Workflow
1. Parent deposits for student
2. Student releases daily allowance
3. Student creates split with roommates
4. Roommates pay shares
5. Auto-settlement occurs
6. Check notifications and balance

## Error Messages & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Connect wallet first" | Not logged in | Click Connect Wallet button |
| "Invalid address (G...)" | Wrong format | Copy full public key from Freighter |
| "Cooldown not met" | Released < 24h ago | Wait for cooldown timer |
| "Insufficient balance" | Not enough XLM | Get more from Friendbot |
| "Invalid amount" | Wrong format or zero | Enter positive number |
| "FREIGHTER_NOT_FOUND" | Extension missing | Install from freighter.app |

## Conversion Reference

```
1 XLM = 10,000,000 stroops (on-chain units)
1 XLM ≈ ₱ 117.9 (approximate, may vary)

Examples:
- 0.1 XLM = 1,000,000 stroops ≈ ₱ 11.79
- 0.05 XLM = 500,000 stroops ≈ ₱ 5.90
- 1 XLM = 10,000,000 stroops ≈ ₱ 117.9
```

## Files & Components

```
App.jsx
├── expenseCard()           - Split display component
├── handleConnect()         - Wallet connection
├── handleReleaseAllowance() - Claim daily drip
├── handleDeposit()         - Lock allowance
├── handleCreateSplit()     - Create expense group
├── handlePayShare()        - Pay into split
└── Toast, Spinner helpers

Allowance.jsx
├── handleDeposit()   - Deposit form
├── handleRelease()   - Release form
└── handleGetBalance() - Balance query

SplitBill.jsx
├── handleCreateSplit() - Create split form
├── handlePayShare()    - Pay share form
├── handleVerify()      - Verify settlement
└── fetchActiveSplits() - Fetch splits list
```

## Deployment Checklist

- [ ] All components tested locally
- [ ] Testnet XLM obtained (Friendbot)
- [ ] All workflows tested end-to-end
- [ ] Screenshots captured for README
- [ ] Contract verified on Explorer
- [ ] Code pushed to GitHub
- [ ] Vercel deployment triggered
- [ ] Production URL verified working
- [ ] README updated with live links
- [ ] Share with test users

## Support

**Issue?** Check:
1. Freighter installed and connected to Testnet
2. Have testnet XLM (get from Friendbot)
3. Address format correct (starts with G, 56 chars)
4. Contract ID matches: CA4KZTR6...JGICNG

**Still stuck?**
- Check browser console for errors
- View contract on Stellar Expert
- Review smart contract tests for expected behavior
- Open issue on GitHub

---

**Version**: 1.0 Production Ready
**Last Updated**: March 31, 2026
**Status**: All systems operational
