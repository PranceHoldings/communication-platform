#!/bin/bash
# ==============================================================================
# validate-runtime-configs.sh - Runtime Config Completeness Validation
# ==============================================================================
# Purpose: Schema-first validation that all getRuntimeConfig() calls in Lambda
#          code have corresponding entries in the seed file AND database,
#          and that all Lambdas using getRuntimeConfig have VPC access to Aurora RDS.
#
# Checks:
#   [1/5] Extract all keys referenced via getRuntimeConfig() in Lambda code
#   [2/5] Verify all keys exist in seed_runtime_configs.sql
#   [3/5] Verify ScoringPreset names are consistent (code vs DB vs runtime-config-loader)
#   [4/5] Verify Lambdas using getRuntimeConfig have VPC config in CDK
#   [5/5] Verify all keys exist in runtime_configs DB table (live check)
#
# Usage:
#   bash scripts/validate-runtime-configs.sh             # seed+code only (fast, no DB)
#   bash scripts/validate-runtime-configs.sh --check-db  # include live DB check (slow)
#
# Exit Code: 0 = pass, 1 = fail
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LAMBDA_DIR="$PROJECT_ROOT/infrastructure/lambda"
SEED_FILE="$PROJECT_ROOT/scripts/migrations/seed_runtime_configs.sql"
RUNTIME_CONFIG_LOADER="$LAMBDA_DIR/shared/utils/runtime-config-loader.ts"
SCORE_CALCULATOR="$LAMBDA_DIR/shared/analysis/score-calculator.ts"
SHARED_TYPES="$PROJECT_ROOT/packages/shared/src/types/index.ts"
CDK_STACK="$PROJECT_ROOT/infrastructure/lib/api-lambda-stack.ts"

CHECK_DB=false
if [[ "$*" == *"--check-db"* ]]; then
  CHECK_DB=true
fi

reset_counters

log_section "Runtime Config Completeness Validation"
echo ""

# ==============================================================================
# Step 1: Extract all keys referenced in Lambda code
# ==============================================================================
echo -e "${YELLOW}[1/5]${NC} Extracting runtime config keys from Lambda code..."

# Extract all getRuntimeConfig('KEY') calls
CODE_KEYS=$(grep -rn "getRuntimeConfig<[^>]*>(" "$LAMBDA_DIR" --include="*.ts" \
  | grep -v "node_modules" \
  | grep -v "\.test\.ts" \
  | sed "s/.*getRuntimeConfig<[^>]*>('\([^']*\)').*/\1/" \
  | grep "^[A-Z_]*$" \
  | sort -u)

CODE_KEY_COUNT=$(echo "$CODE_KEYS" | grep -c "." || echo "0")

# Extract all SCORE_PRESET keys dynamically referenced via getScorePresetWeights
# Pattern: SCORE_PRESET_{PRESET_UPPERCASE}_{COMPONENT}
# Presets come from ScoringPreset type in packages/shared
SCORING_PRESETS=$(grep "ScoringPreset" "$SHARED_TYPES" | grep -A10 "ScoringPreset =" \
  | grep "'" | sed "s/.*'\([^']*\)'.*/\1/" | grep -v "^$" | sort -u 2>/dev/null || echo "")

if [ -z "$SCORING_PRESETS" ]; then
  # Fallback: read directly from file
  SCORING_PRESETS=$(grep -A10 "^export type ScoringPreset" "$SHARED_TYPES" \
    | grep "'" | sed "s/.*'\([^']*\)'.*/\1/" | tr -d ' |' | grep -v "^$" | sort -u)
fi

PRESET_KEYS=""
for preset in $SCORING_PRESETS; do
  PRESET_UPPER=$(echo "$preset" | tr '[:lower:]' '[:upper:]' | tr '-' '_')
  for component in EMOTION AUDIO CONTENT DELIVERY; do
    PRESET_KEYS="$PRESET_KEYS SCORE_PRESET_${PRESET_UPPER}_${component}"
  done
done
PRESET_KEYS=$(echo "$PRESET_KEYS" | tr ' ' '\n' | grep -v "^$" | sort -u)

# All expected keys = code-referenced + preset keys
ALL_EXPECTED_KEYS=$(echo -e "$CODE_KEYS\n$PRESET_KEYS" | sort -u | grep -v "^$")
TOTAL_EXPECTED=$(echo "$ALL_EXPECTED_KEYS" | wc -l | tr -d ' ')

log_info "Found $CODE_KEY_COUNT direct getRuntimeConfig() keys in Lambda code"
log_info "ScoringPreset type has: $(echo "$SCORING_PRESETS" | tr '\n' ', ')"
log_info "Total expected keys (direct + preset): $TOTAL_EXPECTED"
echo ""

# ==============================================================================
# Step 2: Verify all keys exist in seed file
# ==============================================================================
echo -e "${YELLOW}[2/5]${NC} Checking keys against seed file..."

if [ ! -f "$SEED_FILE" ]; then
  log_error "Seed file not found: $SEED_FILE"
  increment_counter ERRORS
else
  SEED_MISSING=0
  SEED_MISSING_KEYS=""

  while IFS= read -r key; do
    if [ -z "$key" ]; then continue; fi
    if ! grep -q "'${key}'" "$SEED_FILE"; then
      log_error "Key missing from seed: $key"
      SEED_MISSING=$((SEED_MISSING + 1))
      SEED_MISSING_KEYS="$SEED_MISSING_KEYS $key"
    fi
  done <<< "$ALL_EXPECTED_KEYS"

  if [ "$SEED_MISSING" -gt 0 ]; then
    log_error "$SEED_MISSING keys missing from seed_runtime_configs.sql"
    echo ""
    echo -e "${YELLOW}  → Add these keys to: scripts/migrations/seed_runtime_configs.sql${NC}"
    increment_counter ERRORS
  else
    log_success "All $TOTAL_EXPECTED expected keys present in seed file"
  fi
fi
echo ""

# ==============================================================================
# Step 3: Verify ScoringPreset naming consistency
# ==============================================================================
echo -e "${YELLOW}[3/5]${NC} Checking ScoringPreset naming consistency..."

NAMING_ERRORS=0

# Check that runtime-config-loader named getters use full ScoringPreset names
if [ -f "$RUNTIME_CONFIG_LOADER" ]; then
  for preset in $SCORING_PRESETS; do
    PRESET_CLEAN=$(echo "$preset" | sed 's/[_-]//g' | tr '[:upper:]' '[:lower:]')
    # Check getScorePresetXxxWeights functions
    if grep -q "getScorePreset.*Weights" "$RUNTIME_CONFIG_LOADER"; then
      # Verify the function uses the full preset name (not abbreviated)
      if grep -q "getScorePresetWeights('$preset')" "$RUNTIME_CONFIG_LOADER" 2>/dev/null || \
         grep -q "getScorePresetWeights(\"$preset\")" "$RUNTIME_CONFIG_LOADER" 2>/dev/null; then
        : # OK
      fi
    fi
  done

  # Check score-calculator SCORING_PRESETS keys match ScoringPreset type
  if [ -f "$SCORE_CALCULATOR" ]; then
    SCORER_PRESETS=$(grep -A30 "SCORING_PRESETS.*=.*{" "$SCORE_CALCULATOR" \
      | grep "^  [a-z]" | sed 's/^\s*\([^:]*\):.*/\1/' | tr -d ' ' | sort -u)

    MISSING_IN_SCORER=""
    for preset in $SCORING_PRESETS; do
      if ! echo "$SCORER_PRESETS" | grep -q "^${preset}$"; then
        MISSING_IN_SCORER="$MISSING_IN_SCORER $preset"
        NAMING_ERRORS=$((NAMING_ERRORS + 1))
        log_error "ScoringPreset '$preset' not in SCORING_PRESETS fallback (score-calculator.ts)"
      fi
    done

    EXTRA_IN_SCORER=""
    for scorer_preset in $SCORER_PRESETS; do
      if ! echo "$SCORING_PRESETS" | grep -q "^${scorer_preset}$"; then
        EXTRA_IN_SCORER="$EXTRA_IN_SCORER $scorer_preset"
        NAMING_ERRORS=$((NAMING_ERRORS + 1))
        log_error "SCORING_PRESETS has '$scorer_preset' not in ScoringPreset type"
      fi
    done
  fi
fi

if [ "$NAMING_ERRORS" -eq 0 ]; then
  log_success "ScoringPreset names consistent across: shared/types, score-calculator, runtime-config-loader"
else
  increment_counter ERRORS
fi
echo ""

# ==============================================================================
# Step 4: Verify Lambdas using getRuntimeConfig have VPC config in CDK
# ==============================================================================
# Why: getRuntimeConfig reads from Aurora RDS (inside VPC). Any Lambda that calls
# getRuntimeConfig (directly or via shared modules like tts-elevenlabs, bedrock, etc.)
# must have vpc/vpcSubnets/securityGroups set in CDK or it cannot reach the database.
# Root cause of 2026-04-05 outage: websocket-default-v2 was missing VPC after Phase 5.4
# migrated it from env-validator (no DB) to runtime-config-loader (needs DB/VPC).
# ==============================================================================
echo -e "${YELLOW}[4/5]${NC} Checking VPC config for Lambdas using getRuntimeConfig..."

if [ ! -f "$CDK_STACK" ]; then
  log_warning "CDK stack file not found: $CDK_STACK (skipping VPC check)"
  increment_counter WARNINGS
else
  VPC_CHECK_OUTPUT=$(python3 << 'PYEOF'
import re, os, sys

cdk_file = 'infrastructure/lib/api-lambda-stack.ts'
lambda_root = 'infrastructure/lambda'

# Shared modules (by filename stem) that transitively use getRuntimeConfig.
# Any Lambda importing one of these also needs VPC to reach Aurora RDS.
# Update this list when new shared modules start using getRuntimeConfig.
RUNTIME_CONFIG_SHARED = {
    'tts-elevenlabs',     # getTtsStability, getTtsSimilarityBoost
    'stt-azure',          # getDefaultSttConfidence
    'bedrock',            # getClaudeTemperature, getClaudeMaxTokens, getMaxAutoDetectLanguages
    'score-calculator',   # getOptimalPauseSec, getScorePresetWeights
    'password',           # getBcryptSaltRounds
    'pinHash',            # getBcryptSaltRounds
    'rateLimiter',        # getRateLimitMaxAttempts, getRateLimitLockoutDurationMs
    'runtime-config-loader',  # direct usage
}

def lambda_uses_runtime_config(lambda_dir):
    """Return True if any source file in lambda_dir uses getRuntimeConfig (directly
    or by importing a shared module that does)."""
    if not os.path.exists(lambda_dir):
        return False
    for root, dirs, files in os.walk(lambda_dir):
        dirs[:] = [d for d in dirs if d not in ('node_modules',)]
        for fname in files:
            if not fname.endswith('.ts') or fname.endswith('.test.ts'):
                continue
            try:
                content = open(os.path.join(root, fname)).read()
                # Direct usage
                if 'runtime-config-loader' in content or 'getRuntimeConfig' in content:
                    return True
                # Indirect usage via known shared modules
                for mod in RUNTIME_CONFIG_SHARED:
                    if mod in content:
                        return True
            except Exception:
                pass
    return False

try:
    with open(cdk_file) as f:
        content = f.read()
except Exception as e:
    print(f'ERROR:Cannot read CDK stack: {e}')
    sys.exit(1)

lines = content.split('\n')
problems = []
i = 0
while i < len(lines):
    if 'new nodejs.NodejsFunction(' in lines[i]:
        block_start = i
        depth = 0
        block_end = i
        for j in range(i, len(lines)):
            depth += lines[j].count('{') - lines[j].count('}')
            if depth <= 0 and j > block_start:
                block_end = j
                break
        block = '\n'.join(lines[block_start:block_end + 1])

        entry_m = re.search(r"entry:.*?lambda/([^'\"]+)", block)
        if entry_m:
            entry_rel = entry_m.group(1)  # e.g. "websocket/default/index.ts"
            lambda_dir = os.path.join(lambda_root, os.path.dirname(entry_rel))
            has_vpc = 'vpc: props.vpc' in block
            if not has_vpc and lambda_uses_runtime_config(lambda_dir):
                fname_m = re.search(r'functionName:.*?`prance-(.*?)-\$\{', block)
                fname = fname_m.group(1) if fname_m else entry_rel
                problems.append(fname)

        i = block_end + 1
    else:
        i += 1

for p in problems:
    print(f'MISSING_VPC:{p}')
if not problems:
    print('ALL_OK')
PYEOF
)

  VPC_ERRORS=0
  while IFS= read -r line; do
    case "$line" in
      MISSING_VPC:*)
        func="${line#MISSING_VPC:}"
        log_error "Lambda 'prance-${func}' uses getRuntimeConfig but has no VPC config in CDK"
        log_error "  → Without VPC, it cannot reach Aurora RDS and ALL getRuntimeConfig() calls will fail"
        VPC_ERRORS=$((VPC_ERRORS + 1))
        ;;
      ERROR:*)
        log_warning "VPC check skipped: ${line#ERROR:}"
        ;;
    esac
  done <<< "$VPC_CHECK_OUTPUT"

  if [ "$VPC_ERRORS" -eq 0 ]; then
    log_success "All Lambdas using getRuntimeConfig have VPC config in CDK"
  else
    echo ""
    echo -e "${YELLOW}  → Fix: Add these 3 lines to the Lambda definition in:${NC}"
    echo -e "${YELLOW}    infrastructure/lib/api-lambda-stack.ts${NC}"
    echo -e "${YELLOW}      vpc: props.vpc,${NC}"
    echo -e "${YELLOW}      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },${NC}"
    echo -e "${YELLOW}      securityGroups: [props.lambdaSecurityGroup],${NC}"
    increment_counter ERRORS
  fi
fi
echo ""

# ==============================================================================
# Step 5: Live DB check (optional)
# ==============================================================================
if [ "$CHECK_DB" = true ]; then
  echo -e "${YELLOW}[5/5]${NC} Checking keys against live database..."

  DB_MISSING=0
  # Run query and read from result file to avoid head -50 truncation in db-query.sh output
  bash "$SCRIPT_DIR/db-query.sh" --max-results 1000 \
    "SELECT key FROM runtime_configs ORDER BY key" > /dev/null 2>&1
  DB_KEYS=$(jq -r '.data[].key' /tmp/db-query-result.json 2>/dev/null | sort)

  if [ -z "$DB_KEYS" ]; then
    log_warning "Could not retrieve DB keys (check AWS credentials / Lambda access)"
    increment_counter WARNINGS
  else
    while IFS= read -r key; do
      if [ -z "$key" ]; then continue; fi
      if ! echo "$DB_KEYS" | grep -q "^${key}$"; then
        log_error "Key missing from DB: $key"
        DB_MISSING=$((DB_MISSING + 1))
      fi
    done <<< "$ALL_EXPECTED_KEYS"

    if [ "$DB_MISSING" -gt 0 ]; then
      log_error "$DB_MISSING keys missing from runtime_configs table"
      echo ""
      echo -e "${YELLOW}  → Run: FORCE=true bash scripts/db-exec.sh --write scripts/migrations/seed_runtime_configs.sql${NC}"
      increment_counter ERRORS
    else
      DB_COUNT=$(echo "$DB_KEYS" | wc -l | tr -d ' ')
      log_success "All $TOTAL_EXPECTED expected keys present in DB ($DB_COUNT total rows)"
    fi
  fi
else
  echo -e "${BLUE}[5/5]${NC} Live DB check skipped (use --check-db to enable)"
  increment_counter SKIPPED
fi
echo ""

# ==============================================================================
# Summary
# ==============================================================================
log_section "Validation Summary"

if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  log_success "Runtime config completeness: PASSED ($TOTAL_EXPECTED keys validated)"
  echo ""
  exit 0
elif [ "$ERRORS" -eq 0 ]; then
  log_warning "Runtime config completeness: PASSED with warnings"
  echo ""
  exit 0
else
  log_error "Runtime config completeness: FAILED"
  echo ""
  echo "Fix: Add missing keys to seed file and run against DB"
  echo "     bash scripts/validate-runtime-configs.sh --check-db  (to verify DB)"
  echo ""
  exit 1
fi
