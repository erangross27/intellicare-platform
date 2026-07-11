# Task Breakdown - Fix Critical Product Issues

## Overview
Small, focused tasks to fix the identified critical issues and make IntelliCare fully functional.

---

## 🚨 CRITICAL TASKS (BLOCKERS)

### Task 1: Fix AuditLog Model Bug
**Priority**: HIGH | **Estimated Time**: 15 minutes | **Type**: Bug Fix

**Issue**: `TypeError: Cannot read properties of undefined (reading 'firstName')`

**Steps**:
1. Open `backend/models/AuditLog.js`
2. Find line accessing `user.profile.firstName`
3. Add null check: `user.profile?.firstName || 'Unknown'`
4. Test with `node scripts/test-practice-models.js`

**Success Criteria**:
- [ ] AuditLog creation works without errors
- [ ] All model tests pass (100% success rate)

---

### Task 2: Create Practice Creation API Endpoint
**Priority**: CRITICAL | **Estimated Time**: 45 minutes | **Type**: New Feature

**Create**: `backend/routes/practices.js`

**API Endpoint**: `POST /api/practices/create`

**Request Body**:
```json
{
  "name": "My Practice",
  "subdomain": "myclinic",
  "address": {
    "street": "123 Main St",
    "city": "Tel Aviv",
    "country": "Israel"
  },
  "adminUser": {
    "email": "admin@myclinic.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  },
  "settings": {
    "language": "he",
    "timezone": "Asia/Jerusalem",
    "patientIdFormat": "israeli_id"
  }
}
```

**Steps**:
1. Create `backend/routes/practices.js`
2. Add practice creation endpoint (no auth required)
3. Validate subdomain uniqueness
4. Create practice in global database
5. Initialize practice-specific database
6. Create first admin user
7. Return practice info + admin JWT token
8. Add route to `backend/server.js`

**Success Criteria**:
- [ ] Endpoint creates practice in global database
- [ ] Practice-specific database initialized
- [ ] First admin user created with proper roles
- [ ] Returns JWT token for immediate login
- [ ] Subdomain validation works

---

### Task 3: Create Practice Setup Wizard Component
**Priority**: CRITICAL | **Estimated Time**: 60 minutes | **Type**: New Feature

**Create**: `frontend/src/components/ClinicSetupWizard.js`

**Features**:
- Step 1: Practice basic info (name, subdomain)
- Step 2: Address & country selection
- Step 3: Admin user creation
- Step 4: Settings (language, timezone, patient ID format)
- Step 5: Confirmation & creation

**Steps**:
1. Create multi-step wizard component
2. Add form validation for each step
3. Add subdomain availability check
4. Add country selection with patient ID format mapping
5. Integrate with practice creation API
6. Add Hebrew/English translations
7. Add professional styling

**Success Criteria**:
- [ ] 5-step wizard with navigation
- [ ] Real-time subdomain validation
- [ ] Country-specific patient ID formats
- [ ] Bilingual support (Hebrew/English)
- [ ] Professional UI design
- [ ] Successful practice creation flow

---

### Task 4: Fix Signup Flow Integration
**Priority**: CRITICAL | **Estimated Time**: 30 minutes | **Type**: Bug Fix

**Issue**: Signup component doesn't render ClinicSelector or ClinicSetupWizard

**Steps**:
1. Open `frontend/src/components/Signup.js`
2. Add conditional rendering logic:
   - If no practice selected → Show ClinicSetupWizard
   - If practice selected → Show signup form
3. Update signup flow to use practice-aware authentication
4. Add "Create New Practice" option
5. Test complete flow

**Success Criteria**:
- [ ] ClinicSetupWizard renders when no practice selected
- [ ] "Create New Practice" option available
- [ ] Signup uses practice-aware authentication
- [ ] Complete flow from practice creation to login works

---

### Task 5: Fix Test Authentication Setup
**Priority**: HIGH | **Estimated Time**: 40 minutes | **Type**: Test Fix

**Issue**: All API tests fail with 403 Forbidden

**Files to Fix**:
- `scripts/test-practice-routes.js`
- `scripts/test-enhanced-patient-apis.js`
- `scripts/test-enhanced-document-apis.js`
- `scripts/test-enhanced-chat-apis.js`

**Steps**:
1. Create `scripts/test-helpers/auth-setup.js`
2. Add function to create authenticated test users
3. Add function to generate JWT tokens
4. Add function to setup practice context headers
5. Update all test files to use auth helpers
6. Run all tests to verify fixes

**Success Criteria**:
- [ ] All API tests pass authentication
- [ ] Test users created with proper roles
- [ ] JWT tokens generated correctly
- [ ] Practice context headers included
- [ ] 100% test success rate

---

## 🔧 ENHANCEMENT TASKS

### Task 6: Add Practice Management Dashboard
**Priority**: MEDIUM | **Estimated Time**: 45 minutes | **Type**: Enhancement

**Create**: `frontend/src/components/ClinicManagement.js`

**Features**:
- View practice information
- Edit practice settings
- Manage subscription
- View usage statistics

**Steps**:
1. Create practice management component
2. Add practice info display
3. Add settings editing
4. Add usage statistics
5. Add to navigation for admins

**Success Criteria**:
- [ ] Practice info displayed correctly
- [ ] Settings can be updated
- [ ] Usage statistics shown
- [ ] Only accessible to admins

---

### Task 7: Add Country-Specific Patient ID Formats
**Priority**: MEDIUM | **Estimated Time**: 30 minutes | **Type**: Enhancement

**Countries to Support**:
- Israel: Israeli ID (9 digits)
- USA: Social Security Number (XXX-XX-XXXX)
- Canada: Health Card Number
- UK: NHS Number

**Steps**:
1. Create `backend/utils/patientIdFormats.js`
2. Add validation functions for each format
3. Update Patient model to use country-specific validation
4. Update frontend forms with format hints
5. Add to practice settings

**Success Criteria**:
- [ ] Patient ID validation by country
- [ ] Format hints in UI
- [ ] Practice-specific default format
- [ ] Proper error messages

---

## 🧪 TESTING TASKS

### Task 8: Create End-to-End User Journey Test
**Priority**: HIGH | **Estimated Time**: 35 minutes | **Type**: Test

**Create**: `scripts/test-e2e-user-journey.js`

**Test Flow**:
1. Create new practice via API
2. Login as admin user
3. Create additional users
4. Create patients
5. Upload documents
6. Use chat interface
7. Verify complete isolation

**Steps**:
1. Create comprehensive E2E test
2. Test complete user journey
3. Verify all features work
4. Test practice isolation
5. Add cleanup procedures

**Success Criteria**:
- [ ] Complete user journey works
- [ ] All features functional
- [ ] Practice isolation maintained
- [ ] Clean test environment

---

### Task 9: Create Practice Creation Integration Test
**Priority**: HIGH | **Estimated Time**: 25 minutes | **Type**: Test

**Create**: `scripts/test-practice-creation.js`

**Test Scenarios**:
1. Valid practice creation
2. Duplicate subdomain handling
3. Invalid data validation
4. Database initialization
5. Admin user creation

**Steps**:
1. Create practice creation test
2. Test all validation scenarios
3. Verify database setup
4. Test admin user creation
5. Test immediate login flow

**Success Criteria**:
- [ ] All creation scenarios tested
- [ ] Validation working correctly
- [ ] Database properly initialized
- [ ] Admin user functional

---

### Task 10: Create Frontend Integration Test
**Priority**: MEDIUM | **Estimated Time**: 30 minutes | **Type**: Test

**Create**: `frontend/src/tests/practice-setup.test.js`

**Test Components**:
- ClinicSetupWizard
- Signup flow
- Login flow
- Practice management

**Steps**:
1. Setup React testing environment
2. Create component tests
3. Test user interactions
4. Test API integration
5. Test error handling

**Success Criteria**:
- [ ] All components tested
- [ ] User interactions work
- [ ] API integration functional
- [ ] Error handling proper

---

## 📋 TASK EXECUTION ORDER

### Phase 1: Critical Fixes (2 hours)
1. **Task 1**: Fix AuditLog Model Bug (15 min)
2. **Task 2**: Create Practice Creation API (45 min)
3. **Task 3**: Create Practice Setup Wizard (60 min)

### Phase 2: Integration (1.5 hours)
4. **Task 4**: Fix Signup Flow (30 min)
5. **Task 5**: Fix Test Authentication (40 min)
6. **Task 8**: E2E User Journey Test (35 min)

### Phase 3: Testing & Validation (1 hour)
7. **Task 9**: Practice Creation Test (25 min)
8. **Task 10**: Frontend Integration Test (30 min)

### Phase 4: Enhancements (1.25 hours)
9. **Task 6**: Practice Management Dashboard (45 min)
10. **Task 7**: Country-Specific Patient IDs (30 min)

**Total Estimated Time**: 5.75 hours
**Critical Path**: 3.5 hours (Tasks 1-5, 8)

---

## 🎯 SUCCESS METRICS

### After Critical Tasks (1-5):
- [ ] New users can create practices
- [ ] Complete signup flow works
- [ ] All API tests pass
- [ ] Product is fully functional

### After All Tasks:
- [ ] 100% test coverage
- [ ] Professional user experience
- [ ] Country-specific features
- [ ] Enterprise-ready platform
