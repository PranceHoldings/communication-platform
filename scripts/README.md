# Scripts Directory

**Purpose:** Development and operations scripts for the Prance Communication Platform

**Parent Document:** [../CLAUDE.md](../CLAUDE.md)  
**Detailed Guide:** [CLAUDE.md](CLAUDE.md)  
**Script Registry:** [REGISTRY.json](REGISTRY.json)  
**Shared Library:** [lib/README.md](lib/README.md)

---

## 📋 Quick Navigation

- [Getting Started](#getting-started)
- [Common Workflows](#common-workflows)
- [Script Categories](#script-categories)
- [Shared Library](#shared-library)
- [Script Registry](#script-registry)
- [Troubleshooting](#troubleshooting)

---

## 🚀 Getting Started

### Prerequisites

```bash
# Required tools
node --version    # v22.x
pnpm --version    # 10.32.1+
aws --version     # AWS CLI v2
jq --version      # 1.6+
git --version     # 2.x+

# Optional tools
shellcheck --version  # For script validation
```

### Environment Setup

```bash
# 1. Verify environment
bash scripts/verify-environment.sh

# 2. Validate environment variables
bash scripts/validate-env.sh

# 3. Check AWS credentials
aws sts get-caller-identity
```

---

## 🔄 Common Workflows

### 1. Starting a New Session

```bash
# Step 1: Verify environment
bash scripts/verify-environment.sh

# Step 2: Pull latest changes
git pull origin dev

# Step 3: Install dependencies
pnpm install

# Step 4: Validate environment variables
bash scripts/validate-env.sh

# Step 5: Start development server
pnpm run dev
```

### 2. Before Committing Changes

```bash
# Step 1: Run all validations
pnpm run pre-commit

# Step 2: Check for space-containing files
bash scripts/clean-space-files-and-dirs.sh --dry-run

# Step 3: Validate language sync (if i18n changes)
bash scripts/validate-language-sync.sh

# Step 4: Commit
git add .
git commit -m "feat: your message"
git push
```

### 3. Deploying to Development

```bash
# Option A: Full deployment with validation
cd infrastructure
bash scripts/build-and-deploy.sh dev

# Option B: CDK-only deployment
cd infrastructure
pnpm run deploy:dev

# Option C: Lambda-only deployment (if no CDK changes)
cd infrastructure
pnpm run deploy:lambda
```

### 4. Database Operations

```bash
# Query database (read-only)
bash scripts/db-query.sh "SELECT id, title FROM scenarios LIMIT 5"

# Query from file
bash scripts/db-query.sh --file scripts/queries/verification.sql

# Write operation (requires --write flag)
bash scripts/db-query.sh --write "UPDATE scenarios SET title='New' WHERE id='xxx'"

# Large query via S3
bash scripts/db-exec.sh scripts/queries/large-migration.sql
```

### 5. Cleaning Up Filesystem

```bash
# Find space-containing files (dry-run)
bash scripts/clean-space-files-and-dirs.sh --dry-run

# Clean space-containing files
bash scripts/clean-space-files-and-dirs.sh

# Clean .broken-* directories
bash scripts/cleanup-broken-files.sh --all --aggressive
```

---

## 📚 Script Categories

### Validation Scripts (15 scripts)

**Purpose:** Verify environment, dependencies, schemas, and configuration

| Script | Description | Usage |
|--------|-------------|-------|
| `validate-env.sh` | Validate environment variables | `bash scripts/validate-env.sh` |
| `validate-env-v2.sh` | Validate environment (shared lib) | `bash scripts/validate-env-v2.sh` |
| `validate-lambda-dependencies.sh` | Validate Lambda dependencies | `bash scripts/validate-lambda-dependencies.sh <function>` |
| `validate-language-sync.sh` | Validate i18n language sync | `bash scripts/validate-language-sync.sh` |
| `validate-ui-settings-sync.sh` | Validate UI settings sync | `bash scripts/validate-ui-settings-sync.sh` |
| `validate-workspace-dependencies.sh` | Validate monorepo dependencies | `bash scripts/validate-workspace-dependencies.sh` |
| `validate-deployment-method.sh` | Check for manual Lambda zips | `bash scripts/validate-deployment-method.sh` |

**Common Options:**
- Most validation scripts have no options
- Exit code 0 = success, 1 = failure
- Output includes colored status messages

### Database Scripts (5 scripts)

**Purpose:** Query and manage Aurora RDS database via Lambda

| Script | Description | Usage |
|--------|-------------|-------|
| `db-query.sh` | Execute SQL (direct mode) | `bash scripts/db-query.sh [options] <query>` |
| `db-exec.sh` | Execute SQL (S3 mode) | `bash scripts/db-exec.sh [--write] <file>` |
| `seed-missing-configs.ts` | Seed runtime configs | `pnpm exec ts-node scripts/seed-missing-configs.ts` |

**Options for db-query.sh:**
- `--write` - Allow write operations (INSERT/UPDATE/DELETE)
- `--file FILE` - Read query from file
- `--max-results N` - Limit results (default: 1000)
- `--env ENV` - Environment (dev/staging/production)

**Examples:**
```bash
# Simple SELECT
bash scripts/db-query.sh "SELECT * FROM users WHERE role='CLIENT_ADMIN' LIMIT 10"

# With max results
bash scripts/db-query.sh --max-results 50 "SELECT * FROM sessions ORDER BY created_at DESC"

# From file (read-only)
bash scripts/db-query.sh --file scripts/queries/list-scenarios.sql

# Write operation
bash scripts/db-query.sh --write "UPDATE scenarios SET enabled=true WHERE id='xxx'"
```

### Deployment Scripts (10 scripts)

**Purpose:** Deploy infrastructure and Lambda functions

| Script | Description | Usage |
|--------|-------------|-------|
| `build-and-deploy.sh` | Full build + deploy | `bash scripts/build-and-deploy.sh <env>` |
| `deploy.sh` | CDK deploy | `cd infrastructure && bash deploy.sh <env>` |
| `clean-deploy.sh` | Clean + deploy | `cd infrastructure && bash clean-deploy.sh <env>` |
| `build-lambda-functions.sh` | Build Lambda only | `bash scripts/build-lambda-functions.sh` |

**Deployment Checklist:**
1. ✅ Validate environment variables
2. ✅ Check for manual Lambda zips (should be none)
3. ✅ Run CDK diff to preview changes
4. ✅ Deploy with CDK
5. ✅ Verify deployment success

### Cleanup Scripts (5 scripts)

**Purpose:** Clean up filesystem, build artifacts, and temporary files

| Script | Description | Usage |
|--------|-------------|-------|
| `clean-space-files-and-dirs.sh` | Remove space-containing files (v2.0) | `bash scripts/clean-space-files-and-dirs.sh [options]` |
| `cleanup-broken-files.sh` | Delete .broken-* directories (v2.0) | `bash scripts/cleanup-broken-files.sh [options]` |
| `clean-build.sh` | Clean build artifacts | `bash scripts/clean-build.sh` |

**Options for clean-space-files-and-dirs.sh:**
- `--dry-run` - Show what would be deleted
- `--force` - Skip confirmation prompts
- `--all` - Scan entire project
- `--rename-only` - Rename instead of delete
- `--exclude-broken` - Skip .broken-* directories

**Options for cleanup-broken-files.sh:**
- `--all` - Delete all .broken-* (not just 7+ days old)
- `--force` - Skip confirmation prompts
- `--aggressive` - Use enhanced deletion strategies

**Examples:**
```bash
# Preview cleanup (safe)
bash scripts/clean-space-files-and-dirs.sh --dry-run

# Clean with confirmation
bash scripts/clean-space-files-and-dirs.sh

# Full cleanup (no confirmation)
bash scripts/clean-space-files-and-dirs.sh --force --all

# Clean .broken-* directories
bash scripts/cleanup-broken-files.sh --all --aggressive --force
```

### Monitoring Scripts (5 scripts)

**Purpose:** Monitor logs, health, and performance

| Script | Description | Usage |
|--------|-------------|-------|
| `watch-logs.sh` | Tail CloudWatch logs | `bash scripts/watch-logs.sh <log-group> [filter]` |
| `health-check.sh` | System health check | `bash scripts/health-check.sh <env>` |

**Examples:**
```bash
# Tail Lambda logs
bash scripts/watch-logs.sh /aws/lambda/prance-auth-dev

# Filter for errors only
bash scripts/watch-logs.sh /aws/lambda/prance-auth-dev ERROR

# Health check
bash scripts/health-check.sh dev
```

---

## 🔧 Shared Library

**Location:** `scripts/lib/`  
**Documentation:** [lib/README.md](lib/README.md)

### Quick Start

```bash
#!/bin/bash
# Source shared libraries
source "$(dirname "$0")/lib/common.sh"
source "$(dirname "$0")/lib/validate.sh"
source "$(dirname "$0")/lib/aws.sh"

# Use functions
log_success "Operation completed"
validate_database_url ".env.local"
invoke_lambda "function-name" '{"key":"value"}'
```

### Available Libraries

1. **common.sh** - Colors, logging, error handling, counters
2. **aws.sh** - AWS CLI wrappers (Lambda, S3, DynamoDB, etc.)
3. **validate.sh** - Validation functions (env, files, schemas)
4. **logging.sh** - Structured logging with JSON support

### Benefits

- ✅ Eliminates ~1,228 lines of duplicated code
- ✅ Consistent logging across all scripts
- ✅ Automatic retry logic for AWS operations
- ✅ Standardized validation interfaces

---

## 📖 Script Registry

**File:** [REGISTRY.json](REGISTRY.json)

The script registry contains metadata for all scripts:

- Name, path, category
- Description and usage
- Tags and dependencies
- Help flag status
- Shared library usage
- Last updated date
- Maintainer

**Example:**
```json
{
  "name": "validate-env-v2.sh",
  "category": "validation",
  "description": "Validate environment variables using shared library",
  "usage": "bash scripts/validate-env-v2.sh",
  "usesSharedLib": true,
  "dependencies": ["scripts/lib/common.sh", "scripts/lib/validate.sh"]
}
```

**Querying the Registry:**
```bash
# List all validation scripts
jq '.scripts[] | select(.category=="validation") | .name' scripts/REGISTRY.json

# Find scripts using shared library
jq '.scripts[] | select(.usesSharedLib==true) | .name' scripts/REGISTRY.json

# Get script details
jq '.scripts[] | select(.name=="db-query.sh")' scripts/REGISTRY.json
```

---

## 🛠️ Troubleshooting

### Common Issues

#### 1. Permission Denied

**Problem:** `bash: scripts/xxx.sh: Permission denied`

**Solution:**
```bash
chmod +x scripts/xxx.sh
```

#### 2. Command Not Found

**Problem:** `xxx: command not found`

**Solution:**
```bash
# Install missing dependencies
which aws || curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
which jq || sudo apt-get install jq
which pnpm || corepack enable && corepack prepare pnpm@10.32.1 --activate
```

#### 3. AWS Credentials Not Configured

**Problem:** `Unable to locate credentials`

**Solution:**
```bash
# Configure AWS credentials
aws configure

# Or use environment variables
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export AWS_REGION="us-east-1"

# Verify
aws sts get-caller-identity
```

#### 4. Database Connection Failed

**Problem:** `Could not connect to database`

**Solution:**
```bash
# Check DATABASE_URL in .env.local
grep DATABASE_URL .env.local

# Validate environment
bash scripts/validate-env.sh

# Ensure using AWS RDS (not localhost)
```

#### 5. Lambda Invocation Failed

**Problem:** `Error invoking Lambda function`

**Solution:**
```bash
# Check function exists
aws lambda list-functions --query "Functions[?contains(FunctionName, 'prance-')].FunctionName"

# Check function configuration
aws lambda get-function-configuration --function-name <function-name>

# Check CloudWatch logs
bash scripts/watch-logs.sh /aws/lambda/<function-name>
```

#### 6. Space-Containing Files

**Problem:** `sed: Resource deadlock avoided`

**Solution:**
```bash
# Find and clean space-containing files
bash scripts/clean-space-files-and-dirs.sh --dry-run
bash scripts/clean-space-files-and-dirs.sh
```

#### 7. Shared Library Not Found

**Problem:** `scripts/lib/common.sh: No such file or directory`

**Solution:**
```bash
# Check library exists
ls scripts/lib/

# Ensure sourcing from correct path
source "$(dirname "$0")/lib/common.sh"

# Not: source "scripts/lib/common.sh" (won't work from subdirectories)
```

### Debug Mode

Enable debug output for troubleshooting:

```bash
# Bash debug mode
bash -x scripts/xxx.sh

# Shared library debug mode
DEBUG=true bash scripts/example-shared-lib-usage.sh

# AWS CLI debug
export AWS_DEBUG=true
bash scripts/xxx.sh
```

---

## 📝 Best Practices

### Script Development

1. **Use shared library** - Avoid duplicating code
2. **Add --help flag** - Document usage inline
3. **Validate prerequisites** - Check for required commands
4. **Handle errors gracefully** - Use die, require_command, etc.
5. **Use colors consistently** - log_success, log_error, log_warning
6. **Test before commit** - Run bash -n to check syntax

### Script Testing

```bash
# Syntax check
bash -n scripts/new-script.sh

# Static analysis
shellcheck scripts/new-script.sh

# Dry-run mode (if supported)
bash scripts/new-script.sh --dry-run

# Debug mode
bash -x scripts/new-script.sh
```

### Contributing

1. Create script in `scripts/` directory
2. Add executable permission: `chmod +x scripts/new-script.sh`
3. Add entry to `REGISTRY.json`
4. Document in `CLAUDE.md` (if user-facing)
5. Add usage examples to this README
6. Test thoroughly
7. Commit with descriptive message

---

## 🔗 Related Documentation

- [scripts/CLAUDE.md](CLAUDE.md) - Detailed scripts guide
- [scripts/lib/README.md](lib/README.md) - Shared library documentation
- [scripts/REGISTRY.json](REGISTRY.json) - Script metadata
- [../CODING_RULES.md](../CODING_RULES.md) - Project coding rules
- [../docs/07-development/](../docs/07-development/) - Development guides

---

## 📊 Statistics

**Total Scripts:** 80+  
**Categories:** 9 (validation, deployment, database, cleanup, monitoring, testing, utilities, aws, i18n)  
**Using Shared Library:** 1 (1.25%)  
**With --help Flag:** 0 (0%)  
**Target Migration:** 60 scripts (75%)

**Last Updated:** 2026-04-04  
**Maintainer:** DevOps Team
