# 🎯 Agent Service Update Tasks - Israel + US Support

## 📁 **Task Organization**

This folder contains individual task files for updating the IntelliCare Agent Service to support both Israeli and US practices.

### **📋 Task Index:**

#### **PHASE 1: CRITICAL FUNCTIONS (Patient Management)**
- [`task-1.1-update-addPatientFunction-schema.md`](./task-1.1-update-addPatientFunction-schema.md) - Update patient creation schema
- [`task-1.2-update-addPatient-implementation.md`](./task-1.2-update-addPatient-implementation.md) - Update patient creation logic
- [`task-1.3-update-addHistoryFunction-schema.md`](./task-1.3-update-addHistoryFunction-schema.md) - Update medical history schema
- [`task-1.4-update-getDiagnosisFunction-schema.md`](./task-1.4-update-getDiagnosisFunction-schema.md) - Update diagnosis schema
- [`task-1.5-update-getDiagnosis-implementation.md`](./task-1.5-update-getDiagnosis-implementation.md) - Update diagnosis logic

#### **PHASE 2: IMPLEMENTATION & DATA INTEGRITY**
- [`task-2.1-update-getPatientFunction-schema.md`](./task-2.1-update-getPatientFunction-schema.md) - Update patient search schema
- [`task-2.2-update-getPatient-implementation.md`](./task-2.2-update-getPatient-implementation.md) - Update patient search logic
- [`task-2.3-update-listPatients-implementation.md`](./task-2.3-update-listPatients-implementation.md) - Update patient listing
- [`task-2.4-update-getHistory-implementation.md`](./task-2.4-update-getHistory-implementation.md) - Update history retrieval
- [`task-2.5-update-updateHistory-implementation.md`](./task-2.5-update-updateHistory-implementation.md) - Update history modification
- [`task-2.6-add-batch-operations.md`](./task-2.6-add-batch-operations.md) - Add atomic batch processing
- [`task-2.7-add-transaction-support.md`](./task-2.7-add-transaction-support.md) - Add database transactions

#### **PHASE 3: UTILITIES, MONITORING & RESILIENCE**
- [`task-3.1-update-error-messages.md`](./task-3.1-update-error-messages.md) - Multi-language error messages
- [`task-3.2-add-country-detection.md`](./task-3.2-add-country-detection.md) - Country detection helpers
- [`task-3.3-add-field-validation.md`](./task-3.3-add-field-validation.md) - Field validation helpers
- [`task-3.4-add-metrics-monitoring.md`](./task-3.4-add-metrics-monitoring.md) - Performance metrics and monitoring
- [`task-3.5-add-circuit-breaker.md`](./task-3.5-add-circuit-breaker.md) - Circuit breaker for AI services
- [`task-3.6-add-data-retention.md`](./task-3.6-add-data-retention.md) - Data retention and cleanup policies
- [`task-3.7-enhanced-health-checks.md`](./task-3.7-enhanced-health-checks.md) - Enhanced health checks for dependencies
- [`task-3.8-graceful-shutdown.md`](./task-3.8-graceful-shutdown.md) - Graceful shutdown and resource cleanup
- [`task-3.9-add-websocket-support.md`](./task-3.9-add-websocket-support.md) - Real-time updates for long operations
- [`task-3.10-add-response-caching.md`](./task-3.10-add-response-caching.md) - Cache common AI responses
- [`task-3.11-add-backup-ai-provider.md`](./task-3.11-add-backup-ai-provider.md) - Fallback AI service support

#### **PHASE 4: TESTING & VALIDATION**
- [`task-4.1-test-israeli-functions.md`](./task-4.1-test-israeli-functions.md) - Test Israeli practice functions
- [`task-4.2-test-us-functions.md`](./task-4.2-test-us-functions.md) - Test US practice functions
- [`task-4.3-test-function-calling.md`](./task-4.3-test-function-calling.md) - Test Gemini function calling

### **🎯 UPDATED Execution Order:**
1. **PHASE 0: CRITICAL SECURITY (MUST DO FIRST)** - Fix data leaks and security issues
2. Complete Phase 1 tasks (Critical functions)
3. Complete Phase 3 tasks (Helpers)
4. Complete Phase 2 tasks (Search/Display)
5. Complete Phase 4 tasks (Testing)

### **⚠️ Safety Rules:**
- **DO NOT TOUCH:** Gemini function calling API structure (lines 456-482)
- **DO NOT TOUCH:** Function call detection logic (lines 484-534)
- **DO NOT TOUCH:** `mode: 'ANY'` configuration
- **KEEP SAME:** Function names for detection

### **🚨 CRITICAL SECURITY PHASE (MUST DO FIRST):**
- [`task-0.1-fix-multi-tenancy-violations.md`](./task-0.1-fix-multi-tenancy-violations.md) - Fix data leakage between practices
- [`task-0.2-add-security-middleware.md`](./task-0.2-add-security-middleware.md) - Add rate limiting, auth, country detection
- [`task-0.3-add-audit-logging.md`](./task-0.3-add-audit-logging.md) - Add compliance audit logging
- [`task-0.4-fix-pendingupload-model.md`](./task-0.4-fix-pendingupload-model.md) - Fix practice isolation in uploads
- [`task-0.5-implement-error-localization.md`](./task-0.5-implement-error-localization.md) - Centralized error messages
- [`task-0.6-fix-authentication-requirements.md`](./task-0.6-fix-authentication-requirements.md) - Fix public routes that should be private
- [`task-0.7-add-input-validation.md`](./task-0.7-add-input-validation.md) - Add comprehensive input validation
- [`task-0.8-fix-session-namespacing.md`](./task-0.8-fix-session-namespacing.md) - Fix practice session isolation
- [`task-0.9-add-request-sanitization.md`](./task-0.9-add-request-sanitization.md) - Sanitize file uploads and inputs
- [`task-0.10-prevent-memory-leaks.md`](./task-0.10-prevent-memory-leaks.md) - Fix memory leaks from large uploads
- [`task-0.11-add-cors-security.md`](./task-0.11-add-cors-security.md) - Add CORS and security headers
- [`task-0.12-fix-async-error-handling.md`](./task-0.12-fix-async-error-handling.md) - Fix unhandled promise rejections
- [`task-0.13-add-request-correlation.md`](./task-0.13-add-request-correlation.md) - Add request ID tracking for debugging
- [`task-0.14-implement-file-cleanup.md`](./task-0.14-implement-file-cleanup.md) - Add comprehensive file cleanup mechanisms
- [`task-0.15-add-practice-context-to-analyze.md`](./task-0.15-add-practice-context-to-analyze.md) - Fix missing practice context in document analysis

### **📊 Progress Tracking:**
- [ ] **Phase 0: CRITICAL SECURITY (15 tasks) - DO FIRST**
- [ ] Phase 1: Critical Functions (5 tasks)
- [ ] Phase 2: Implementation & Data Integrity (7 tasks)
- [ ] Phase 3: Utilities, Monitoring & Resilience (11 tasks)
- [ ] Phase 4: Testing (3 tasks)

### **🚀 Getting Started:**
1. Start with `task-1.1-update-addPatientFunction-schema.md`
2. Complete tasks in order within each phase
3. Test after each phase completion
4. Commit changes after each phase

### **📁 File Structure:**
```
docs/agent-update-tasks/
├── README.md (this file)
├── task-1.1-update-addPatientFunction-schema.md
├── task-1.2-update-addPatient-implementation.md
├── task-1.3-update-addHistoryFunction-schema.md
├── task-1.4-update-getDiagnosisFunction-schema.md
├── task-1.5-update-getDiagnosis-implementation.md
├── task-2.1-update-getPatientFunction-schema.md
├── task-2.2-update-getPatient-implementation.md
├── task-2.3-update-listPatients-implementation.md
├── task-2.4-update-getHistory-implementation.md
├── task-2.5-update-updateHistory-implementation.md
├── task-3.1-update-error-messages.md
├── task-3.2-add-country-detection.md
├── task-3.3-add-field-validation.md
├── task-4.1-test-israeli-functions.md
├── task-4.2-test-us-functions.md
├── task-4.3-test-function-calling.md
├── task-0.6-fix-authentication-requirements.md
└── task-0.7-add-input-validation.md
```

**Total:** 41 individual task files + this README

## 📊 **FINAL TASK SUMMARY:**

| Phase | Tasks | Time (min) | Risk Level | Priority |
|-------|-------|------------|------------|----------|
| **Phase 0: CRITICAL SECURITY** | 15 tasks | 295 min | CRITICAL | URGENT |
| Phase 1: Critical Functions | 5 tasks | 70 min | LOW | HIGH |
| Phase 2: Implementation & Data Integrity | 7 tasks | 110 min | MEDIUM | HIGH |
| Phase 3: Utilities, Monitoring & Resilience | 11 tasks | 215 min | LOW | MEDIUM |
| Phase 4: Testing | 3 tasks | 55 min | MEDIUM | HIGH |
| **TOTAL** | **41 tasks** | **745 min** | **MIXED** | **URGENT** |

## ⏱️ **TIME BREAKDOWN:**
- **Phase 0 (Critical Security):** 4.9 hours - **MUST DO FIRST**
- **Phase 1 (Functions):** 1.2 hours - Core function updates
- **Phase 2 (Data Integrity):** 1.8 hours - Transactions and batch operations
- **Phase 3 (Monitoring & Resilience):** 3.6 hours - Monitoring, health checks, real-time features
- **Phase 4 (Testing):** 0.9 hours - Comprehensive testing
- **Total Project Time:** 12.4 hours

## 🚨 **CRITICAL SECURITY ISSUES IDENTIFIED:**

The original plan missed several **CRITICAL SECURITY VULNERABILITIES** that must be addressed first:

### **🔴 Data Leakage Risks:**
- Multi-tenancy violations allowing cross-practice data access
- Global model usage instead of practice-specific models
- Session collisions between different practices
- PendingUpload model not practice-isolated

### **🔴 Security Vulnerabilities:**
- Missing rate limiting on expensive AI operations
- Routes incorrectly marked as "Public" that handle sensitive data
- No audit logging for HIPAA compliance
- Missing input validation and sanitization

### **🔴 Compliance Violations:**
- No audit trail for patient data access (HIPAA requirement)
- Missing security event logging
- No proper authentication on sensitive endpoints

### **⚠️ EXECUTION PRIORITY:**
**Phase 0 MUST be completed first** - these are production-breaking security issues that could cause:
- Patient data leakage between practices
- Unauthorized access to sensitive medical data
- HIPAA compliance violations
- DoS attacks on AI endpoints
- Cross-practice session pollution
