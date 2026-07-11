# IntelliCare API to Function Calling - Complete Mapping Analysis

## 📊 Executive Summary
- **Total API Routes Found**: 429 endpoints across 52 route files
- **Functions Implemented in V4**: ~80 functions
- **Estimated Coverage**: ~25-30% of total API surface
- **Critical Gaps**: 70-75% of APIs lack natural conversation support

## 🎯 High-Priority Missing Implementations

### 1. **APPOINTMENTS** (9 endpoints, 2 implemented = 22% coverage)
**File**: `routes/appointments.js`

| Endpoint | Method | Function Status | Priority |
|----------|--------|----------------|----------|
| `/appointments` | POST | ✅ scheduleAppointment | - |
| `/appointments/patient/:patientId` | GET | ❌ Missing | HIGH |
| `/appointments/:appointmentId` | GET | ❌ Missing | HIGH |
| `/appointments/:appointmentId/status` | PUT | ❌ Missing | HIGH |
| `/appointments/:appointmentId/reschedule` | PUT | ❌ Missing | CRITICAL |
| `/appointments/:appointmentId/vitals` | PUT | ❌ Missing | HIGH |
| `/appointments/today` | GET | ❌ Missing | HIGH |
| `/appointments/provider/:providerId` | GET | ❌ Missing | MEDIUM |
| `/appointments/overdue` | GET | ❌ Missing | MEDIUM |

**Missing Functions Needed**:
- `getAppointmentById`
- `updateAppointmentStatus`
- `rescheduleAppointment` 
- `recordAppointmentVitals`
- `getTodayAppointments`
- `getDoctorAppointments`
- `getOverdueAppointments`

### 2. **PRESCRIPTIONS** (5 endpoints, 2 implemented = 40% coverage)
**File**: `routes/prescriptions.js`

| Endpoint | Method | Function Status | Priority |
|----------|--------|----------------|----------|
| `/prescriptions` | POST | ✅ createPrescription | - |
| `/prescriptions/patient/:patientId` | GET | ✅ getPrescriptions | - |
| `/prescriptions/:prescriptionId` | GET | ❌ Missing | HIGH |
| `/prescriptions/:prescriptionId/refill` | PUT | ❌ Missing | CRITICAL |
| `/prescriptions/:prescriptionId/status` | PUT | ❌ Missing | HIGH |

**Missing Functions Needed**:
- `getPrescriptionById`
- `refillPrescription`
- `updatePrescriptionStatus`

### 3. **INSURANCE** (11 endpoints, 2 implemented = 18% coverage)
**File**: `routes/insurance.js`

| Endpoint | Method | Function Status | Priority |
|----------|--------|----------------|----------|
| `/insurance` | POST | ❌ Missing | HIGH |
| `/insurance/patient/:patientId` | GET | ❌ Missing | HIGH |
| `/insurance/:insuranceId` | GET | ❌ Missing | MEDIUM |
| `/insurance/:insuranceId/verify` | PUT | ✅ verifyInsurance | - |
| `/insurance/:insuranceId/authorization` | POST | ❌ Missing | CRITICAL |
| `/insurance/:insuranceId/authorization/:authNumber` | PUT | ❌ Missing | HIGH |
| `/insurance/:insuranceId/claim` | POST | ✅ submitInsuranceClaim | - |
| `/insurance/:insuranceId/claim/:claimNumber` | PUT | ❌ Missing | HIGH |
| `/insurance/verification/needed` | GET | ❌ Missing | MEDIUM |
| `/insurance/expiring` | GET | ❌ Missing | LOW |
| `/insurance/:insuranceId/coverage/:serviceType` | GET | ❌ Missing | HIGH |

**Missing Functions Needed**:
- `addInsurance`
- `getPatientInsurance`
- `getInsuranceById`
- `requestAuthorization`
- `updateAuthorization`
- `updateClaimStatus`
- `getVerificationQueue`
- `getExpiringInsurance`
- `checkServiceCoverage`

### 4. **IMAGING** (6 endpoints, 2 implemented = 33% coverage)
**File**: `routes/imaging.js`

| Endpoint | Method | Function Status | Priority |
|----------|--------|----------------|----------|
| `/imaging/results` | POST | ✅ addImagingResult | - |
| `/imaging/results/patient/:patientId` | GET | ✅ getImagingResults | - |
| `/imaging/results/:resultId` | GET | ❌ Missing | HIGH |
| `/imaging/results/:resultId` | PUT | ❌ Missing | MEDIUM |
| `/imaging/studies/pending` | GET | ❌ Missing | MEDIUM |
| `/imaging/results/:resultId/images/:imageIndex` | GET | ❌ Missing | LOW |

**Missing Functions Needed**:
- `getImagingResultById`
- `updateImagingResult`
- `getPendingStudies`
- `getImagingImage`

### 5. **CHAT** (12 endpoints, 2 implemented = 17% coverage)
**File**: `routes/chat.js`

| Endpoint | Method | Function Status | Priority |
|----------|--------|----------------|----------|
| `/chat/sessions` | GET | ❌ Missing | HIGH |
| `/chat/sessions` | POST | ✅ createChatSession | - |
| `/chat/sessions/:sessionId/messages` | GET | ❌ Missing | HIGH |
| `/chat/sessions/:sessionId/messages` | POST | ❌ Missing | CRITICAL |
| `/chat/sessions/:sessionId/title` | PUT | ❌ Missing | LOW |
| `/chat/sessions/bulk` | PATCH | ❌ Missing | LOW |
| `/chat/sessions/bulk` | DELETE | ❌ Missing | LOW |
| `/chat/sessions/:sessionId` | DELETE | ❌ Missing | MEDIUM |
| `/chat/search` | GET | ✅ searchChatHistory | - |
| `/chat/sessions/:sessionId/search` | GET | ❌ Missing | MEDIUM |
| `/chat/analytics` | GET | ❌ Missing | LOW |
| `/chat/export` | GET | ❌ Missing | LOW |

**Missing Functions Needed**:
- `getChatSessions`
- `getChatMessages`
- `sendChatMessage`
- `updateChatTitle`
- `bulkUpdateSessions`
- `bulkDeleteSessions`
- `deleteChatSession`
- `searchSessionMessages`
- `getChatAnalytics`
- `exportChatHistory`

### 6. **DOCUMENTS** (14 endpoints, 5 implemented = 36% coverage)
**File**: `routes/documents.js`

Already has better coverage with uploadDocument, getDocuments, analyzeDocument, deleteDocument, searchDocuments.

### 7. **MEDICAL DATA** (7 endpoints, 8 related functions = Good coverage)
**File**: `routes/medicalData.js`

Has good coverage with addLabResult, getLabResults, addMedication, getMedications, addVitalSigns, getVitalSigns, addAllergy, getAllergies.

### 8. **REFERRALS** (5 endpoints, 2 implemented = 40% coverage)
**File**: `routes/referrals.js`

| Endpoint | Method | Function Status | Priority |
|----------|--------|----------------|----------|
| `/referrals` | POST | ✅ createReferral | - |
| `/referrals/patient/:patientId` | GET | ✅ getReferrals | - |
| `/referrals/:referralId` | GET | ❌ Missing | MEDIUM |
| `/referrals/:referralId/status` | PUT | ❌ Missing | HIGH |
| `/referrals/:referralId/notes` | POST | ❌ Missing | MEDIUM |

**Missing Functions Needed**:
- `getReferralById`
- `updateReferralStatus`
- `addReferralNotes`

## 📈 Coverage Analysis by Category

| Category | Total Endpoints | Functions Implemented | Coverage % | Priority |
|----------|----------------|----------------------|------------|----------|
| Patients | 14 | 6 | 43% | ✅ Good |
| Medical Data | 7 | 8 | 100%+ | ✅ Excellent |
| Documents | 14 | 5 | 36% | ⚠️ Needs Work |
| Appointments | 9 | 2 | 22% | 🔴 Critical Gap |
| Prescriptions | 5 | 2 | 40% | 🔴 Critical Gap |
| Insurance | 11 | 2 | 18% | 🔴 Critical Gap |
| Imaging | 6 | 2 | 33% | 🔴 Critical Gap |
| Chat | 12 | 2 | 17% | 🔴 Critical Gap |
| Referrals | 5 | 2 | 40% | ⚠️ Needs Work |
| Diagnosis | 4 | 5 | 100%+ | ✅ Excellent |
| Auth | 3 | - | 0% | N/A (handled separately) |
| System/Admin | 50+ | 20+ | ~40% | ✅ Adequate |

## 🚀 Implementation Priority Matrix

### **CRITICAL - Implement Immediately (Blocks Core Workflows)**
1. `rescheduleAppointment` - Essential for appointment management
2. `refillPrescription` - Critical for medication continuity
3. `requestAuthorization` - Required for insurance workflows
4. `sendChatMessage` - Core chat functionality
5. `getAppointmentById` - Basic appointment viewing

### **HIGH - Implement Next (Important Clinical Functions)**
1. `updateAppointmentStatus` - Appointment workflow
2. `recordAppointmentVitals` - Clinical data capture
3. `getTodayAppointments` - Daily workflow
4. `updatePrescriptionStatus` - Prescription tracking
5. `checkServiceCoverage` - Insurance verification
6. `getChatSessions` - Chat history access
7. `getChatMessages` - Message retrieval
8. `updateReferralStatus` - Referral tracking

### **MEDIUM - Standard Features**
1. `getDoctorAppointments` - Provider views
2. `getOverdueAppointments` - Administrative
3. `getPrescriptionById` - Detail views
4. `updateAuthorization` - Insurance management
5. `updateClaimStatus` - Claims tracking
6. `getImagingResultById` - Imaging details
7. `getReferralById` - Referral details
8. `addReferralNotes` - Clinical notes

### **LOW - Nice to Have**
1. `getExpiringInsurance` - Administrative alerts
2. `getImagingImage` - Image viewing
3. `updateChatTitle` - UI enhancement
4. `getChatAnalytics` - Reporting
5. `exportChatHistory` - Data export

## 📝 Implementation Template

For each missing function, use this template:

```javascript
{
  name: "functionName",
  description: isHebrew 
    ? "תיאור בעברית"
    : "English description",
  parameters: {
    type: "object",
    properties: {
      // Match API endpoint parameters
    },
    required: ["requiredParams"]
  }
}

// Implementation
async functionName(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Validate parameters
    // Call API endpoint
    const result = await this.callAPI('/api/path', 'METHOD', params, practiceContext);
    
    // Return formatted result
    return {
      success: true,
      message: isHebrew ? 'הודעה בעברית' : 'English message',
      data: result.data
    };
  } catch (error) {
    // Error handling
  }
}
```

## 🎯 Next Steps

1. **Phase 1**: Implement all CRITICAL functions (5 functions)
2. **Phase 2**: Implement all HIGH priority functions (8 functions)
3. **Phase 3**: Implement MEDIUM priority functions (8 functions)
4. **Phase 4**: Implement LOW priority functions (5 functions)

**Total New Functions Needed**: ~50 functions to achieve 80%+ API coverage

## 📊 Expected Outcome

After implementing these missing functions:
- **Current**: ~80 functions covering 25-30% of APIs
- **Target**: ~130 functions covering 80%+ of APIs
- **Result**: Complete natural conversation coverage for all clinical workflows

---

*Analysis Date: August 18, 2025*
*Total APIs Analyzed: 429 endpoints*
*Current Implementation: ~80 functions*
*Gap: ~50 critical functions missing*