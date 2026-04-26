#!/bin/bash
# Debug Script: Scenario Silence Settings
# This script helps debug why silence timer settings are not being saved

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

SCENARIO_ID="28c97f47-b51c-4334-aac3-dbb14c681c42"

log_section "Scenario Silence Settings Debug"
log_info "Scenario ID: $SCENARIO_ID"
echo ""

# 1. Check Lambda function deployment
log_info "1. Checking Lambda function deployment..."
aws lambda get-function --function-name prance-scenarios-update-dev \
  --query '{FunctionName:Configuration.FunctionName, LastModified:Configuration.LastModified, Runtime:Configuration.Runtime}' \
  --output table
echo ""

# 2. Test Lambda function with sample update
log_info "2. Testing Lambda function with sample update (DRY RUN)..."
echo "   This will show what happens when we try to update showSilenceTimer"
echo ""

# 3. Check recent CloudWatch Logs
log_info "3. Checking recent CloudWatch Logs for scenarios-update..."
echo "   Looking for update requests in the last 10 minutes:"
echo ""
aws logs tail /aws/lambda/prance-scenarios-update-dev --since 10m | grep -A 5 -B 2 "showSilenceTimer\|Update scenario request\|Scenario updated"
echo ""

# 4. Instructions for frontend testing
log_section "Frontend Testing Instructions"

echo "1. Open scenario edit page:"
echo "   https://dev.app.prance.jp/dashboard/scenarios/$SCENARIO_ID/edit"
echo ""
echo "2. Open browser DevTools (F12) → Console tab"
echo ""
echo "3. Click the silence timer toggle button"
echo "   - Gray (Use Default) → Green (Enabled) → Red (Disabled) → Gray"
echo ""
echo "4. Click 'Update Scenario' button"
echo ""
echo "5. Check console for these logs:"
echo "   [ScenarioEdit] Loaded scenario from DB: {...}"
echo "   [ScenarioEdit] Updating scenario with data: {...}"
echo "   [ScenarioEdit] showSilenceTimer value: ... type: ..."
echo ""
echo "6. After save, go to scenario detail page:"
echo "   https://dev.app.prance.jp/dashboard/scenarios/$SCENARIO_ID"
echo ""
echo "7. Check console for:"
echo "   [ScenarioDetail] Loaded scenario data: {...}"
echo "   [ScenarioDetail] showSilenceTimer: ... type: ..."
echo ""
echo "8. Share all console logs with the developer"
echo ""

log_section "Expected Values"

echo "showSilenceTimer values:"
echo "  - undefined/null → Use organization default (gray toggle)"
echo "  - true → Enabled (green toggle)"
echo "  - false → Disabled (red toggle)"
echo ""
echo "If the value doesn't change after saving:"
echo "  1. Check console logs for API request/response"
echo "  2. Run this script again to check Lambda logs"
echo "  3. Check database directly (if accessible)"
echo ""
