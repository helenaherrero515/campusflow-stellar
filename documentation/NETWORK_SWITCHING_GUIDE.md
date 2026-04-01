# Network Switching Guide - CampusFlow

## Overview

CampusFlow now supports switching between **Stellar Testnet** and **Mainnet** with a single click in the UI. The network switcher component appears in the top-right corner of the application with color indicators and network information.

## User Interface

### Network Switcher Button
- **Location**: Top-right corner of the app
- **Appearance**: Badge with colored dot and network name
- **Colors**:
  - 🟢 Green: Testnet (development)
  - 🟠 Orange: Mainnet (production)

### Network Dropdown Menu
Click the badge to open a dropdown showing:
- **Network Options** with descriptions
- **Current network indicator** (✓ checkmark)
- **Network Information**:
  - RPC endpoint URL
  - Deployed contract ID (shortened)
  - Network status

## How to Switch Networks

### Via UI (Recommended)
1. Look for the network indicator in the **top-right corner**
2. It shows a colored dot and network name (e.g., "🟢 Testnet")
3. Click the button to open the network selector dropdown
4. Choose between:
   - **Testnet** (Development/Testing) - Green indicator
   - **Mainnet** (Production with real XLM) - Orange indicator
5. Confirm the switch - the app will reload with the new network
6. Switch your Freighter wallet to the matching network

### Network Information Displayed
Each network shows:
- Network name (Testnet / Mainnet)
- Description (Development vs Production)
- RPC endpoint
- Deployed contract ID

## Testnet Setup (Development)

### Prerequisites
- Freighter wallet browser extension installed
- Testnet XLM for transaction fees

### Get Testnet XLM
1. Visit [Stellar Friendbot](https://friendbot.stellar.org/)
2. Enter your Freighter wallet address (starts with `G`)
3. Claim 10,000 testnet XLM
4. In Freighter, switch to **Testnet** network

### Configuration
The following is pre-configured in `frontend/.env`:
```env
VITE_CONTRACT_ID=CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG
VITE_DEFAULT_NETWORK=TESTNET
```

**Current Testnet Contract ID**: `CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG`

## Mainnet Setup (Production)

### Prerequisites
- Real XLM in your Freighter wallet
- Contract deployed to Mainnet
- Sufficient XLM for transaction fees (~0.001 XLM per transaction)

### Deploy Contract to Mainnet

#### Step 1: Build the contract
```bash
cd /path/to/campusflow-stellar
soroban contract build
```

#### Step 2: Deploy to Mainnet
```bash
# Set up mainnet account with XLM
soroban config identity fund campusflow-main --network mainnet

# Deploy the contract
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/campusflow_wallet.wasm \
  --source campusflow-main \
  --network mainnet
```

This returns your **Mainnet Contract ID** (starting with `C`)

#### Step 3: Update Environment Variables
Add to `frontend/.env`:
```env
VITE_MAINNET_CONTRACT_ID=<YOUR_DEPLOYED_MAINNET_CONTRACT_ID>
```

Example:
```env
VITE_MAINNET_CONTRACT_ID=CABD76M7VCVJ53EXXJYWCZRHJKQN5KIXNGWZ4NCJXYNFYDXC3PHZF6I
```

#### Step 4: Restart Frontend
```bash
npm run dev  # Or rebuild for production
```

#### Step 5: Switch in UI
1. Open app (defaults to Testnet)
2. Click the network button in top-right
3. Select "Mainnet" from dropdown
4. App reloads and uses mainnet contract
5. Switch Freighter to **Public Network** (mainnet)

## Network Configuration Architecture

### Configuration Files

**`frontend/src/lib/networkConfig.js`** - Network definitions
```javascript
export const NETWORKS = {
  TESTNET: {
    name: "Testnet",
    passphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    freighterNetwork: "TESTNET",
    horizonUrl: "https://horizon-testnet.stellar.org",
    description: "Development and testing network",
    contractId: import.meta.env.VITE_CONTRACT_ID || "CA4KZTR6...",
  },
  MAINNET: {
    name: "Mainnet",
    passphrase: "Public Global Stellar Network ; September 2015",
    rpcUrl: "https://soroban-mainnet.stellar.org",
    freighterNetwork: "PUBLIC",
    horizonUrl: "https://horizon.stellar.org",
    description: "Production network with real XLM",
    contractId: import.meta.env.VITE_MAINNET_CONTRACT_ID || "",
  },
};
```

**`frontend/src/components/NetworkSwitcher.jsx`** - UI component
- Displays current network with color indicator
- Dropdown with all available networks
- Network information (RPC, contract ID)
- Error handling for missing deployments
- Automatic page reload on network change

**`frontend/.env`** - Environment configuration
```env
VITE_CONTRACT_ID=CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG
VITE_MAINNET_CONTRACT_ID=<add-after-mainnet-deployment>
VITE_DEFAULT_NETWORK=TESTNET
```

### Modified Files

**`frontend/src/lib/contract.js`**
- Uses `getNetworkConfig()` for dynamic RPC and contract ID
- Automatically switches based on selected network

**`frontend/src/lib/wallet.js`**
- Uses `getNetworkConfig().freighterNetwork` for signing
- Supports both TESTNET and PUBLIC (Freighter network names)

**`frontend/src/main.jsx`**
- Now imports `AppWrapper` instead of `App`
- AppWrapper includes NetworkSwitcher component

**`frontend/src/AppWrapper.jsx`** (New)
- Wraps App with NetworkSwitcher
- Fixed positioning of network switcher in top-right

## Network Persistence

- Selected network is saved to **localStorage** as `campusflow_network`
- Persists across browser sessions and page reloads
- Users can switch networks at any time
- Custom event dispatched when network changes: `window.dispatchEvent(new CustomEvent("networkChanged"))`

## Testing Network Switching

### Local Testing (Testnet Only)
```bash
cd frontend
npm run dev
# Open http://localhost:5173
# Click network button in top-right
# Should show "Testnet" (green) by default
# Clicking "Mainnet" shows error "No contract deployed on Mainnet"
```

### Testing Testnet to Mainnet (After Deployment)
1. Deploy contract to Mainnet (see above)
2. Add `VITE_MAINNET_CONTRACT_ID` to `.env`
3. Restart dev server: `npm run dev`
4. Click network button
5. Select "Mainnet"
6. App reloads with mainnet configuration
7. Connect mainnet wallet (ensure Freighter is on Public Network)
8. Test a contract call (deposit, release, create split, etc.)
9. Verify transaction appears on [Stellar Expert](https://stellar.expert/)

## Troubleshooting

### Error: "No contract deployed on Mainnet"
**Cause**: Mainnet contract ID not set in `.env` or contract not deployed
**Solution**:
1. Deploy contract to mainnet
2. Get the contract ID from deployment output
3. Add `VITE_MAINNET_CONTRACT_ID=<contract-id>` to `.env`
4. Restart dev server

### "Switch failed" error
**Cause**: Contract not deployed on target network or validation failed
**Solution**:
1. Verify contract is deployed on target network
2. Check contract ID is correct in `.env`
3. View browser console for detailed error message

### Freighter shows wrong network
**Cause**: App and Freighter network mismatch
**Solution**:
1. Check network switcher shows correct network
2. Switch Freighter to matching network:
   - Testnet: Select "Testnet" in Freighter
   - Mainnet: Select "Public Network" in Freighter
3. Reload app

### Transactions fail after network switch
**Cause**: Old data cached, network not properly switched
**Solution**:
1. Reload page manually (F5 or Cmd+R)
2. Clear browser cache for localhost: DevTools > Application > Clear Storage
3. Check balance is available on new network

### Network button shows Testnet but wrong contract
**Cause**: localStorage cache or env var issue
**Solution**:
1. Clear localStorage: DevTools > Application > Local Storage > Delete "campusflow_network"
2. Verify `.env` has correct contract IDs
3. Restart dev server

## API Reference

### `networkConfig.js` Functions

```javascript
// Get current network key
getCurrentNetwork() 
// Returns: "TESTNET" or "MAINNET"

// Set current network (saves to localStorage)
setCurrentNetwork(networkKey)
// Example: setCurrentNetwork("MAINNET")

// Get full configuration for current network
getNetworkConfig()
// Returns: { name, passphrase, rpcUrl, freighterNetwork, contractId, horizonUrl }

// Validate if network is properly set up
validateNetworkSetup(networkKey)
// Returns: { valid: boolean, error?: string }
```

### Events

```javascript
// Dispatched when network is switched
window.addEventListener("networkChanged", (event) => {
  console.log("Network changed to:", event.detail.network);
});
```

## Production Deployment

### Deploy Frontend to Vercel
```bash
# Build production bundle
npm run build

# Deploy to Vercel
vercel deploy --prod
```

### Environment Variables on Vercel

Set in Vercel project settings:
```
VITE_CONTRACT_ID=CA4KZTR6TY56RNE47HT6GFPYE32MFGLVGTGT2FPNNBD74MHZ2TJGICNG
VITE_MAINNET_CONTRACT_ID=<your-mainnet-contract-id>
VITE_DEFAULT_NETWORK=TESTNET  (or MAINNET if you prefer)
```

### Production Checklist
- ✅ Contract deployed to both Testnet and Mainnet
- ✅ `VITE_MAINNET_CONTRACT_ID` set in `.env`
- ✅ Frontend built and deployed
- ✅ Network switcher tested on both networks
- ✅ Freighter network switching documented for users
- ✅ Error messages clear and actionable

## Best Practices

1. **Always Test on Testnet First**
   - Develop features on Testnet
   - Test with mock data
   - Verify functionality before Mainnet

2. **Keep XLM Balance**
   - Maintain ~1 XLM on Testnet (free from Friendbot)
   - Maintain ~10 XLM on Mainnet for production use

3. **Document Your Contract IDs**
   - Save both Testnet and Mainnet contract IDs
   - Track deployment dates and versions
   - Keep deployment transactions for reference

4. **Monitor Network Usage**
   - Track transaction costs on Mainnet
   - Review contract call frequency
   - Optimize for reduced fees if needed

5. **Always Verify Network**
   - Check network indicator before transactions
   - Confirm Freighter is on correct network
   - Verify transactions on appropriate Stellar Expert

6. **Handle Network Errors Gracefully**
   - Display clear error messages to users
   - Don't silently fail transactions
   - Log errors for debugging

## Support & Resources

- **Stellar Docs**: https://developers.stellar.org/
- **Soroban Docs**: https://developers.stellar.org/soroban
- **Stellar Expert**: https://stellar.expert/explorer/testnet
- **Friendbot (Testnet XLM)**: https://friendbot.stellar.org/
- **Freighter Wallet**: https://www.freighter.app/

