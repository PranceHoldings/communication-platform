#!/bin/bash
#
# Language List Synchronization Validation
#
# Ensures that language lists are synchronized across:
# 1. Frontend config (apps/web/lib/i18n/config.ts)
# 2. Lambda config (infrastructure/lambda/shared/config/language-config.ts)
# 3. Message directories (apps/web/messages/)
#
# Exit code:
# 0 - All synchronized
# 1 - Synchronization error found
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Language List Synchronization Validation${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

ERRORS=0

# Extract language codes from Frontend config
echo -e "${BLUE}[Step 1/4]${NC} Extracting Frontend language codes..."
FRONTEND_LANGS=$(grep "^  '" "$PROJECT_ROOT/apps/web/lib/i18n/config.ts" | \
  tr -d "'," | awk '{print $1}' | sort)
FRONTEND_COUNT=$(echo "$FRONTEND_LANGS" | wc -l)
echo -e "  Found: ${FRONTEND_COUNT} languages"
echo "$FRONTEND_LANGS" | sed 's/^/    - /'

# Extract language codes from Lambda config
echo ""
echo -e "${BLUE}[Step 2/4]${NC} Extracting Lambda language codes..."
LAMBDA_LANGS=$(grep "^\s*languageCode: '" "$PROJECT_ROOT/infrastructure/lambda/shared/config/language-config.ts" | \
  cut -d"'" -f2 | sort)
LAMBDA_COUNT=$(echo "$LAMBDA_LANGS" | wc -l)
echo -e "  Found: ${LAMBDA_COUNT} languages"
echo "$LAMBDA_LANGS" | sed 's/^/    - /'

# Get message directories
echo ""
echo -e "${BLUE}[Step 3/4]${NC} Checking message directories..."
MESSAGE_DIRS=$(ls -1 "$PROJECT_ROOT/apps/web/messages/" | grep -v "^\." | sort)
MESSAGE_COUNT=$(echo "$MESSAGE_DIRS" | wc -l)
echo -e "  Found: ${MESSAGE_COUNT} directories"
echo "$MESSAGE_DIRS" | sed 's/^/    - /'

# Compare lists
echo ""
echo -e "${BLUE}[Step 4/4]${NC} Comparing lists..."
echo ""

# Compare Frontend vs Lambda
DIFF_FL=$(diff <(echo "$FRONTEND_LANGS") <(echo "$LAMBDA_LANGS") || true)
if [ -z "$DIFF_FL" ]; then
  echo -e "  ${GREEN}✓ Frontend and Lambda language lists match${NC}"
else
  echo -e "  ${RED}✗ Frontend and Lambda language lists differ${NC}"
  echo ""
  echo "Differences:"
  echo "$DIFF_FL" | sed 's/^/    /'
  ERRORS=$((ERRORS + 1))
fi

# Compare Frontend vs Message directories
DIFF_FM=$(diff <(echo "$FRONTEND_LANGS") <(echo "$MESSAGE_DIRS") || true)
if [ -z "$DIFF_FM" ]; then
  echo -e "  ${GREEN}✓ Frontend config and message directories match${NC}"
else
  echo -e "  ${RED}✗ Frontend config and message directories differ${NC}"
  echo ""
  echo "Differences:"
  echo "$DIFF_FM" | sed 's/^/    /'
  ERRORS=$((ERRORS + 1))
fi

# Count verification
echo ""
if [ "$FRONTEND_COUNT" -eq "$LAMBDA_COUNT" ] && [ "$FRONTEND_COUNT" -eq "$MESSAGE_COUNT" ]; then
  echo -e "  ${GREEN}✓ All counts match ($FRONTEND_COUNT languages)${NC}"
else
  echo -e "  ${RED}✗ Counts don't match${NC}"
  echo -e "    Frontend: $FRONTEND_COUNT"
  echo -e "    Lambda: $LAMBDA_COUNT"
  echo -e "    Messages: $MESSAGE_COUNT"
  ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo -e "${BLUE}============================================${NC}"
if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}✅ All language lists are synchronized${NC}"
  echo -e "${BLUE}============================================${NC}"
  exit 0
else
  echo -e "${RED}❌ Synchronization errors found: $ERRORS${NC}"
  echo ""
  echo "To fix:"
  echo "1. Update apps/web/lib/i18n/config.ts locales array"
  echo "2. Update infrastructure/lambda/shared/config/language-config.ts LANGUAGES array"
  echo "3. Ensure message directories exist for all languages"
  echo -e "${BLUE}============================================${NC}"
  exit 1
fi
