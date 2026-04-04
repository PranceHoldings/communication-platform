#!/bin/bash
#
# validate-test-implementation.sh (v2 - Shared Library版)
#
# Purpose: Ensure tests are written based on actual implementation, not assumptions
# When to run: Pre-commit hook (recommended), PR checks, before writing tests
# How to run: pnpm run validate:tests
#

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

PROJECT_ROOT="$SCRIPT_DIR/.."

log_section "Validating test implementation assumptions"

# Check 1: Test files reference actual routes
log_step "1/3" "Checking route references in tests"

if [ -d "$PROJECT_ROOT/apps/web/tests" ]; then
  # Extract routes from tests (Playwright style)
  TEST_ROUTES=$(grep -rh "goto\|visit\|navigateTo" \
    "$PROJECT_ROOT/apps/web/tests" \
    --include="*.spec.ts" --include="*.test.ts" \
    2>/dev/null | grep -oP '["'"'"']/[^"'"'"'\)]+' | tr -d '"'"'" | sort -u || echo "")

  if [ -z "$TEST_ROUTES" ]; then
    log_info "No route references found in tests"
  else
    echo "Found $(echo "$TEST_ROUTES" | wc -l) unique route(s) in tests"

    for ROUTE in $TEST_ROUTES; do
      # Skip external URLs
      if [[ "$ROUTE" == http* ]] || [[ "$ROUTE" == /api/* ]]; then
        continue
      fi

      # Clean route (remove leading /)
      CLEAN_ROUTE=$(echo "$ROUTE" | sed 's|^/||' | sed 's|/$||')

      # Skip root route
      if [ -z "$CLEAN_ROUTE" ] || [ "$CLEAN_ROUTE" = "/" ]; then
        continue
      fi

      # Convert URL to file path (handle route groups and dynamic segments)
      # Example: /sessions → sessions/page.tsx
      # Example: /sessions/123 → sessions/[id]/page.tsx

      # Split into segments
      IFS='/' read -ra SEGMENTS <<< "$CLEAN_ROUTE"

      # Try to find matching page.tsx
      FOUND=false

      # Try direct path
      if [ -f "$PROJECT_ROOT/apps/web/app/${CLEAN_ROUTE}/page.tsx" ]; then
        FOUND=true
      fi

      # Try route group paths (e.g., (dashboard)/sessions)
      if [ "$FOUND" = false ]; then
        ROUTE_GROUP_PATHS=$(find "$PROJECT_ROOT/apps/web/app" -type f -name "page.tsx" | grep -v node_modules | grep -v ".next")
        for PAGE_PATH in $ROUTE_GROUP_PATHS; do
          # Extract route from file path
          # Remove app/ prefix and /page.tsx suffix
          FILE_ROUTE=$(echo "$PAGE_PATH" | sed "s|$PROJECT_ROOT/apps/web/app/||" | sed 's|/page.tsx||')

          # Remove route groups (parentheses)
          FILE_ROUTE_CLEAN=$(echo "$FILE_ROUTE" | sed 's|([^)]*)/||g')

          if [ "$FILE_ROUTE_CLEAN" = "$CLEAN_ROUTE" ]; then
            FOUND=true
            break
          fi
        done
      fi

      # Try dynamic segments (replace last segment with [id], [slug], etc.)
      if [ "$FOUND" = false ] && [ ${#SEGMENTS[@]} -gt 1 ]; then
        # Get parent path
        PARENT_PATH="${SEGMENTS[0]}"
        for ((i=1; i<${#SEGMENTS[@]}-1; i++)); do
          PARENT_PATH="${PARENT_PATH}/${SEGMENTS[i]}"
        done

        # Check for dynamic segment directories
        DYNAMIC_DIRS=$(find "$PROJECT_ROOT/apps/web/app/$PARENT_PATH" -maxdepth 1 -type d -name "[*" 2>/dev/null || echo "")
        if [ -n "$DYNAMIC_DIRS" ]; then
          FOUND=true
        fi
      fi

      if [ "$FOUND" = false ]; then
        log_warning "Test references route '$ROUTE' but no matching page.tsx found"
        echo "    Verify this route exists or is a dynamic route"
        increment_counter WARNINGS
      fi
    done

    if [ "$WARNINGS" -eq 0 ]; then
      log_success "All route references appear valid"
    fi
  fi
else
  log_info "No test directory found"
fi

# Check 2: Test files reference actual API endpoints
log_step "2/3" "Checking API endpoint references in tests"

if [ -d "$PROJECT_ROOT/apps/web/tests" ]; then
  # Extract API endpoints from tests
  TEST_APIS=$(grep -rh "fetch\|axios\|request" \
    "$PROJECT_ROOT/apps/web/tests" \
    --include="*.spec.ts" --include="*.test.ts" \
    2>/dev/null | grep -oP '["'"'"']/api/[^"'"'"'\)]+' | tr -d '"'"'" | sort -u || echo "")

  if [ -z "$TEST_APIS" ]; then
    log_info "No API endpoint references found in tests"
  else
    echo "Found $(echo "$TEST_APIS" | wc -l) unique API endpoint(s) in tests"

    for API in $TEST_APIS; do
      # Remove /api/v1/ prefix
      CLEAN_API=$(echo "$API" | sed 's|/api/v1/||')

      # Check if Lambda function exists for this endpoint
      # Convert /auth/login → auth/login
      LAMBDA_DIR="$PROJECT_ROOT/infrastructure/lambda/${CLEAN_API}"

      # Also check parent directories (for routes like /auth/login → auth/login/index.ts)
      if [ ! -d "$LAMBDA_DIR" ]; then
        # Try without last segment (e.g., /sessions/123 → sessions)
        LAMBDA_PARENT=$(echo "$CLEAN_API" | sed 's|/[^/]*$||')
        LAMBDA_DIR="$PROJECT_ROOT/infrastructure/lambda/${LAMBDA_PARENT}"
      fi

      if [ ! -d "$LAMBDA_DIR" ]; then
        log_warning "Test references API '$API' but no Lambda function found"
        echo "    Expected: infrastructure/lambda/${CLEAN_API}"
        echo "    Verify this endpoint exists or is dynamically routed"
        increment_counter WARNINGS
      fi
    done

    if [ "$WARNINGS" -eq 0 ]; then
      log_success "All API endpoint references appear valid"
    fi
  fi
else
  log_info "No test directory found"
fi

# Check 3: Test fixtures match Prisma schema (basic check)
log_step "3/3" "Checking test fixtures against Prisma schema"

if [ -d "$PROJECT_ROOT/apps/web/tests/fixtures" ]; then
  # Extract field names from test fixtures
  FIXTURE_FIELDS=$(grep -rh "^\s*[a-zA-Z]" \
    "$PROJECT_ROOT/apps/web/tests/fixtures" \
    --include="*.ts" --include="*.js" \
    2>/dev/null | grep -oP '^\s*\K\w+(?=:)' | sort -u || echo "")

  if [ -z "$FIXTURE_FIELDS" ]; then
    log_info "No fixture fields found"
  else
    echo "Found $(echo "$FIXTURE_FIELDS" | wc -l) unique field(s) in fixtures"

    # Common field names that don't exist in Prisma schema
    SUSPICIOUS_FIELDS="username imageUrl profilePicture firstName lastName"

    for FIELD in $SUSPICIOUS_FIELDS; do
      if echo "$FIXTURE_FIELDS" | grep -q "^$FIELD$"; then
        # Check if this field exists in Prisma schema
        if ! grep -q "\\b$FIELD\\b" "$PROJECT_ROOT/packages/database/prisma/schema.prisma" 2>/dev/null; then
          log_warning "Test fixture uses field '$FIELD' not found in Prisma schema"
          echo "    Verify this field exists or use correct field name"
          echo "    Common mistakes:"
          echo "      - username → email or fullName"
          echo "      - imageUrl → thumbnailUrl"
          echo "      - firstName/lastName → fullName"
          increment_counter WARNINGS
        fi
      fi
    done

    if [ "$WARNINGS" -eq 0 ]; then
      log_success "No obvious field name mismatches detected"
    fi
  fi
else
  log_info "No test fixtures directory found"
fi

# Summary
log_section "Validation Summary"

if [ "$WARNINGS" -eq 0 ]; then
  echo -e "${GREEN}✅ All test implementation validations passed${NC}"
  echo ""
  echo "Remember the principle:"
  echo "  1. Find implementation (find/grep)"
  echo "  2. Read implementation code"
  echo "  3. Understand structure"
  echo "  4. Write test"
  echo ""
  exit 0
else
  echo -e "${YELLOW}⚠️  $WARNINGS validation warning(s) detected${NC}"
  echo ""
  echo "These warnings indicate potential mismatches between"
  echo "tests and implementation. They might be false positives"
  echo "(e.g., dynamic routes, API Gateway mappings), but please"
  echo "verify each warning manually."
  echo ""
  echo "Test Writing Checklist:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Before writing any test:"
  echo "  [ ] Find actual implementation files"
  echo "  [ ] Read implementation code"
  echo "  [ ] Verify URL/endpoint paths"
  echo "  [ ] Verify request/response structure"
  echo "  [ ] Check for route groups/dynamic segments"
  echo "  [ ] Verify database schema fields"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Common Pitfalls:"
  echo "  - Next.js route groups: (dashboard)/sessions → /sessions"
  echo "  - Dynamic routes: [id]/page.tsx → /123"
  echo "  - Field names: thumbnailUrl vs imageUrl"
  echo "  - API paths: API Gateway prefix mapping"
  echo ""
  echo "Detailed principles: memory/feedback_test_implementation.md"
  exit 0  # Don't block, just warn
fi
