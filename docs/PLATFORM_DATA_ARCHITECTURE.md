# IntelliCare Platform Data Architecture
**The Core Functionality Map**

## Overview
The platform's core functionality revolves around:
1. **Collecting** medical data from multiple sources
2. **Analyzing** data using AI (Claude/Gemini)
3. **Storing** data in 198 specialized collections
4. **Delivering** insights to various stakeholders

## Data Flow Architecture

### 1. DATA INPUT SOURCES

#### A. Document Upload & Analysis
- **Service**: `documentAnalysisService.js` + `claudeBatchProcessor.js`
- **Process**: Documents → Claude AI → 21 extracted fields → Multiple collections
- **Collections Updated**: 
  - Direct mappings from 21 fields to ~20 collections
  - Category-specific collection (1 of 198)
  - Patient record updates

#### B. Direct API Inputs
- **Medication Entry**: `medicationPrescriptionService.js` → `medications` collection
- **Lab Results**: Via API → `lab_results` collection
- **Vital Signs**: Manual/Device input → `vital_signs` collection
- **Appointments**: `calendarSyncService.js` → `appointments` collection

#### C. Integration Sources
- **HL7/FHIR**: `stediHealthcareService.js` → Multiple collections
- **Medicare/Medicaid**: `medicareQualityService.js`, `medicaidChipService.js`
- **Insurance**: `insuranceService.js` → Claims/coverage collections
- **Pharmacy**: External → `medications`, `prescriptions` collections

### 2. DATA STORAGE (198 Collections)

#### Core Medical Collections (20)
| Collection | Data Source | Consumer |
|------------|-------------|----------|
| `allergies` | Documents, Direct entry | Doctors, Nurses, Emergency |
| `diagnoses` | Documents, Doctor input | Insurance, Analytics |
| `medications` | Prescriptions, Pharmacy | Pharmacy, Nurses, Insurance |
| `lab_results` | Labs, Documents | Doctors, Specialists |
| `vital_signs` | Nurses, Devices | Doctors, Alerts |
| `imaging_reports` | Radiology, Documents | Radiologists, Doctors |
| `procedures` | OR, Documents | Billing, Insurance |
| `vaccination_records` | Documents, CDC | Public Health, Schools |
| `prescriptions` | Doctors | Pharmacy, Insurance |
| `consultation_notes` | Doctors | Specialists, Legal |
| `discharge_summaries` | Hospital | Primary Care, Insurance |
| `referrals` | Doctors | Specialists, Insurance |
| `appointments` | Scheduling | All staff |
| `medical_alerts` | System | Emergency, All staff |
| `recommendations` | AI, Doctors | Patients, Doctors |
| `follow_ups` | Doctors | Nurses, Scheduling |
| `medical_certificates` | Doctors | Employers, Schools |
| `admission_assessments` | ER/Hospital | Doctors, Nurses |
| `goals_of_care_discussions` | Clinical | ICU, Palliative Care |
| `abnormal_results` | Labs, AI | Doctors (URGENT) |

#### Specialty Collections (178)
- **Cardiology** (8): ECG, Echo, Stress tests, Cath reports
- **Neurology** (5): EEG, EMG, Neuropsych assessments
- **Oncology** (7): Chemo records, Radiation, Tumor markers
- **Pediatrics** (7): Growth charts, APGAR, Developmental
- **Surgery** (5): Pre-op, Post-op, Anesthesia records
- **Emergency** (7): Trauma sheets, Code blue, EMS reports
- **And 140+ more...**

### 3. DATA PROCESSING & ANALYSIS

#### AI Services
| Service | Function | Input | Output |
|---------|----------|-------|--------|
| `agentServiceV4.js` | Main AI orchestrator | Chat, Documents | Insights, Recommendations |
| `claudeBatchProcessor.js` | Batch document analysis | Multiple docs | Extracted data (21 fields) |
| `predictiveAnalyticsAIService.js` | Risk prediction | Historical data | Risk scores |
| `drugInteractionService.js` | Medication safety | Medication list | Interaction warnings |
| `allergyChecker.js` | Allergy alerts | Medications + Allergies | Safety warnings |
| `vitalSignsAnalyzer.js` | Vital sign trends | Vital signs history | Anomaly detection |
| `labResultInterpreter.js` | Lab analysis | Lab results | Clinical interpretation |

#### Analytics Services
| Service | Function | Consumer |
|---------|----------|----------|
| `clinicalAnalyticsService.js` | Clinical outcomes | Doctors, Admin |
| `operationalEfficiencyMetricsService.js` | Efficiency metrics | Management |
| `financialReportingService.js` | Financial analysis | Finance, Insurance |
| `complianceAnalyticsService.js` | Compliance tracking | Legal, Admin |
| `patientPopulationAnalyticsService.js` | Population health | Public Health |
| `providerPerformanceAnalyticsService.js` | Provider metrics | Management |
| `qualityMetricsService.js` | Quality measures | Accreditation |
| `benchmarkingAnalysisService.js` | Performance comparison | Management |

### 4. DATA CONSUMERS & OUTPUTS

#### By Role

**Doctors**
- Real-time patient data from all 198 collections
- AI insights and recommendations
- Drug interactions, allergy alerts
- Lab interpretations
- Imaging reports
- Patient history visualization

**Nurses**
- Vital signs monitoring
- Medication administration records
- Care plans
- Alert notifications
- Patient education materials

**Lab Managers**
- Lab result management
- Abnormal result tracking
- Quality control metrics
- Turnaround time analytics

**Specialists**
- Specialty-specific collections (Cardiology, Neurology, etc.)
- Referral management
- Consultation history
- Procedure outcomes

**Insurance Companies**
- Claims data
- Diagnoses (ICD codes)
- Procedures (CPT codes)
- Medication costs
- Pre-authorization data
- Compliance reports

**Finance Department**
- Billing data
- Revenue cycle analytics
- Cost tracking
- Insurance reimbursements
- Financial reports

**Hospital Administration**
- Operational metrics
- Quality indicators
- Compliance status
- Performance dashboards
- Resource utilization

**Pharmacy**
- Prescription management
- Drug interaction checks
- Formulary compliance
- Medication history

**Emergency Department**
- Medical alerts
- Allergies
- Critical medications
- Recent procedures
- Advanced directives

### 5. KEY DATA FLOWS

#### Document Upload Flow
```
Document Upload → Claude AI Analysis
    ↓
21 Field Extraction
    ↓
Distribution to Collections:
├─→ medications → medications collection
├─→ allergies → allergies collection
├─→ diagnoses → diagnoses collection
├─→ lab results → lab_results collection
├─→ procedures → medical_procedures collection
├─→ vital signs → vital_signs collection
├─→ imaging → imaging_reports collection
├─→ category → Specific specialty collection (1 of 198)
└─→ patient record → Update patient summary
    ↓
Notifications:
├─→ Abnormal results → Doctor alert
├─→ Drug interactions → Pharmacy alert
└─→ Critical values → Emergency alert
```

#### Real-time Analytics Flow
```
Data Changes in Collections
    ↓
Event Triggers
    ↓
Analytics Services:
├─→ predictiveAnalyticsService → Risk scores
├─→ realtimeAnalyticsService → Live dashboards
├─→ drugInteractionService → Safety alerts
└─→ vitalSignsAnalyzer → Trend analysis
    ↓
Outputs:
├─→ WebSocket → Real-time UI updates
├─→ SMS/Email → Critical alerts
├─→ Dashboard → Management views
└─→ Reports → Scheduled summaries
```

### 6. SECURITY & COMPLIANCE LAYER

All data flows through:
- `SecureDataAccess` service (HIPAA compliance)
- `phiAnonymizationService` (De-identification)
- `encryptionService` (At-rest encryption)
- `auditService` (Complete audit trail)
- `consentManagementService` (Patient consent)
- `rbacService` (Role-based access)

### 7. SUMMARY

**Total Collections**: 198
**Total Services**: 188+
**AI Extraction Fields**: 21
**Supported Roles**: 10+
**Integration Points**: 15+

The platform is a comprehensive medical data ecosystem that:
1. Accepts data from multiple sources
2. Uses AI to extract and analyze information
3. Stores data in specialized collections for optimal access
4. Delivers role-specific insights to all stakeholders
5. Maintains strict security and compliance

This architecture enables the platform to handle millions of documents while providing instant, relevant insights to each user type.