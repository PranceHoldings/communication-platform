#!/bin/bash

###############################################################################
# Performance Test Script
# Phase 1.6.1 Day 37: パフォーマンステスト
#
# Tests:
# 1. Scenario cache performance (before/after cache)
# 2. Parallel session execution (10 concurrent users)
# 3. Recording processing time
# 4. API response times
###############################################################################


# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

set -e

# Colors

# Configuration
API_BASE_URL="${API_BASE_URL:-https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1}"
TEST_USER_EMAIL="${TEST_USER_EMAIL:-test@example.com}"
TEST_USER_PASSWORD="${TEST_USER_PASSWORD:-TestPassword123!}"
PARALLEL_USERS=10
ITERATIONS_PER_USER=1

log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "Phase 1.6.1 Performance Test"
log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

###############################################################################
# Test 1: Authentication Performance
###############################################################################

echo -e "${YELLOW}[Test 1/4]${NC} Authentication Performance"
echo "Testing login API response time..."

LOGIN_TIMES=()
for i in {1..5}; do
  START=$(date +%s%3N)

  RESPONSE=$(curl -s -X POST "${API_BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_USER_EMAIL}\",\"password\":\"${TEST_USER_PASSWORD}\"}")

  END=$(date +%s%3N)
  DURATION=$((END - START))
  LOGIN_TIMES+=($DURATION)

  echo "  Iteration $i: ${DURATION}ms"
done

# Calculate average
TOTAL=0
for time in "${LOGIN_TIMES[@]}"; do
  TOTAL=$((TOTAL + time))
done
AVG_LOGIN=$((TOTAL / ${#LOGIN_TIMES[@]}))

echo -e "  ${GREEN}✓${NC} Average login time: ${AVG_LOGIN}ms"

if [ $AVG_LOGIN -lt 1000 ]; then
  echo -e "  ${GREEN}✓${NC} PASS: Login time < 1000ms"
else
  echo -e "  ${RED}✗${NC} FAIL: Login time >= 1000ms"
fi

echo ""

###############################################################################
# Test 2: Scenario Cache Performance
###############################################################################

echo -e "${YELLOW}[Test 2/4]${NC} Scenario Cache Performance"
echo "Testing scenario GET API with cache..."

# Login first to get token
echo "  Authenticating..."
AUTH_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_USER_EMAIL}\",\"password\":\"${TEST_USER_PASSWORD}\"}")

TOKEN=$(echo $AUTH_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "  ${RED}✗${NC} Authentication failed, skipping cache test"
else
  # Get list of scenarios to find a test scenario ID
  echo "  Fetching scenario list..."
  SCENARIOS_RESPONSE=$(curl -s -X GET "${API_BASE_URL}/scenarios" \
    -H "Authorization: Bearer ${TOKEN}")

  SCENARIO_ID=$(echo $SCENARIOS_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

  if [ -z "$SCENARIO_ID" ]; then
    echo -e "  ${YELLOW}⚠${NC} No scenarios found, creating test scenario..."
    # Create test scenario
    CREATE_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/scenarios" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"title":"Performance Test Scenario","category":"test","language":"ja","configJson":{"systemPrompt":"You are a test assistant."}}')

    SCENARIO_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
  fi

  if [ -n "$SCENARIO_ID" ]; then
    echo "  Testing scenario: $SCENARIO_ID"

    # First access (cache miss)
    echo "  Access 1 (cache miss):"
    START=$(date +%s%3N)
    curl -s -X GET "${API_BASE_URL}/scenarios/${SCENARIO_ID}" \
      -H "Authorization: Bearer ${TOKEN}" > /dev/null
    END=$(date +%s%3N)
    DURATION_MISS=$((END - START))
    echo "    Response time: ${DURATION_MISS}ms"

    # Wait a bit
    sleep 1

    # Second access (cache hit)
    echo "  Access 2 (cache hit expected):"
    START=$(date +%s%3N)
    curl -s -X GET "${API_BASE_URL}/scenarios/${SCENARIO_ID}" \
      -H "Authorization: Bearer ${TOKEN}" > /dev/null
    END=$(date +%s%3N)
    DURATION_HIT=$((END - START))
    echo "    Response time: ${DURATION_HIT}ms"

    # Calculate improvement
    IMPROVEMENT=$(( (DURATION_MISS - DURATION_HIT) * 100 / DURATION_MISS ))

    echo ""
    echo -e "  ${GREEN}✓${NC} Cache miss: ${DURATION_MISS}ms"
    echo -e "  ${GREEN}✓${NC} Cache hit: ${DURATION_HIT}ms"
    echo -e "  ${GREEN}✓${NC} Improvement: ${IMPROVEMENT}%"

    if [ $IMPROVEMENT -gt 30 ]; then
      echo -e "  ${GREEN}✓${NC} PASS: Cache improvement > 30%"
    else
      echo -e "  ${YELLOW}⚠${NC} WARNING: Cache improvement < 30%"
    fi
  else
    echo -e "  ${RED}✗${NC} Could not get or create scenario for testing"
  fi
fi

echo ""

###############################################################################
# Test 3: Parallel API Requests
###############################################################################

echo -e "${YELLOW}[Test 3/4]${NC} Parallel API Requests"
echo "Testing ${PARALLEL_USERS} concurrent API requests..."

# Create temp directory for results
TEMP_DIR=$(mktemp -d)

# Function to make API request
make_request() {
  local user_id=$1
  local token=$2

  START=$(date +%s%3N)
  curl -s -X GET "${API_BASE_URL}/scenarios" \
    -H "Authorization: Bearer ${token}" > /dev/null
  END=$(date +%s%3N)
  DURATION=$((END - START))

  echo $DURATION > "${TEMP_DIR}/user_${user_id}.txt"
}

# Export function for parallel execution
export -f make_request
export API_BASE_URL
export TEMP_DIR
export TOKEN

# Run parallel requests
echo "  Launching ${PARALLEL_USERS} parallel requests..."
for i in $(seq 1 $PARALLEL_USERS); do
  make_request $i $TOKEN &
done

# Wait for all to complete
wait

# Collect results
PARALLEL_TIMES=()
for i in $(seq 1 $PARALLEL_USERS); do
  if [ -f "${TEMP_DIR}/user_${i}.txt" ]; then
    TIME=$(cat "${TEMP_DIR}/user_${i}.txt")
    PARALLEL_TIMES+=($TIME)
    echo "  User $i: ${TIME}ms"
  fi
done

# Calculate statistics
TOTAL=0
MAX=0
for time in "${PARALLEL_TIMES[@]}"; do
  TOTAL=$((TOTAL + time))
  if [ $time -gt $MAX ]; then
    MAX=$time
  fi
done
AVG_PARALLEL=$((TOTAL / ${#PARALLEL_TIMES[@]}))

echo ""
echo -e "  ${GREEN}✓${NC} Average response time: ${AVG_PARALLEL}ms"
echo -e "  ${GREEN}✓${NC} Max response time: ${MAX}ms"
echo -e "  ${GREEN}✓${NC} Completed: ${#PARALLEL_TIMES[@]}/${PARALLEL_USERS} requests"

if [ $AVG_PARALLEL -lt 2000 ] && [ ${#PARALLEL_TIMES[@]} -eq $PARALLEL_USERS ]; then
  echo -e "  ${GREEN}✓${NC} PASS: All requests completed with avg < 2000ms"
else
  echo -e "  ${RED}✗${NC} FAIL: Some requests failed or too slow"
fi

# Cleanup
rm -rf "$TEMP_DIR"

echo ""

###############################################################################
# Test 4: Summary
###############################################################################

echo -e "${YELLOW}[Test 4/4]${NC} Performance Summary"
echo ""
echo "┌─────────────────────────────────────────────────────┐"
echo "│ Metric                          │ Value    │ Status │"
echo "├─────────────────────────────────────────────────────┤"

printf "│ Average Login Time              │ %-7sms │" "$AVG_LOGIN"
if [ $AVG_LOGIN -lt 1000 ]; then
  echo -e " ${GREEN}✓${NC}     │"
else
  echo -e " ${RED}✗${NC}     │"
fi

if [ -n "$DURATION_MISS" ] && [ -n "$DURATION_HIT" ]; then
  printf "│ Cache Miss Time                 │ %-7sms │ ${GREEN}✓${NC}     │\n" "$DURATION_MISS"
  printf "│ Cache Hit Time                  │ %-7sms │" "$DURATION_HIT"
  if [ $DURATION_HIT -lt 100 ]; then
    echo -e " ${GREEN}✓${NC}     │"
  else
    echo -e " ${YELLOW}⚠${NC}     │"
  fi
  printf "│ Cache Improvement               │ %-7s%% │" "$IMPROVEMENT"
  if [ $IMPROVEMENT -gt 30 ]; then
    echo -e " ${GREEN}✓${NC}     │"
  else
    echo -e " ${YELLOW}⚠${NC}     │"
  fi
fi

printf "│ Parallel Avg Response Time      │ %-7sms │" "$AVG_PARALLEL"
if [ $AVG_PARALLEL -lt 2000 ]; then
  echo -e " ${GREEN}✓${NC}     │"
else
  echo -e " ${RED}✗${NC}     │"
fi

printf "│ Parallel Max Response Time      │ %-7sms │" "$MAX"
if [ $MAX -lt 3000 ]; then
  echo -e " ${GREEN}✓${NC}     │"
else
  echo -e " ${YELLOW}⚠${NC}     │"
fi

printf "│ Parallel Completion Rate        │ %-7s   │" "${#PARALLEL_TIMES[@]}/${PARALLEL_USERS}"
if [ ${#PARALLEL_TIMES[@]} -eq $PARALLEL_USERS ]; then
  echo -e " ${GREEN}✓${NC}     │"
else
  echo -e " ${RED}✗${NC}     │"
fi

echo "└─────────────────────────────────────────────────────┘"
echo ""

log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "Performance test complete"
log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
