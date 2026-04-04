#!/bin/bash
# ==============================================================================
# AWS Library - AWS CLI Wrappers and Utilities
# ==============================================================================
# Purpose: Standardize AWS API calls with error handling and retry logic
# Usage: source "$(dirname "$0")/lib/aws.sh"
# Dependencies: common.sh, aws-cli, jq
# ==============================================================================

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# ==============================================================================
# AWS Configuration
# ==============================================================================
export AWS_DEFAULT_REGION="${AWS_REGION:-us-east-1}"
export AWS_MAX_RETRIES="${AWS_MAX_RETRIES:-3}"
export AWS_RETRY_DELAY="${AWS_RETRY_DELAY:-2}"

# ==============================================================================
# Prerequisites Check
# ==============================================================================
check_aws_prerequisites() {
  require_command "aws" "curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip' && unzip awscliv2.zip && sudo ./aws/install"
  require_command "jq" "sudo apt-get install jq"

  # Check AWS credentials
  if ! aws sts get-caller-identity &> /dev/null; then
    log_error "AWS credentials not configured"
    log_info "Run: aws configure"
    return 1
  fi

  log_success "AWS CLI configured"
  return 0
}

# ==============================================================================
# Lambda Functions
# ==============================================================================

# Invoke Lambda function with retry
invoke_lambda() {
  local function_name=$1
  local payload=${2:-"{}"}
  local max_retries=${3:-$AWS_MAX_RETRIES}

  local attempt=1
  while [ $attempt -le $max_retries ]; do
    log_debug "Invoking Lambda: $function_name (attempt $attempt/$max_retries)"

    local response
    response=$(aws lambda invoke \
      --function-name "$function_name" \
      --payload "$payload" \
      --cli-binary-format raw-in-base64-out \
      --output json \
      /dev/stdout 2>&1 | head -n -1)

    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
      echo "$response"
      return 0
    fi

    if [ $attempt -lt $max_retries ]; then
      log_retry "$attempt" "$max_retries" "Lambda invocation failed"
      sleep $AWS_RETRY_DELAY
    fi

    ((attempt++))
  done

  log_error "Lambda invocation failed after $max_retries attempts"
  return 1
}

# Get Lambda function configuration
get_lambda_config() {
  local function_name=$1

  aws lambda get-function-configuration \
    --function-name "$function_name" \
    --output json 2>/dev/null
}

# List Lambda functions by prefix
list_lambda_functions() {
  local prefix=${1:-"prance-"}

  aws lambda list-functions \
    --output json \
    --query "Functions[?starts_with(FunctionName, '$prefix')].{Name:FunctionName,Runtime:Runtime,Memory:MemorySize,Timeout:Timeout}" \
    | jq -r '.[] | "\(.Name) (\(.Runtime), \(.Memory)MB, \(.Timeout)s)"'
}

# Check if Lambda function exists
lambda_function_exists() {
  local function_name=$1

  aws lambda get-function --function-name "$function_name" &> /dev/null
  return $?
}

# ==============================================================================
# S3 Functions
# ==============================================================================

# Upload file to S3 with retry
s3_upload() {
  local local_file=$1
  local s3_path=$2
  local max_retries=${3:-$AWS_MAX_RETRIES}

  require_file "$local_file"

  local attempt=1
  while [ $attempt -le $max_retries ]; do
    log_debug "Uploading to S3: $s3_path (attempt $attempt/$max_retries)"

    if aws s3 cp "$local_file" "$s3_path" --quiet; then
      log_success "Uploaded: $s3_path"
      return 0
    fi

    if [ $attempt -lt $max_retries ]; then
      log_retry "$attempt" "$max_retries" "S3 upload failed"
      sleep $AWS_RETRY_DELAY
    fi

    ((attempt++))
  done

  log_error "S3 upload failed after $max_retries attempts"
  return 1
}

# Download file from S3
s3_download() {
  local s3_path=$1
  local local_file=$2

  log_debug "Downloading from S3: $s3_path"

  if aws s3 cp "$s3_path" "$local_file" --quiet; then
    log_success "Downloaded: $local_file"
    return 0
  fi

  log_error "S3 download failed: $s3_path"
  return 1
}

# Delete S3 object
s3_delete() {
  local s3_path=$1

  log_debug "Deleting from S3: $s3_path"

  if aws s3 rm "$s3_path" --quiet; then
    log_success "Deleted: $s3_path"
    return 0
  fi

  log_error "S3 delete failed: $s3_path"
  return 1
}

# Check if S3 object exists
s3_object_exists() {
  local s3_path=$1

  aws s3 ls "$s3_path" &> /dev/null
  return $?
}

# List S3 objects with prefix
s3_list() {
  local s3_bucket=$1
  local prefix=${2:-""}

  aws s3 ls "s3://$s3_bucket/$prefix" --recursive
}

# ==============================================================================
# API Gateway Functions
# ==============================================================================

# Get API Gateway REST API ID by name
get_rest_api_id() {
  local api_name=$1

  aws apigateway get-rest-apis \
    --query "items[?name=='$api_name'].id" \
    --output text 2>/dev/null
}

# Get API Gateway WebSocket API ID by name
get_websocket_api_id() {
  local api_name=$1

  aws apigatewayv2 get-apis \
    --query "Items[?Name=='$api_name'].ApiId" \
    --output text 2>/dev/null
}

# Test API endpoint
test_api_endpoint() {
  local endpoint=$1
  local method=${2:-"GET"}
  local data=${3:-""}

  log_debug "Testing API: $method $endpoint"

  local response
  if [ -n "$data" ]; then
    response=$(curl -s -X "$method" -H "Content-Type: application/json" -d "$data" "$endpoint")
  else
    response=$(curl -s -X "$method" "$endpoint")
  fi

  local exit_code=$?

  if [ $exit_code -eq 0 ]; then
    echo "$response"
    return 0
  fi

  log_error "API request failed: $endpoint"
  return 1
}

# ==============================================================================
# DynamoDB Functions
# ==============================================================================

# Get item from DynamoDB
dynamodb_get_item() {
  local table_name=$1
  local key=$2

  aws dynamodb get-item \
    --table-name "$table_name" \
    --key "$key" \
    --output json 2>/dev/null
}

# Put item to DynamoDB
dynamodb_put_item() {
  local table_name=$1
  local item=$2

  aws dynamodb put-item \
    --table-name "$table_name" \
    --item "$item" \
    --output json 2>/dev/null
}

# Check if DynamoDB table exists
dynamodb_table_exists() {
  local table_name=$1

  aws dynamodb describe-table --table-name "$table_name" &> /dev/null
  return $?
}

# ==============================================================================
# CloudWatch Functions
# ==============================================================================

# Get CloudWatch log streams
get_log_streams() {
  local log_group=$1
  local limit=${2:-10}

  aws logs describe-log-streams \
    --log-group-name "$log_group" \
    --order-by LastEventTime \
    --descending \
    --max-items "$limit" \
    --query "logStreams[*].logStreamName" \
    --output text 2>/dev/null
}

# Get CloudWatch log events
get_log_events() {
  local log_group=$1
  local log_stream=$2
  local limit=${3:-100}

  aws logs get-log-events \
    --log-group-name "$log_group" \
    --log-stream-name "$log_stream" \
    --limit "$limit" \
    --output json 2>/dev/null \
    | jq -r '.events[].message'
}

# Tail CloudWatch logs
tail_cloudwatch_logs() {
  local log_group=$1
  local filter_pattern=${2:-""}

  log_info "Tailing logs from: $log_group"

  if [ -n "$filter_pattern" ]; then
    aws logs tail "$log_group" --filter-pattern "$filter_pattern" --follow
  else
    aws logs tail "$log_group" --follow
  fi
}

# ==============================================================================
# RDS Functions
# ==============================================================================

# Get RDS cluster endpoint
get_rds_cluster_endpoint() {
  local cluster_id=$1
  local endpoint_type=${2:-"writer"}  # writer or reader

  if [ "$endpoint_type" = "writer" ]; then
    aws rds describe-db-clusters \
      --db-cluster-identifier "$cluster_id" \
      --query "DBClusters[0].Endpoint" \
      --output text 2>/dev/null
  else
    aws rds describe-db-clusters \
      --db-cluster-identifier "$cluster_id" \
      --query "DBClusters[0].ReaderEndpoint" \
      --output text 2>/dev/null
  fi
}

# Check if RDS cluster is available
rds_cluster_is_available() {
  local cluster_id=$1

  local status
  status=$(aws rds describe-db-clusters \
    --db-cluster-identifier "$cluster_id" \
    --query "DBClusters[0].Status" \
    --output text 2>/dev/null)

  [ "$status" = "available" ]
  return $?
}

# ==============================================================================
# Secrets Manager Functions
# ==============================================================================

# Get secret value
get_secret() {
  local secret_name=$1

  aws secretsmanager get-secret-value \
    --secret-id "$secret_name" \
    --query "SecretString" \
    --output text 2>/dev/null
}

# ==============================================================================
# Utility Functions
# ==============================================================================

# Get AWS account ID
get_account_id() {
  aws sts get-caller-identity --query "Account" --output text 2>/dev/null
}

# Get current AWS region
get_current_region() {
  aws configure get region 2>/dev/null || echo "us-east-1"
}

# Check if AWS resource exists by ARN
resource_exists_by_arn() {
  local arn=$1

  aws resourcegroupstaggingapi get-resources \
    --resource-arn-list "$arn" \
    --query "ResourceTagMappingList[0].ResourceARN" \
    --output text &> /dev/null

  return $?
}

# ==============================================================================
# Export Functions
# ==============================================================================
export -f check_aws_prerequisites
export -f invoke_lambda get_lambda_config list_lambda_functions lambda_function_exists
export -f s3_upload s3_download s3_delete s3_object_exists s3_list
export -f get_rest_api_id get_websocket_api_id test_api_endpoint
export -f dynamodb_get_item dynamodb_put_item dynamodb_table_exists
export -f get_log_streams get_log_events tail_cloudwatch_logs
export -f get_rds_cluster_endpoint rds_cluster_is_available
export -f get_secret get_account_id get_current_region resource_exists_by_arn
