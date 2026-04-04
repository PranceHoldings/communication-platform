#!/bin/bash
#
# API E2E Test Generator
#
# Automatically generates E2E tests for all API endpoints.
# Validates response structure for every endpoint.
#
# Usage:
#   bash scripts/generate-api-e2e-tests.sh
#

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

OUTPUT_DIR="apps/web/tests/e2e/api-validation"
LAMBDA_DIR="infrastructure/lambda"

echo ""
log_info "🔧 Generating API E2E Tests..."
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# ============================================================
# Discover all API endpoints from Lambda functions
# ============================================================
log_info "Discovering API endpoints..."

ENDPOINTS=()
ENDPOINT_HANDLERS=()

# Find all Lambda handler index.ts files (excluding shared/)
while IFS= read -r handler; do
  # Extract endpoint path from directory structure
  # Example: infrastructure/lambda/scenarios/list/index.ts -> /scenarios (LIST)
  dir=$(dirname "$handler")
  relative_path=${dir#infrastructure/lambda/}

  # Skip shared modules
  if [[ "$relative_path" == shared* ]]; then
    continue
  fi

  # Parse endpoint name
  IFS='/' read -ra PARTS <<< "$relative_path"
  resource="${PARTS[0]}"
  action="${PARTS[1]:-list}"

  # Map action to HTTP method
  case "$action" in
    list|get)
      method="GET"
      ;;
    create)
      method="POST"
      ;;
    update)
      method="PUT"
      ;;
    delete)
      method="DELETE"
      ;;
    *)
      method="GET"
      ;;
  esac

  # Build endpoint path
  if [ "$action" = "list" ]; then
    endpoint="/$resource"
  elif [ "$action" = "get" ]; then
    endpoint="/$resource/:id"
  else
    endpoint="/$resource"
  fi

  ENDPOINTS+=("$method $endpoint")
  ENDPOINT_HANDLERS+=("$handler")
done < <(find "$LAMBDA_DIR" -name "index.ts" -type f | grep -v "/shared/" | sort)

log_success "Found ${#ENDPOINTS[@]} endpoints"
echo ""

# ============================================================
# Generate Playwright test file
# ============================================================
log_info "Generating test file..."

cat > "$OUTPUT_DIR/api-response-structure.spec.ts" << 'EOF'
import { test, expect } from '@playwright/test';

/**
 * API Response Structure Validation Tests
 * Auto-generated from Lambda functions
 */

// Helper: Validate standard API response structure
function validateResponseStructure(data: any, endpoint: string) {
  // Success response should have 'data' field
  if (data.data !== undefined) {
    expect(data).toHaveProperty('data');
    return;
  }

  // Error response should have 'error' field
  if (data.error !== undefined) {
    expect(data).toHaveProperty('error');
    expect(data.error).toHaveProperty('message');
    return;
  }

  // Pagination response
  if (data.items !== undefined && data.pagination !== undefined) {
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('pagination');
    expect(data.pagination).toHaveProperty('total');
    expect(data.pagination).toHaveProperty('page');
    expect(data.pagination).toHaveProperty('limit');
    return;
  }

  throw new Error(`Invalid response structure for ${endpoint}: ${JSON.stringify(data)}`);
}

test.describe('API Response Structure Validation', () => {
EOF

# Add test for each endpoint
for i in "${!ENDPOINTS[@]}"; do
  endpoint="${ENDPOINTS[$i]}"
  method=$(echo "$endpoint" | awk '{print $1}')
  path=$(echo "$endpoint" | awk '{print $2}')

  # Generate test case
  cat >> "$OUTPUT_DIR/api-response-structure.spec.ts" << EOF
  test('$method $path - should return valid structure', async ({ request }) => {
    const response = await request.$method('$path', {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    validateResponseStructure(data, '$method $path');
  });
EOF
done

# Close test file
cat >> "$OUTPUT_DIR/api-response-structure.spec.ts" << 'EOF'
});
EOF

log_success "Test file generated: $OUTPUT_DIR/api-response-structure.spec.ts"
echo ""
echo "Run tests:"
echo "  pnpm run test:e2e -- api-validation/"
echo ""
