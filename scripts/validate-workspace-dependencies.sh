#!/bin/bash

# Validate Workspace Dependencies Script (v2 - Shared Library版)
# Purpose: Detect misplaced dependencies in monorepo workspaces
# Usage: bash scripts/validate-workspace-dependencies.sh

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

log_section "Validating Workspace Dependencies"

# Function to check if a package is declared in package.json
check_package_declared() {
    local workspace=$1
    local package=$2
    local package_json="$PROJECT_ROOT/$workspace/package.json"

    if [ ! -f "$package_json" ]; then
        return 1
    fi

    # Check both dependencies and devDependencies
    if jq -e ".dependencies.\"$package\" // .devDependencies.\"$package\"" "$package_json" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to extract external package imports from a file
extract_external_imports() {
    local file=$1
    grep -h "^import.*from ['\"]" "$file" 2>/dev/null | \
        sed "s/^import.*from ['\"]//;s/['\"].*$//" | \
        grep -v "^@/" | \
        grep -v "^\./" | \
        grep -v "^\.\./" | \
        grep -E "^[a-zA-Z@]" || true
}

log_step "Phase 1" "Analyzing apps/web dependencies"

# Find all TypeScript files in apps/web (excluding build artifacts)
WEB_TS_FILES=$(find "$PROJECT_ROOT/apps/web" -type f \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/.next/*" \
    ! -path "*/.next-archive/*" \
    ! -path "*/dist/*" 2>/dev/null || true)

# Extract all unique external package imports
TEMP_IMPORTS=$(mktemp)
for file in $WEB_TS_FILES; do
    extract_external_imports "$file" >> "$TEMP_IMPORTS"
done

# Get unique package names (handle scoped packages like @radix-ui/react-alert-dialog)
UNIQUE_PACKAGES=$(cat "$TEMP_IMPORTS" | sort -u)
rm -f "$TEMP_IMPORTS"

# Check each package
MISSING_IN_WEB=()
for package in $UNIQUE_PACKAGES; do
    # Extract base package name (e.g., "@radix-ui/react-alert-dialog" or "react")
    # For scoped packages, keep the full name
    # For sub-paths like "next/link", extract the base package
    base_package=$(echo "$package" | sed 's|^\(@[^/]*/[^/]*\).*|\1|; t; s|^\([^/]*\).*|\1|')

    # Skip if base_package is empty or just dots
    if [ -z "$base_package" ] || [ "$base_package" = "." ] || [ "$base_package" = ".." ]; then
        continue
    fi

    # Check if package is in apps/web/package.json
    if ! check_package_declared "apps/web" "$base_package"; then
        # Check if it's in root package.json
        if check_package_declared "." "$base_package"; then
            MISSING_IN_WEB+=("$base_package")
        fi
    fi
done

# Report missing packages
if [ ${#MISSING_IN_WEB[@]} -gt 0 ]; then
    log_error "Found packages used in apps/web but declared in root package.json:"
    for pkg in "${MISSING_IN_WEB[@]}"; do
        echo "   - $pkg"
        # Find example usage
        example=$(grep -rn "from ['\"]$pkg" "$PROJECT_ROOT/apps/web" --include="*.ts" --include="*.tsx" 2>/dev/null | head -1)
        if [ ! -z "$example" ]; then
            echo -e "${BLUE}     Example: $example${NC}"
        fi
        increment_counter ERRORS
    done
    echo ""
else
    log_success "All packages used in apps/web are properly declared"
    echo ""
fi

log_step "Phase 2" "Checking for duplicate dependencies"

# Check for packages declared in both root and workspaces
WORKSPACES=("apps/web" "infrastructure" "packages/database" "packages/shared")
ROOT_DEPS=$(jq -r '.dependencies // {} | keys[]' "$PROJECT_ROOT/package.json" 2>/dev/null | sort)

DUPLICATES=()
for workspace in "${WORKSPACES[@]}"; do
    if [ ! -f "$PROJECT_ROOT/$workspace/package.json" ]; then
        continue
    fi

    WORKSPACE_DEPS=$(jq -r '.dependencies // {} | keys[]' "$PROJECT_ROOT/$workspace/package.json" 2>/dev/null | sort)

    for dep in $WORKSPACE_DEPS; do
        if echo "$ROOT_DEPS" | grep -q "^$dep$"; then
            DUPLICATES+=("$dep (root + $workspace)")
        fi
    done
done

if [ ${#DUPLICATES[@]} -gt 0 ]; then
    log_warning "Found duplicate dependencies (declared in both root and workspace):"
    for dup in "${DUPLICATES[@]}"; do
        echo "   - $dup"
        increment_counter WARNINGS
    done
    echo ""
    log_info "Recommendation:"
    echo "   - If used by workspace, declare ONLY in workspace package.json"
    echo "   - If shared build tool, declare ONLY in root devDependencies"
    echo ""
else
    log_success "No duplicate dependencies found"
    echo ""
fi

log_step "Phase 3" "Checking infrastructure dependencies"

# Check if infrastructure uses frontend packages
INFRA_TS_FILES=$(find "$PROJECT_ROOT/infrastructure/lambda" -type f \( -name "*.ts" \) \
    ! -path "*/node_modules/*" 2>/dev/null || true)

FRONTEND_PACKAGES=("react-dom" "next" "@radix-ui" "lucide-react" "tailwindcss")
MISPLACED_INFRA=()

# Allowed exceptions: react (used by @react-pdf/renderer for server-side PDF generation)
ALLOWED_FILES=("report/generator.ts" "report/templates/")

for file in $INFRA_TS_FILES; do
    # Skip allowed files
    skip=false
    for allowed in "${ALLOWED_FILES[@]}"; do
        if [[ "$file" == *"$allowed"* ]]; then
            skip=true
            break
        fi
    done

    if [ "$skip" = true ]; then
        continue
    fi

    for pkg in "${FRONTEND_PACKAGES[@]}"; do
        if grep -q "from ['\"]$pkg" "$file" 2>/dev/null; then
            MISPLACED_INFRA+=("$pkg in $(basename $file)")
        fi
    done
done

if [ ${#MISPLACED_INFRA[@]} -gt 0 ]; then
    log_error "Found frontend packages imported in infrastructure/lambda:"
    for item in "${MISPLACED_INFRA[@]}"; do
        echo "   - $item"
        increment_counter ERRORS
    done
    echo ""
    log_info "Note: 'react' in report/generator.ts is acceptable (used by @react-pdf/renderer)"
    echo ""
else
    log_success "No misplaced frontend packages found in infrastructure"
    log_info "Note: 'react' in report/generator.ts is acceptable (used by @react-pdf/renderer)"
    echo ""
fi

# Summary
log_section "Validation Summary"
print_counter_summary

if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    log_success "All validations passed!"
    echo ""
    exit 0
else
    if [ "$ERRORS" -gt 0 ]; then
        log_error "Found $ERRORS error(s)"
    fi
    if [ "$WARNINGS" -gt 0 ]; then
        log_warning "Found $WARNINGS warning(s)"
    fi
    echo ""

    echo "🔧 Recommended actions:"
    echo ""
    echo "1. Fix misplaced dependencies:"
    echo "   cd apps/web"
    echo "   pnpm install <missing-package>"
    echo ""
    echo "2. Remove duplicate dependencies:"
    echo "   # Remove from root package.json if used in workspace"
    echo "   # Or remove from workspace if it's a shared build tool"
    echo ""
    echo "3. Run clean build:"
    echo "   pnpm run build:clean"
    echo "   pnpm run build"
    echo ""

    exit 1
fi
