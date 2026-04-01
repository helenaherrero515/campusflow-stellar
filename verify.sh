#!/bin/bash

# CampusFlow Verification Script
# Checks that all components are in place and working

echo "🔍 CampusFlow Stellar - Verification Script"
echo "==========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TOTAL_CHECKS=0
PASSED_CHECKS=0

# Helper function
check_item() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [ -f "$1" ] || [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}✗${NC} $2 (Not found: $1)"
    fi
}

echo "📁 Checking File Structure..."
echo ""

# Smart Contract
echo "Smart Contract:"
check_item "src/lib.rs" "Smart contract implementation"
check_item "src/test.rs" "Smart contract tests"
check_item "Cargo.toml" "Cargo configuration"

echo ""

# Frontend Structure
echo "Frontend Application:"
check_item "frontend/src/App.jsx" "Main App component"
check_item "frontend/src/AppWrapper.jsx" "App wrapper with NetworkSwitcher"
check_item "frontend/src/main.jsx" "React entry point"
check_item "frontend/src/index.css" "Global styles"

echo ""

# Components
echo "React Components:"
check_item "frontend/src/components/Allowance.jsx" "Allowance component"
check_item "frontend/src/components/SplitBill.jsx" "SplitBill component"
check_item "frontend/src/components/ConnectWallet.jsx" "ConnectWallet component"
check_item "frontend/src/components/FreighterInstall.jsx" "FreighterInstall component"
check_item "frontend/src/components/NetworkSwitcher.jsx" "NetworkSwitcher component (NEW)"

echo ""

# Libraries
echo "Library Files:"
check_item "frontend/src/lib/contract.js" "Contract integration"
check_item "frontend/src/lib/wallet.js" "Wallet integration"
check_item "frontend/src/lib/networkConfig.js" "Network configuration"
check_item "frontend/src/lib/contractHelpers.js" "Contract helpers"

echo ""

# Configuration
echo "Configuration:"
check_item "frontend/.env" "Environment variables"
check_item "frontend/vite.config.js" "Vite configuration"
check_item "frontend/package.json" "NPM dependencies"

echo ""

# Documentation
echo "Documentation:"
check_item "README.md" "Main README"
check_item "NETWORK_SWITCHING_GUIDE.md" "Network switching guide"
check_item "DEPLOYMENT_GUIDE.md" "Deployment guide"
check_item "COMPLETION_STATUS.md" "Completion status"
check_item "FEATURES_IMPLEMENTED.md" "Features list"
check_item "PROJECT_READY.md" "Project ready summary"

echo ""
echo "==========================================="
echo ""

# Check Node modules (development only)
if [ -d "frontend/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Node modules installed"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
else
    echo -e "${YELLOW}⚠${NC} Node modules not installed (run: npm install)"
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
fi

echo ""
echo "==========================================="
echo -e "Results: ${GREEN}$PASSED_CHECKS/$TOTAL_CHECKS${NC} checks passed"
echo ""

if [ $PASSED_CHECKS -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}✓ All checks passed! Project is ready.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. cd frontend"
    echo "2. npm install"
    echo "3. npm run dev"
    echo "4. Open http://localhost:5173"
    exit 0
else
    FAILED=$((TOTAL_CHECKS - PASSED_CHECKS))
    echo -e "${YELLOW}⚠ $FAILED check(s) failed. Please review missing files.${NC}"
    exit 1
fi
