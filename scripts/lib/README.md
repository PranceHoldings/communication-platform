# Shared Script Library

**Purpose:** Centralize common functions to eliminate duplication across 80+ scripts in the `scripts/` directory.

**Benefits:**
- **DRY Principle:** Single source of truth for common functions
- **Consistency:** Standardized logging, error handling, and validation
- **Maintainability:** Update once, apply everywhere
- **Reduced Code:** Eliminate ~200 lines of duplicated code per script

---

## 📚 Library Files

### 1. common.sh - Core Utilities

**Purpose:** Colors, logging, error handling, counters

**Features:**
- Color definitions (RED, GREEN, YELLOW, BLUE, etc.)
- Logging functions (log_success, log_error, log_warning, log_info, log_step)
- Counter management (PASSED, FAILED, ERRORS, WARNINGS)
- Error handling (die, require_command, require_file, require_env)
- Utility functions (confirm, print_separator, get_script_dir)

**Usage:**
```bash
#!/bin/bash
source "$(dirname "$0")/lib/common.sh"

# Logging
log_success "Operation completed"
log_error "Something went wrong"
log_warning "Potential issue detected"
log_info "FYI: this is informational"
log_step 1 "Checking prerequisites"

# Error handling
require_command "jq" "sudo apt-get install jq"
require_file ".env.local" "Copy from .env.example"
require_env "DATABASE_URL" "Set in .env.local"

# Counters
increment_counter PASSED
print_counter_summary  # Shows total PASSED, FAILED, ERRORS, WARNINGS
```

### 2. aws.sh - AWS CLI Wrappers

**Purpose:** Standardize AWS API calls with retry logic and error handling

**Features:**
- Lambda: invoke_lambda, get_lambda_config, list_lambda_functions
- S3: s3_upload, s3_download, s3_delete, s3_list
- API Gateway: get_rest_api_id, test_api_endpoint
- DynamoDB: dynamodb_get_item, dynamodb_put_item
- CloudWatch: get_log_streams, tail_cloudwatch_logs
- RDS: get_rds_cluster_endpoint, rds_cluster_is_available
- Secrets Manager: get_secret
- Utilities: get_account_id, get_current_region

**Usage:**
```bash
#!/bin/bash
source "$(dirname "$0")/lib/common.sh"
source "$(dirname "$0")/lib/aws.sh"

# Check prerequisites
check_aws_prerequisites || exit 1

# Invoke Lambda with retry
response=$(invoke_lambda "prance-db-query-dev" '{"query":"SELECT 1"}')

# Upload to S3
s3_upload "local-file.txt" "s3://bucket/path/file.txt"

# Get secret
secret=$(get_secret "prance/production/database-password")

# Tail CloudWatch logs
tail_cloudwatch_logs "/aws/lambda/prance-auth-dev" "ERROR"
```

### 3. validate.sh - Validation Functions

**Purpose:** Reusable validation logic for environment, files, schemas, etc.

**Features:**
- Environment: validate_database_url, validate_required_env_vars, validate_env_sync
- Files: validate_file_readable, validate_directory_writable, validate_no_space_filenames
- Dependencies: validate_node_version, validate_pnpm, validate_npm_package
- Schemas: validate_prisma_client, validate_typescript_build
- i18n: validate_language_sync, validate_translation_key
- Git: validate_git_clean, validate_git_branch
- Lambda: validate_lambda_zip_size, validate_no_manual_lambda_zips

**Usage:**
```bash
#!/bin/bash
source "$(dirname "$0")/lib/common.sh"
source "$(dirname "$0")/lib/validate.sh"

# Validate environment
validate_database_url ".env.local"
validate_required_env_vars ".env.local" DATABASE_URL AWS_REGION NODE_ENV

# Validate dependencies
validate_node_version 22
validate_pnpm
validate_npm_package "@prisma/client"

# Validate files
validate_no_space_filenames "apps/web"

# Validate schema
validate_prisma_client "packages/database"

# Validate git
validate_git_clean
validate_git_branch "main"
```

### 4. logging.sh - Structured Logging

**Purpose:** Advanced logging with levels, timestamps, and JSON output

**Features:**
- Log levels: DEBUG, INFO, WARN, ERROR
- Output formats: text (colored) or JSON
- File logging with rotation
- Performance logging
- Progress logging
- Operation lifecycle logging (start/success/failure)

**Usage:**
```bash
#!/bin/bash
source "$(dirname "$0")/lib/common.sh"
source "$(dirname "$0")/lib/logging.sh"

# Configure logging
set_log_level "DEBUG"
enable_file_logging "/tmp/my-script.log"

# Structured logging
log_operation_start "deployment" "Deploying to production"

start=$(start_timer)
# ... do work ...
duration=$(elapsed_time $start)

log_operation_success "deployment" "$duration"
log_performance "deployment" "$duration" "seconds"

# Progress logging
for i in {1..100}; do
  log_progress $i 100 "files"
  # ... process file ...
done
```

---

## 🎯 Migration Guide

### Before (Duplicated Code)

```bash
#!/bin/bash
set -e

# Colors (duplicated in 57 scripts)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Counters (duplicated in 40+ scripts)
PASSED=0
FAILED=0

# Logging functions (duplicated in 30+ scripts)
log_success() {
  echo -e "${GREEN}✅ $1${NC}"
  ((PASSED++))
}

log_error() {
  echo -e "${RED}❌ $1${NC}" >&2
  ((FAILED++))
}

# ... rest of script ...
```

### After (Using Shared Library)

```bash
#!/bin/bash
source "$(dirname "$0")/lib/common.sh"

# All colors, counters, and logging functions available
log_success "Operation completed"
log_error "Something went wrong"

# ... rest of script ...

# Print summary at end
print_counter_summary
```

**Lines Saved:** ~50-200 lines per script

---

## 📖 Example Scripts

### Example 1: Simple Validation Script

```bash
#!/bin/bash
# validate-environment-simple.sh

source "$(dirname "$0")/lib/common.sh"
source "$(dirname "$0")/lib/validate.sh"

log_section "Environment Validation"

validate_node_version 22
validate_pnpm
validate_database_url ".env.local"
validate_prisma_client "packages/database"

print_counter_summary
```

### Example 2: AWS Lambda Deployment Script

```bash
#!/bin/bash
# deploy-lambda-simple.sh

source "$(dirname "$0")/lib/common.sh"
source "$(dirname "$0")/lib/aws.sh"
source "$(dirname "$0")/lib/validate.sh"

FUNCTION_NAME=${1:-}

if [ -z "$FUNCTION_NAME" ]; then
  die "Usage: $0 <function-name>"
fi

log_section "Lambda Deployment"

# Validate
check_aws_prerequisites || exit 1
validate_no_manual_lambda_zips

# Check if function exists
if lambda_function_exists "$FUNCTION_NAME"; then
  log_success "Function exists: $FUNCTION_NAME"
else
  die "Function not found: $FUNCTION_NAME"
fi

# Get current config
config=$(get_lambda_config "$FUNCTION_NAME")
runtime=$(echo "$config" | jq -r '.Runtime')
memory=$(echo "$config" | jq -r '.MemorySize')

log_info "Runtime: $runtime, Memory: ${memory}MB"

print_counter_summary
```

### Example 3: Database Query Script with Logging

```bash
#!/bin/bash
# db-query-simple.sh

source "$(dirname "$0")/lib/common.sh"
source "$(dirname "$0")/lib/aws.sh"
source "$(dirname "$0")/lib/logging.sh"

QUERY=${1:-}

if [ -z "$QUERY" ]; then
  die "Usage: $0 <sql-query>"
fi

log_section "Database Query Execution"

# Configure logging
enable_file_logging "/tmp/db-query.log"

log_operation_start "query" "$QUERY"

start=$(start_timer)

# Execute query via Lambda
payload=$(jq -n --arg query "$QUERY" '{query: $query}')
response=$(invoke_lambda "prance-db-query-dev" "$payload")

duration=$(elapsed_time $start)

if [ $? -eq 0 ]; then
  log_operation_success "query" "$duration"
  echo "$response" | jq .
else
  log_operation_failure "query" "Lambda invocation failed"
  exit 1
fi

log_performance "query" "$duration" "seconds"
print_counter_summary
```

---

## 🔄 Migration Checklist

When migrating existing scripts to use shared library:

1. **Add source statements at top:**
   ```bash
   source "$(dirname "$0")/lib/common.sh"
   source "$(dirname "$0")/lib/validate.sh"  # if needed
   source "$(dirname "$0")/lib/aws.sh"       # if needed
   source "$(dirname "$0")/lib/logging.sh"   # if needed
   ```

2. **Remove duplicated code:**
   - Delete color definitions (RED, GREEN, YELLOW, NC)
   - Delete counter initialization (PASSED=0, FAILED=0)
   - Delete custom log_success/log_error functions

3. **Replace custom functions:**
   - `echo -e "${GREEN}✅ $msg${NC}"` → `log_success "$msg"`
   - `echo -e "${RED}❌ $msg${NC}" >&2` → `log_error "$msg"`
   - `((PASSED++))` → handled by `log_success`
   - Custom error checks → `require_command`, `require_file`, `require_env`

4. **Use validation helpers:**
   - Replace custom validation with `validate_*` functions
   - Use `confirm` for user prompts
   - Use `die` for fatal errors

5. **Add summary at end:**
   ```bash
   print_counter_summary
   ```

6. **Test the script:**
   ```bash
   bash -n script.sh  # Syntax check
   bash script.sh     # Run
   ```

---

## 📊 Impact Metrics

**Before Shared Library:**
- 57 scripts with duplicated color definitions
- 40+ scripts with duplicated counter logic
- 30+ scripts with duplicated logging functions
- Average script size: 300-500 lines (including boilerplate)

**After Shared Library:**
- 0 scripts with duplicated color definitions
- 0 scripts with duplicated counter logic
- 0 scripts with duplicated logging functions
- Average script size: 100-300 lines (focused on core logic)

**Reduction:**
- ~50-200 lines of boilerplate per script
- Total reduction: ~8,000-12,000 lines across 80 scripts
- Maintenance burden: 80 places → 4 library files

---

## 🛠️ Development Guidelines

### Adding New Functions

1. **Identify duplicated code** across multiple scripts
2. **Extract to appropriate library:**
   - General utilities → `common.sh`
   - AWS-specific → `aws.sh`
   - Validation logic → `validate.sh`
   - Advanced logging → `logging.sh`
3. **Document in this README**
4. **Update example scripts**
5. **Migrate existing scripts** gradually

### Testing Library Changes

```bash
# Syntax check all libraries
for lib in scripts/lib/*.sh; do
  bash -n "$lib" && echo "✅ $lib" || echo "❌ $lib"
done

# Test sourcing
bash -c "source scripts/lib/common.sh && log_success 'Test passed'"
bash -c "source scripts/lib/aws.sh && get_account_id"
bash -c "source scripts/lib/validate.sh && validate_node_version 22"
bash -c "source scripts/lib/logging.sh && log_info_v2 'Test passed'"
```

---

## 📚 Related Documentation

- [scripts/CLAUDE.md](../CLAUDE.md) - Scripts directory guide
- [../CODING_RULES.md](../../CODING_RULES.md) - Project coding rules
- [../docs/07-development/](../../docs/07-development/) - Development guides

---

**Created:** 2026-04-04
**Phase:** 2 - Script Consolidation
**Status:** ✅ Active
