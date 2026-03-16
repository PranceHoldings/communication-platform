# Production Readiness Status

**Generated:** 2026-03-16 23:45 JST
**Environment:** dev (Production infrastructure not yet deployed)

---

## 📊 Infrastructure Status Overview

### ✅ Deployed & Configured (8/13)

| Component | Status | Details |
|-----------|--------|---------|
| DNS (Route 53) | ✅ Deployed | Hosted zone: Z061444035YYGCPJ5IJT0 (prance.jp) |
| ACM Certificate | ✅ Issued | arn:...3859 (dev.app.prance.jp + SANs) |
| CloudFront CDN | ✅ Deployed | E1HIO2L0WNT8LT (d3mx0sug5s3a6x.cloudfront.net) |
| Network (VPC) | ✅ Deployed | Prance-dev-Network |
| Cognito | ✅ Deployed | Prance-dev-Cognito |
| Database (Aurora) | ✅ Deployed | Prance-dev-Database (PostgreSQL 15.4) |
| Storage (S3) | ✅ Deployed | Prance-dev-Storage |
| DynamoDB | ✅ Deployed | Prance-dev-DynamoDB |

### ❌ Not Configured (5/13)

| Component | Status | Impact | Priority |
|-----------|--------|--------|----------|
| API Gateway Custom Domains | ❌ Not Set Up | Users must use ugly AWS URLs | 🔴 High |
| DNS Records (API/WS) | ❌ Missing | api.dev.app.prance.jp not accessible | 🔴 High |
| AWS WAF | ❌ Not Deployed | No DDoS/bot protection | 🟡 Medium |
| CloudWatch Alarms | ❌ Not Set Up | No production monitoring | 🟡 Medium |
| Lambda Provisioned Concurrency | ❌ Not Configured | Cold starts in production | 🟢 Low |

---

## 🔍 Detailed Analysis

### 1. API Gateway Custom Domains ❌

**Current State:**
- REST API: `https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/`
- WebSocket: `wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev`

**Target State:**
- REST API: `https://api.dev.app.prance.jp/`
- WebSocket: `wss://ws.dev.app.prance.jp/`

**Required Actions:**
1. Create API Gateway custom domain name resources
2. Map custom domains to API Gateway APIs
3. Update Route 53 DNS records (A/AAAA records with API Gateway target)
4. Update frontend config (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`)

**CDK Code Location:** `infrastructure/lib/api-gateway-stack.ts` (needs custom domain configuration)

---

### 2. Frontend Hosting Discrepancy 🔍

**Discovery:**
```bash
dev.app.prance.jp → CNAME → 1154c65973607637.vercel-dns-016.com
```

**Issue:** Frontend is hosted on Vercel, not CloudFront CDN

**CloudFront Distribution:**
- ID: E1HIO2L0WNT8LT
- Domain: d3mx0sug5s3a6x.cloudfront.net
- Custom Domain: dev.app.prance.jp (configured but not used)

**Implications:**
- Next.js app deployed to Vercel (external hosting)
- CloudFront only used for S3 assets (avatars, recordings)
- DNS record points to Vercel, not CloudFront

**Decision Required:**
- Keep Vercel for frontend hosting? (easier CI/CD)
- Switch to CloudFront + S3 static hosting? (fully AWS-managed)

---

### 3. AWS WAF Protection ❌

**Current State:** No WAF rules deployed

**Required Actions:**
1. Create WAF Web ACL
2. Configure rate limiting (API Gateway + CloudFront)
3. Add AWS Managed Rule Groups:
   - AWSManagedRulesCommonRuleSet (OWASP Top 10)
   - AWSManagedRulesKnownBadInputsRuleSet
   - AWSManagedRulesSQLiRuleSet
   - AWSManagedRulesLinuxRuleSet
4. Configure IP allowlist/blocklist
5. Associate WAF with API Gateway and CloudFront

**CDK Code Location:** Create `infrastructure/lib/waf-stack.ts`

---

### 4. CloudWatch Monitoring ⚠️

**Current State:** Monitoring stack exists but alarms not verified

**Stack:** Prance-dev-Monitoring (CREATE_COMPLETE)

**Required Verification:**
1. Check existing alarms configuration
2. Add critical alarms:
   - Lambda error rate > 1%
   - API Gateway 5xx errors > 10/min
   - DynamoDB throttled requests
   - Aurora CPU > 80%
   - S3 4xx/5xx errors
3. Configure SNS topics for alerts
4. Set up CloudWatch Dashboards

**Action:** Audit existing monitoring stack outputs

---

### 5. Lambda Provisioned Concurrency 🟢

**Current State:** All Lambdas use on-demand (cold starts)

**Critical Functions for Provisioned Concurrency:**
- `prance-websocket-default-dev` (WebSocket connection handler)
- `prance-sessions-get-dev` (Session API)
- `prance-avatars-list-dev` (Avatar API)

**Configuration:**
- Production: 2-5 instances
- Staging: 1-2 instances
- Dev: On-demand (no change)

**CDK Code Location:** `infrastructure/lib/api-lambda-stack.ts` (add provisioned concurrency config)

---

## 📋 Implementation Roadmap

### Phase 3.1: Custom Domains (Week 1)
**Priority:** 🔴 High
**Estimated Time:** 2-3 days

**Tasks:**
1. [ ] Create API Gateway custom domain resources (CDK)
2. [ ] Configure domain name mappings
3. [ ] Update Route 53 DNS records
4. [ ] Update frontend environment variables
5. [ ] Test API/WebSocket with custom domains
6. [ ] Update documentation

**Files to Modify:**
- `infrastructure/lib/api-lambda-stack.ts` (add custom domain config)
- `infrastructure/lib/dns-stack.ts` (add A/AAAA records)
- `apps/web/.env.local` (update API URLs)
- `infrastructure/.env` (update API URLs)

---

### Phase 3.2: AWS WAF Integration (Week 1-2)
**Priority:** 🟡 Medium
**Estimated Time:** 2-3 days

**Tasks:**
1. [ ] Create WAF Web ACL with managed rule groups
2. [ ] Configure rate limiting rules
3. [ ] Associate WAF with API Gateway
4. [ ] Associate WAF with CloudFront
5. [ ] Test WAF rules (blocked/allowed requests)
6. [ ] Configure logging to S3

**Files to Create:**
- `infrastructure/lib/waf-stack.ts`

---

### Phase 3.3: Production Monitoring (Week 2)
**Priority:** 🟡 Medium
**Estimated Time:** 2 days

**Tasks:**
1. [ ] Audit existing Monitoring stack
2. [ ] Add critical CloudWatch Alarms
3. [ ] Configure SNS topics for alerts
4. [ ] Create CloudWatch Dashboards
5. [ ] Set up log aggregation
6. [ ] Test alarm triggers

**Files to Modify:**
- `infrastructure/lib/monitoring-stack.ts`

---

### Phase 3.4: Performance Optimization (Week 2-3)
**Priority:** 🟢 Low
**Estimated Time:** 1-2 days

**Tasks:**
1. [ ] Configure Lambda Provisioned Concurrency (critical functions)
2. [ ] Optimize API Gateway throttling settings
3. [ ] Enable API Gateway caching (GET endpoints)
4. [ ] Configure CloudFront caching policies
5. [ ] Optimize Lambda memory allocation
6. [ ] Performance testing

**Files to Modify:**
- `infrastructure/lib/api-lambda-stack.ts`
- `infrastructure/lib/storage-stack.ts`

---

### Phase 3.5: Security Hardening (Week 3)
**Priority:** 🟡 Medium
**Estimated Time:** 2 days

**Tasks:**
1. [ ] Enable API Gateway request validation
2. [ ] Configure CORS policies
3. [ ] Enable VPC endpoints for AWS services
4. [ ] Configure security headers (CloudFront)
5. [ ] Enable AWS GuardDuty
6. [ ] Security audit

**Files to Modify:**
- Multiple stack files

---

## 🎯 Next Steps

**Immediate Actions (Today):**
1. ✅ Document current infrastructure status (this file)
2. Decide: Keep Vercel or switch to CloudFront for frontend?
3. Choose first task: Custom domains (Phase 3.1) or WAF (Phase 3.2)?

**Short-term (This Week):**
- Implement Phase 3.1 (Custom Domains)
- Begin Phase 3.2 (AWS WAF)

**Mid-term (Next 2 Weeks):**
- Complete Phase 3.2, 3.3, 3.4
- Production environment deployment

---

## 📊 Progress Tracking

**Overall Progress:** 8/13 (62%)

| Category | Progress |
|----------|----------|
| Infrastructure Deployment | 8/8 (100%) ✅ |
| Custom Domains | 0/6 (0%) ❌ |
| Security (WAF) | 0/6 (0%) ❌ |
| Monitoring | 1/6 (17%) ⚠️ |
| Performance | 0/6 (0%) ❌ |

---

## 📚 References

- [PRODUCTION_READY_ROADMAP.md](../../03-planning/releases/PRODUCTION_READY_ROADMAP.md)
- [AWS_SERVERLESS.md](../../06-infrastructure/AWS_SERVERLESS.md)
- [DOMAIN_SETUP_SUMMARY.md](../../06-infrastructure/DOMAIN_SETUP_SUMMARY.md)
- [SECURITY.md](../../08-operations/SECURITY.md)

---

**Last Updated:** 2026-03-16 23:45 JST
**Next Review:** After Phase 3.1 completion
