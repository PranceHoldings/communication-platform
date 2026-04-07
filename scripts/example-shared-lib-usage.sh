#!/bin/bash
# ==============================================================================
# Example Script - Shared Library Usage Demo
# ==============================================================================
# Purpose: Demonstrate usage of scripts/lib/ shared libraries
# Usage: bash scripts/example-shared-lib-usage.sh
# ==============================================================================

# Source shared libraries
source "$(dirname "$0")/lib/common.sh"
source "$(dirname "$0")/lib/validate.sh"
source "$(dirname "$0")/lib/aws.sh"

# ==============================================================================
# Main Script
# ==============================================================================

log_section "Shared Library Usage Demo"

# ==============================================================================
# Step 1: Environment Validation
# ==============================================================================
log_step 1 "Validating Environment"

validate_node_version 22
validate_pnpm

# ==============================================================================
# Step 2: File Validation
# ==============================================================================
log_step 2 "Validating Files"

validate_file_readable ".env.local"
validate_file_readable "package.json"
validate_directory_writable "scripts"

# ==============================================================================
# Step 3: Database Validation
# ==============================================================================
log_step 3 "Validating Database Configuration"

validate_database_url ".env.local"

# ==============================================================================
# Step 4: AWS Prerequisites (optional)
# ==============================================================================
log_step 4 "Checking AWS Prerequisites (optional)"

if check_aws_prerequisites; then
  log_success "AWS CLI configured"

  # Get account info
  account_id=$(get_account_id)
  region=$(get_current_region)

  log_info "Account ID: $account_id"
  log_info "Region: $region"

  # List Lambda functions (first 5)
  log_info "Lambda functions (prefix: prance-):"
  list_lambda_functions "prance-" | head -5
else
  log_warning "AWS CLI not configured (skipping AWS checks)"
fi

# ==============================================================================
# Step 5: Confirmation Demo
# ==============================================================================
log_step 5 "Interactive Confirmation Demo"

if confirm "Do you want to see a success message?"; then
  log_success "User confirmed!"
else
  log_info "User declined"
fi

# ==============================================================================
# Summary
# ==============================================================================
log_section "Summary"

print_counter_summary
