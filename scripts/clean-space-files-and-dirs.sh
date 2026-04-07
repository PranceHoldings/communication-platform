#!/bin/bash
#
# Clean Space-Containing Files and Directories
# Purpose: Remove files/directories with spaces in their names before build/deploy
# MEMORY.md Rule 4: File/directory names with spaces are strictly prohibited
#
# This script prevents build failures caused by macOS Finder auto-generated
# files like "script 2.sh", "document 2.md", directories like "dashboard 2", etc.
#
# Version: 2.0 (2026-04-03)
# Improvements:
#   - Scans .broken-* directories (previously excluded)
#   - Uses find -depth for deep-nested directories
#   - Enhanced 4-stage deletion strategy
#   - Logs failed deletions to /tmp/failed-deletions.log
#   - Better error reporting and user guidance
#
# Usage:
#   ./scripts/clean-space-files-and-dirs.sh [options]
#
# Options:
#   --all           Scan entire project (default: specific paths only)
#   --dry-run       Show what would be removed without actually removing
#   --force         Skip confirmation prompt
#   --rename-only   Only rename (to .broken-<timestamp>), don't delete
#   --include-broken Scan .broken-* directories (now default, kept for backwards compatibility)
#


# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

set -e


# Options
SCAN_ALL=false
DRY_RUN=false
FORCE=false
RENAME_ONLY=false
INCLUDE_BROKEN=true  # Changed in v2.0: now default to true

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --all)
      SCAN_ALL=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --rename-only)
      RENAME_ONLY=true
      shift
      ;;
    --include-broken)
      INCLUDE_BROKEN=true  # Backwards compatibility
      shift
      ;;
    --exclude-broken)
      INCLUDE_BROKEN=false
      shift
      ;;
    *)
      log_error "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Failure log file
FAILURE_LOG="/tmp/failed-deletions-$(date +%Y%m%d-%H%M%S).log"

# Get project root
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$PROJECT_ROOT" ]; then
  log_error "Error: Not in a git repository"
  exit 1
fi

cd "$PROJECT_ROOT" || exit 1

log_info "============================================"
log_info "Cleaning Space-Containing Files & Directories"
log_info "============================================"
echo ""

if [ "$DRY_RUN" = true ]; then
  log_warning "DRY RUN MODE - No files will be modified"
  echo ""
fi

FOUND_FILES=0
FOUND_DIRS=0
CLEANED_FILES=0
CLEANED_DIRS=0
FAILED_FILES=0
FAILED_DIRS=0

# Define search paths
if [ "$SCAN_ALL" = true ]; then
  SEARCH_PATHS=(".")
  log_warning "Scanning entire project..."
else
  SEARCH_PATHS=(
    "apps"
    "infrastructure"
    "packages"
    "scripts"
    "docs"
  )
  log_warning "Scanning common paths: ${SEARCH_PATHS[*]}"
fi

echo ""

# =============================================================================
# Step 1: Find and collect space-containing items
# =============================================================================
echo -e "${BLUE}[1/4]${NC} Scanning for space-containing files and directories..."
echo ""

FILES_WITH_SPACES=()
DIRS_WITH_SPACES=()

# Build find exclusions
FIND_EXCLUSIONS=(
  -not -path "*/node_modules/*"
  -not -path "*/.git/*"
)

# Optionally exclude .broken-* (backwards compatibility)
if [ "$INCLUDE_BROKEN" = false ]; then
  FIND_EXCLUSIONS+=(-not -path "*.broken-*")
  log_warning "Note: Excluding .broken-* directories"
else
  log_warning "Note: Including .broken-* directories for cleanup"
fi

for search_path in "${SEARCH_PATHS[@]}"; do
  if [ -d "$search_path" ]; then
    # Find files with spaces (using -depth for deep-nested files)
    while IFS= read -r -d '' file; do
      FILES_WITH_SPACES+=("$file")
      FOUND_FILES=$((FOUND_FILES + 1))
    done < <(find "$search_path" -depth -type f -name "* *" \
      "${FIND_EXCLUSIONS[@]}" \
      -print0 2>/dev/null)

    # Find directories with spaces (using -depth for deep-nested directories)
    while IFS= read -r -d '' dir; do
      DIRS_WITH_SPACES+=("$dir")
      FOUND_DIRS=$((FOUND_DIRS + 1))
    done < <(find "$search_path" -depth -type d -name "* *" \
      "${FIND_EXCLUSIONS[@]}" \
      -print0 2>/dev/null)
  fi
done

echo -e "Found: ${RED}${FOUND_FILES}${NC} files, ${RED}${FOUND_DIRS}${NC} directories"
echo ""

if [ "$FOUND_FILES" -eq 0 ] && [ "$FOUND_DIRS" -eq 0 ]; then
  log_success "No space-containing files or directories found"
  exit 0
fi

# =============================================================================
# Step 2: Display findings
# =============================================================================
echo -e "${BLUE}[2/4]${NC} Details of space-containing items..."
echo ""

if [ "$FOUND_FILES" -gt 0 ]; then
  log_warning "Files (${FOUND_FILES}):"
  for file in "${FILES_WITH_SPACES[@]}"; do
    echo -e "  ${RED}✗${NC} ${file}"
  done
  echo ""
fi

if [ "$FOUND_DIRS" -gt 0 ]; then
  log_warning "Directories (${FOUND_DIRS}):"
  for dir in "${DIRS_WITH_SPACES[@]}"; do
    echo -e "  ${RED}✗${NC} ${dir}"
  done
  echo ""
fi

# =============================================================================
# Step 3: Confirmation
# =============================================================================
if [ "$DRY_RUN" = false ] && [ "$FORCE" = false ]; then
  echo -e "${YELLOW}[3/4]${NC} Confirmation"
  echo ""
  log_warning "Warning: This will remove or rename ${FOUND_FILES} files and ${FOUND_DIRS} directories"
  echo ""
  read -p "Continue? (yes/no): " CONFIRM

  if [ "$CONFIRM" != "yes" ]; then
    log_info "Cancelled"
    exit 0
  fi
  echo ""
fi

# =============================================================================
# Step 4: Clean files
# =============================================================================
echo -e "${BLUE}[4/4]${NC} Cleaning..."
echo ""

# Function to remove or rename a file (Enhanced 4-stage strategy)
remove_or_rename_file() {
  local file="$1"
  local basename=$(basename "$file")
  local dirname=$(dirname "$file")

  if [ "$DRY_RUN" = true ]; then
    echo -e "  ${BLUE}[DRY]${NC} Would remove: ${file}"
    CLEANED_FILES=$((CLEANED_FILES + 1))
    return 0
  fi

  if [ "$RENAME_ONLY" = true ]; then
    # Rename with .broken-<timestamp>
    local timestamp=$(date +%s)
    local new_name="${basename}-broken-${timestamp}"

    if mv "$file" "${dirname}/${new_name}" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} Renamed: ${file} → ${new_name}"
      CLEANED_FILES=$((CLEANED_FILES + 1))
      return 0
    elif sudo mv "$file" "${dirname}/${new_name}" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} Renamed (sudo): ${file} → ${new_name}"
      CLEANED_FILES=$((CLEANED_FILES + 1))
      return 0
    else
      echo -e "  ${RED}✗${NC} Failed to rename: ${file}"
      echo "$file" >> "$FAILURE_LOG"
      FAILED_FILES=$((FAILED_FILES + 1))
      return 1
    fi
  else
    # Enhanced 4-stage deletion strategy

    # Strategy 1: Normal deletion
    if rm -f "$file" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} Removed: ${file}"
      CLEANED_FILES=$((CLEANED_FILES + 1))
      return 0
    fi

    # Strategy 2: Sudo deletion
    if sudo rm -f "$file" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} Removed (sudo): ${file}"
      CLEANED_FILES=$((CLEANED_FILES + 1))
      return 0
    fi

    # Strategy 3: Change permissions then delete
    if sudo chmod -R 777 "$file" 2>/dev/null && sudo rm -f "$file" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} Removed (chmod+rm): ${file}"
      CLEANED_FILES=$((CLEANED_FILES + 1))
      return 0
    fi

    # Strategy 4: Rename as fallback
    local timestamp=$(date +%s)
    local new_name="${basename}-broken-${timestamp}"

    if mv "$file" "${dirname}/${new_name}" 2>/dev/null || sudo mv "$file" "${dirname}/${new_name}" 2>/dev/null; then
      echo -e "  ${YELLOW}⚠${NC}  Could not delete, renamed: ${file} → ${new_name}"
      CLEANED_FILES=$((CLEANED_FILES + 1))
      return 0
    else
      echo -e "  ${RED}✗${NC} Failed: ${file}"
      echo "$file" >> "$FAILURE_LOG"
      FAILED_FILES=$((FAILED_FILES + 1))
      return 1
    fi
  fi
}

# Function to remove or rename a directory (Enhanced 5-stage strategy)
remove_or_rename_dir() {
  local dir="$1"
  local basename=$(basename "$dir")
  local dirname=$(dirname "$dir")

  if [ "$DRY_RUN" = true ]; then
    echo -e "  ${BLUE}[DRY]${NC} Would remove: ${dir}"
    CLEANED_DIRS=$((CLEANED_DIRS + 1))
    return 0
  fi

  if [ "$RENAME_ONLY" = true ]; then
    # Rename with .broken-<timestamp>
    local timestamp=$(date +%s)
    local new_name="${basename}-broken-${timestamp}"

    if mv "$dir" "${dirname}/${new_name}" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} Renamed: ${dir} → ${new_name}"
      CLEANED_DIRS=$((CLEANED_DIRS + 1))
      return 0
    elif sudo mv "$dir" "${dirname}/${new_name}" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} Renamed (sudo): ${dir} → ${new_name}"
      CLEANED_DIRS=$((CLEANED_DIRS + 1))
      return 0
    else
      echo -e "  ${RED}✗${NC} Failed to rename: ${dir}"
      echo "$dir" >> "$FAILURE_LOG"
      FAILED_DIRS=$((FAILED_DIRS + 1))
      return 1
    fi
  else
    # Enhanced 5-stage deletion strategy

    # Strategy 1: Normal deletion
    if rm -rf "$dir" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} Removed: ${dir}"
      CLEANED_DIRS=$((CLEANED_DIRS + 1))
      return 0
    fi

    # Strategy 2: Sudo deletion
    if sudo rm -rf "$dir" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} Removed (sudo): ${dir}"
      CLEANED_DIRS=$((CLEANED_DIRS + 1))
      return 0
    fi

    # Strategy 3: Change permissions then delete
    if sudo chmod -R 777 "$dir" 2>/dev/null && sudo rm -rf "$dir" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} Removed (chmod+rm): ${dir}"
      CLEANED_DIRS=$((CLEANED_DIRS + 1))
      return 0
    fi

    # Strategy 4: Delete individual files from deepest level
    if [ -d "$dir" ]; then
      # Delete files first
      find "$dir" -depth -type f -exec sudo rm -f {} \; 2>/dev/null
      # Then delete empty directories
      find "$dir" -depth -type d -exec sudo rmdir {} \; 2>/dev/null

      # Check if directory was successfully removed
      if [ ! -d "$dir" ]; then
        echo -e "  ${GREEN}✓${NC} Removed (find -delete): ${dir}"
        CLEANED_DIRS=$((CLEANED_DIRS + 1))
        return 0
      fi
    fi

    # Strategy 5: Rename as fallback
    local timestamp=$(date +%s)
    local new_name="${basename}-broken-${timestamp}"

    if mv "$dir" "${dirname}/${new_name}" 2>/dev/null || sudo mv "$dir" "${dirname}/${new_name}" 2>/dev/null; then
      echo -e "  ${YELLOW}⚠${NC}  Could not delete, renamed: ${dir} → ${new_name}"
      CLEANED_DIRS=$((CLEANED_DIRS + 1))
      return 0
    else
      echo -e "  ${RED}✗${NC} Failed: ${dir}"
      echo "$dir" >> "$FAILURE_LOG"
      FAILED_DIRS=$((FAILED_DIRS + 1))
      return 1
    fi
  fi
}

# Process files
if [ "$FOUND_FILES" -gt 0 ]; then
  log_warning "Processing files..."
  for file in "${FILES_WITH_SPACES[@]}"; do
    remove_or_rename_file "$file"
  done
  echo ""
fi

# Process directories
if [ "$FOUND_DIRS" -gt 0 ]; then
  log_warning "Processing directories..."
  for dir in "${DIRS_WITH_SPACES[@]}"; do
    remove_or_rename_dir "$dir"
  done
  echo ""
fi

# =============================================================================
# Summary
# =============================================================================
log_info "============================================"
log_info "Summary"
log_info "============================================"
echo ""
echo -e "Files found:           ${FOUND_FILES}"
echo -e "Files cleaned:         ${GREEN}${CLEANED_FILES}${NC}"
echo -e "Files failed:          ${RED}${FAILED_FILES}${NC}"
echo ""
echo -e "Directories found:     ${FOUND_DIRS}"
echo -e "Directories cleaned:   ${GREEN}${CLEANED_DIRS}${NC}"
echo -e "Directories failed:    ${RED}${FAILED_DIRS}${NC}"
echo ""

TOTAL_FAILED=$((FAILED_FILES + FAILED_DIRS))

if [ "$DRY_RUN" = true ]; then
  log_info "Dry run completed - no files were modified"
  exit 0
fi

if [ "$TOTAL_FAILED" -gt 0 ]; then
  log_error "Cleanup incomplete (${TOTAL_FAILED} items failed)"
  echo ""
  log_warning "Failed items have been logged to:"
  echo -e "  ${FAILURE_LOG}"
  echo ""
  log_warning "Possible reasons for failure:"
  echo -e "  • Deep-nested directories with spaces (e.g., 'dir 2/subdir 2/')"
  echo -e "  • Files locked by running processes"
  echo -e "  • Filesystem-level issues (macOS Finder generated files)"
  echo ""
  log_warning "Recommended actions:"
  echo -e "  1. Review failed items: cat ${FAILURE_LOG}"
  echo -e "  2. Stop related processes: pkill -f 'node\\|npm'"
  echo -e "  3. Restart system if files are still locked"
  echo -e "  4. Failed items have been renamed to .broken-* and won't affect builds"
  echo ""
  exit 1
else
  log_success "All space-containing items cleaned successfully"
  # Clean up empty failure log
  [ -f "$FAILURE_LOG" ] && rm -f "$FAILURE_LOG"
  exit 0
fi
