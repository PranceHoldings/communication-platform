#!/bin/bash
# Get JWT authentication token for performance testing
#
# Usage:
#   ./scripts/get-auth-token.sh
#   export AUTH_TOKEN=$(./scripts/get-auth-token.sh)

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1}"
EMAIL="${AUTH_EMAIL:-admin@prance.com}"
PASSWORD="${AUTH_PASSWORD:-Admin2026!Prance}"

# Login and get access token
echo -e "${YELLOW}Authenticating...${NC}" >&2

RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

# Extract access token
ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.data.tokens.accessToken // .accessToken // empty')

if [[ -z "$ACCESS_TOKEN" ]] || [[ "$ACCESS_TOKEN" == "null" ]]; then
  echo -e "${RED}Error: Failed to get access token${NC}" >&2
  echo -e "Response: $RESPONSE" >&2
  exit 1
fi

echo -e "${GREEN}✓ Authentication successful${NC}" >&2
echo "$ACCESS_TOKEN"
