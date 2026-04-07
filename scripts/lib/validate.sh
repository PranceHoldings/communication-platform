#!/bin/bash
# ==============================================================================
# Validate Library - Common Validation Functions
# ==============================================================================
# Purpose: Reusable validation logic for environment, files, schemas, etc.
# Usage: source "$(dirname "$0")/lib/validate.sh"
# Dependencies: common.sh
# ==============================================================================

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# ==============================================================================
# Environment Variable Validation
# ==============================================================================

# Validate DATABASE_URL points to AWS RDS
validate_database_url() {
  local env_file=${1:-".env.local"}

  if [ ! -f "$env_file" ]; then
    log_error "Environment file not found: $env_file"
    return 1
  fi

  # Check for localhost PostgreSQL (forbidden)
  if grep -q "DATABASE_URL.*localhost:5432\|DATABASE_URL.*@localhost" "$env_file"; then
    log_error "$env_file contains localhost PostgreSQL connection"
    log_info "This project uses AWS RDS Aurora Serverless v2 only"
    grep -n "DATABASE_URL" "$env_file" | head -3
    return 1
  fi

  # Check for AWS RDS connection
  if grep -q "DATABASE_URL.*rds\.amazonaws\.com" "$env_file"; then
    log_success "$env_file: AWS RDS connection detected"
    return 0
  fi

  log_warning "$env_file: DATABASE_URL format unclear"
  return 1
}

# Validate required environment variables
validate_required_env_vars() {
  local env_file=${1:-".env.local"}
  shift
  local required_vars=("$@")

  if [ ! -f "$env_file" ]; then
    log_error "Environment file not found: $env_file"
    return 1
  fi

  local missing_vars=()

  for var in "${required_vars[@]}"; do
    if ! grep -q "^$var=" "$env_file"; then
      missing_vars+=("$var")
    fi
  done

  if [ ${#missing_vars[@]} -gt 0 ]; then
    log_error "Missing required environment variables in $env_file:"
    for var in "${missing_vars[@]}"; do
      echo "  - $var"
    done
    return 1
  fi

  log_success "All required environment variables present in $env_file"
  return 0
}

# Validate environment variables are synchronized across files
validate_env_sync() {
  local file1=${1:-".env.local"}
  local file2=${2:-"infrastructure/.env"}

  if [ ! -f "$file1" ]; then
    log_error "File not found: $file1"
    return 1
  fi

  if [ ! -f "$file2" ]; then
    log_error "File not found: $file2"
    return 1
  fi

  local mismatches=0

  # Extract common variables
  local vars1
  vars1=$(grep -E "^[A-Z_]+=" "$file1" | cut -d'=' -f1 | sort)

  for var in $vars1; do
    local val1
    local val2

    val1=$(grep "^$var=" "$file1" | cut -d'=' -f2-)
    val2=$(grep "^$var=" "$file2" | cut -d'=' -f2-)

    if [ -n "$val1" ] && [ -n "$val2" ] && [ "$val1" != "$val2" ]; then
      log_warning "Mismatch: $var"
      echo "  $file1: $val1"
      echo "  $file2: $val2"
      ((mismatches++))
    fi
  done

  if [ $mismatches -eq 0 ]; then
    log_success "Environment variables synchronized"
    return 0
  else
    log_error "Found $mismatches mismatched variables"
    return 1
  fi
}

# ==============================================================================
# File and Directory Validation
# ==============================================================================

# Validate file exists and is readable
validate_file_readable() {
  local file=$1

  if [ ! -f "$file" ]; then
    log_error "File not found: $file"
    return 1
  fi

  if [ ! -r "$file" ]; then
    log_error "File not readable: $file"
    return 1
  fi

  log_success "File is readable: $file"
  return 0
}

# Validate directory exists and is writable
validate_directory_writable() {
  local dir=$1

  if [ ! -d "$dir" ]; then
    log_error "Directory not found: $dir"
    return 1
  fi

  if [ ! -w "$dir" ]; then
    log_error "Directory not writable: $dir"
    return 1
  fi

  log_success "Directory is writable: $dir"
  return 0
}

# Validate no space-containing filenames
validate_no_space_filenames() {
  local search_dir=${1:-.}

  log_info "Checking for files with spaces in names..."

  local space_files
  space_files=$(find "$search_dir" -name "* *" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null)

  if [ -n "$space_files" ]; then
    log_error "Found files with spaces in names:"
    echo "$space_files" | while read -r file; do
      echo "  - $file"
    done
    log_info "Run: bash scripts/clean-space-files-and-dirs.sh"
    return 1
  fi

  log_success "No files with spaces in names"
  return 0
}

# ==============================================================================
# Dependency Validation
# ==============================================================================

# Validate Node.js version
validate_node_version() {
  local required_major=${1:-22}

  if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed"
    return 1
  fi

  local node_version
  node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)

  if [ "$node_version" -ne "$required_major" ]; then
    log_error "Node.js version mismatch: v$node_version (expected: v$required_major)"
    return 1
  fi

  log_success "Node.js version: v$node_version"
  return 0
}

# Validate pnpm is installed
validate_pnpm() {
  if ! command -v pnpm &> /dev/null; then
    log_error "pnpm is not installed"
    log_info "Install with: corepack enable && corepack prepare pnpm@10.32.1 --activate"
    return 1
  fi

  local pnpm_version
  pnpm_version=$(pnpm --version)
  log_success "pnpm version: $pnpm_version"
  return 0
}

# Validate npm package is installed in node_modules
validate_npm_package() {
  local package_name=$1
  local search_dir=${2:-"."}

  if [ ! -d "$search_dir/node_modules/$package_name" ]; then
    log_error "Package not installed: $package_name"
    log_info "Run: pnpm install"
    return 1
  fi

  log_success "Package installed: $package_name"
  return 0
}

# ==============================================================================
# Schema and Type Validation
# ==============================================================================

# Validate Prisma Client is generated
validate_prisma_client() {
  local prisma_dir=${1:-"packages/database"}

  if [ ! -d "$prisma_dir/node_modules/.prisma/client" ]; then
    log_error "Prisma Client not generated"
    log_info "Run: cd $prisma_dir && pnpm exec prisma generate"
    return 1
  fi

  log_success "Prisma Client generated"
  return 0
}

# Validate TypeScript types are compiled
validate_typescript_build() {
  local package_dir=$1

  if [ ! -d "$package_dir/dist" ]; then
    log_error "TypeScript not compiled: $package_dir"
    log_info "Run: cd $package_dir && pnpm run build"
    return 1
  fi

  log_success "TypeScript compiled: $package_dir"
  return 0
}

# ==============================================================================
# Language and i18n Validation
# ==============================================================================

# Validate language list synchronization
validate_language_sync() {
  local frontend_config="apps/web/lib/i18n/config.ts"
  local lambda_config="infrastructure/lambda/shared/config/language-config.ts"
  local messages_dir="apps/web/messages"

  # Extract languages from frontend config
  local frontend_langs
  frontend_langs=$(grep -A 20 "export const locales" "$frontend_config" | grep -oP "'\K[^']+" | tr '\n' ' ' | xargs)

  # Extract languages from lambda config
  local lambda_langs
  lambda_langs=$(grep -A 30 "export const LANGUAGES" "$lambda_config" | grep -oP "code: '\K[^']+" | tr '\n' ' ' | xargs)

  # Extract languages from messages directories
  local message_langs
  message_langs=$(ls -1 "$messages_dir" | tr '\n' ' ' | xargs)

  log_info "Frontend config: $frontend_langs"
  log_info "Lambda config: $lambda_langs"
  log_info "Message directories: $message_langs"

  # Compare
  if [ "$frontend_langs" != "$lambda_langs" ] || [ "$frontend_langs" != "$message_langs" ]; then
    log_error "Language lists are not synchronized"
    return 1
  fi

  log_success "All language lists are synchronized"
  return 0
}

# Validate translation key exists in all languages
validate_translation_key() {
  local key=$1
  local messages_dir="apps/web/messages"

  local missing_langs=()

  for lang_dir in "$messages_dir"/*; do
    local lang
    lang=$(basename "$lang_dir")

    local json_file="$lang_dir/common.json"
    if [ ! -f "$json_file" ]; then
      missing_langs+=("$lang (file missing)")
      continue
    fi

    if ! jq -e ".$key" "$json_file" &> /dev/null; then
      missing_langs+=("$lang")
    fi
  done

  if [ ${#missing_langs[@]} -gt 0 ]; then
    log_error "Translation key missing: $key"
    for lang in "${missing_langs[@]}"; do
      echo "  - $lang"
    done
    return 1
  fi

  log_success "Translation key exists in all languages: $key"
  return 0
}

# ==============================================================================
# Git Validation
# ==============================================================================

# Validate git working directory is clean
validate_git_clean() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    log_warning "Git working directory has uncommitted changes"
    git status --short | head -10
    return 1
  fi

  log_success "Git working directory is clean"
  return 0
}

# Validate current branch
validate_git_branch() {
  local expected_branch=$1

  local current_branch
  current_branch=$(git branch --show-current)

  if [ "$current_branch" != "$expected_branch" ]; then
    log_error "Current branch: $current_branch (expected: $expected_branch)"
    return 1
  fi

  log_success "Current branch: $current_branch"
  return 0
}

# ==============================================================================
# Lambda Function Validation
# ==============================================================================

# Validate Lambda function zip file size
validate_lambda_zip_size() {
  local zip_file=$1
  local max_size_mb=${2:-50}

  if [ ! -f "$zip_file" ]; then
    log_error "Zip file not found: $zip_file"
    return 1
  fi

  local size_mb
  size_mb=$(du -m "$zip_file" | cut -f1)

  if [ "$size_mb" -gt "$max_size_mb" ]; then
    log_error "Lambda zip too large: ${size_mb}MB (max: ${max_size_mb}MB)"
    return 1
  fi

  log_success "Lambda zip size: ${size_mb}MB"
  return 0
}

# Validate no manual Lambda zip files exist
validate_no_manual_lambda_zips() {
  local lambda_dir="infrastructure/lambda"

  local manual_zips
  manual_zips=$(find "$lambda_dir" -name "*.zip" -type f 2>/dev/null)

  if [ -n "$manual_zips" ]; then
    log_error "Manual Lambda zip files detected (forbidden):"
    echo "$manual_zips" | while read -r zip; do
      echo "  - $zip"
    done
    log_info "Lambda deployment must use CDK only"
    log_info "Run: rm infrastructure/lambda/**/*.zip"
    return 1
  fi

  log_success "No manual Lambda zip files detected"
  return 0
}

# ==============================================================================
# Export Functions
# ==============================================================================
export -f validate_database_url validate_required_env_vars validate_env_sync
export -f validate_file_readable validate_directory_writable validate_no_space_filenames
export -f validate_node_version validate_pnpm validate_npm_package
export -f validate_prisma_client validate_typescript_build
export -f validate_language_sync validate_translation_key
export -f validate_git_clean validate_git_branch
export -f validate_lambda_zip_size validate_no_manual_lambda_zips
