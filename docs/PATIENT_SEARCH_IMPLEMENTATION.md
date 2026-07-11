# Patient Search System - Complete Implementation Guide

## 🔴 CRITICAL: Functions to Remove/Fix First

### 1. Remove These Functions Completely:
- `searchPatientsByCondition` - Replace with new universal search
- `getPatientsWithMedicalDataSummary` - We just added this, remove it
- Any function that returns full medical data in search results

### 2. Fix `listAllPatients`:
- Already has projection for minimal fields (firstName, lastName, SSN/ID)
- Keep this fix, just ensure it's enforced everywhere
- Add pagination if not already present (max 100 patients per call)

## 🟢 New Implementation Architecture

### Core Principles:
1. **Search functions return WHO, not WHAT** - Only names and IDs
2. **Never return unlimited results** - Always paginate (50-100 max)
3. **Medical data stays in specialized collections** - Not on patient records
4. **Support both multi-criteria AND progressive filtering**

## 📁 Database Architecture (After Cleanup)

### Collections Structure:
```
patients/              - Basic patient info (name, DOB, address, SSN/ID)
  ├── NO medical data fields anymore
  └── Only demographic data

documents/             - Uploaded documents (PDFs, images)
  └── Links to patients via patientId

diagnoses/            - All diagnoses with patientId
medications/          - All medications with patientId
allergies/           - All allergies with patientId
lab_results/         - All lab results with patientId
vital_signs/         - All vital signs with patientId
medical_procedures/  - All procedures with patientId
[... 15+ more medical collections ...]
```

## 🔧 Implementation Details

### 1. Universal Patient Search Service

```javascript
// File: /apps/backend-api/services/patientSearchService.js

class PatientSearchService {
  constructor() {
    // Store search context for progressive filtering
    this.searchContexts = new Map(); // sessionId -> context
  }

  /**
   * MAIN SEARCH FUNCTION - Handles all patient searches
   * Returns ONLY: patientId, firstName, lastName, identifier, remark
   */
  async searchPatientsUniversal(params, sessionId) {
    const {
      // Medical criteria
      medicalConditions = [],     // ["diabetes", "hypertension"]
      medications = [],            // ["metformin", "insulin"]
      allergies = [],              // ["penicillin", "peanuts"]

      // Demographic criteria
      ageRange = null,            // { min: 65, max: 80 }
      gender = null,              // "Male" | "Female"

      // Geographic criteria
      location = null,            // { city: "San Jose", state: "CA", zipCode: "95110" }

      // Administrative criteria
      insurance = null,           // "Medicare" | "Blue Cross"
      provider = null,            // "Dr. Smith"

      // Pagination
      page = 1,
      batchSize = 50,             // Max 100

      // Search mode
      mode = 'fresh'              // 'fresh' | 'progressive'
    } = params;

    // Enforce max batch size
    const effectiveBatchSize = Math.min(batchSize, 100);

    if (mode === 'progressive' && this.searchContexts.has(sessionId)) {
      return await this.progressiveFilter(params, sessionId, page, effectiveBatchSize);
    } else {
      return await this.freshSearch(params, sessionId, page, effectiveBatchSize);
    }
  }

  /**
   * Fresh search - applies all criteria at once
   */
  async freshSearch(criteria, sessionId, page, batchSize) {
    let patientIdSets = [];

    // Step 1: Search medical collections if medical criteria provided
    if (criteria.medicalConditions?.length > 0) {
      const diagnosisIds = await this.searchDiagnoses(criteria.medicalConditions);
      patientIdSets.push(new Set(diagnosisIds));
    }

    if (criteria.medications?.length > 0) {
      const medicationIds = await this.searchMedications(criteria.medications);
      patientIdSets.push(new Set(medicationIds));
    }

    if (criteria.allergies?.length > 0) {
      const allergyIds = await this.searchAllergies(criteria.allergies);
      patientIdSets.push(new Set(allergyIds));
    }

    // Step 2: Build patient collection filter
    const patientFilter = this.buildPatientFilter(criteria);

    // Step 3: Intersect medical results with patient filter
    if (patientIdSets.length > 0) {
      // Get intersection of all medical criteria
      const intersectedIds = patientIdSets.reduce((a, b) =>
        new Set([...a].filter(x => b.has(x)))
      );

      // Add to patient filter
      patientFilter._id = { $in: Array.from(intersectedIds) };
    }

    // Step 4: Get total count
    const totalCount = await SecureDataAccess.count('patients', patientFilter);

    // Step 5: Get paginated results (MINIMAL FIELDS ONLY)
    const skip = (page - 1) * batchSize;
    const patients = await SecureDataAccess.query('patients',
      patientFilter,
      {
        skip: skip,
        limit: batchSize,
        projection: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          nationalId: 1,
          socialSecurityNumber: 1,
          city: 1,              // For remark
          dateOfBirth: 1        // For age calculation in remark
        },
        sort: { lastName: 1, firstName: 1 }
      }
    );

    // Step 6: Store context for potential progressive filtering
    this.searchContexts.set(sessionId, {
      baseFilter: patientFilter,
      appliedCriteria: criteria,
      totalCount: totalCount,
      timestamp: Date.now()
    });

    // Step 7: Format response with remarks
    const results = patients.map(p => ({
      patientId: p._id,
      name: `${p.firstName} ${p.lastName}`,
      identifier: p.nationalId || p.socialSecurityNumber || 'N/A',
      remark: this.buildRemark(p, criteria)
    }));

    return {
      success: true,
      data: results,
      pagination: {
        page: page,
        batchSize: batchSize,
        totalCount: totalCount,
        totalPages: Math.ceil(totalCount / batchSize),
        hasMore: totalCount > (skip + batchSize)
      },
      searchCriteria: criteria,
      searchMode: 'fresh',
      message: this.buildSearchMessage(totalCount, criteria, page, batchSize)
    };
  }

  /**
   * Progressive filtering - narrows previous results
   */
  async progressiveFilter(newCriteria, sessionId, page, batchSize) {
    const context = this.searchContexts.get(sessionId);
    if (!context) {
      throw new Error('No previous search found. Start with a fresh search.');
    }

    // Merge new criteria with existing
    const mergedCriteria = { ...context.appliedCriteria, ...newCriteria };

    // Apply fresh search with merged criteria
    const results = await this.freshSearch(mergedCriteria, sessionId, page, batchSize);

    // Add progressive context to response
    results.searchMode = 'progressive';
    results.previousCount = context.totalCount;
    results.narrowedBy = Object.keys(newCriteria);

    return results;
  }

  /**
   * Search medical collections
   */
  async searchDiagnoses(conditions) {
    const filter = {
      $or: conditions.map(c => ({
        $or: [
          { diagnosis: new RegExp(c, 'i') },
          { description: new RegExp(c, 'i') },
          { code: new RegExp(c, 'i') }
        ]
      }))
    };

    const results = await SecureDataAccess.query('diagnoses',
      filter,
      { projection: { patientId: 1 } }
    );

    return [...new Set(results.map(r => r.patientId))];
  }

  async searchMedications(meds) {
    const filter = {
      $or: meds.map(m => ({
        $or: [
          { name: new RegExp(m, 'i') },
          { genericName: new RegExp(m, 'i') }
        ]
      }))
    };

    const results = await SecureDataAccess.query('medications',
      filter,
      { projection: { patientId: 1 } }
    );

    return [...new Set(results.map(r => r.patientId))];
  }

  async searchAllergies(allergies) {
    const filter = {
      allergen: { $in: allergies.map(a => new RegExp(a, 'i')) }
    };

    const results = await SecureDataAccess.query('allergies',
      filter,
      { projection: { patientId: 1 } }
    );

    return [...new Set(results.map(r => r.patientId))];
  }

  /**
   * Build filter for patient collection
   */
  buildPatientFilter(criteria) {
    const filter = {};

    // Age range
    if (criteria.ageRange) {
      const today = new Date();
      const maxBirth = new Date(today.getFullYear() - criteria.ageRange.min, 0, 1);
      const minBirth = new Date(today.getFullYear() - criteria.ageRange.max - 1, 11, 31);

      filter.dateOfBirth = {
        $gte: minBirth,
        $lte: maxBirth
      };
    }

    // Location
    if (criteria.location) {
      if (criteria.location.city) {
        filter.city = new RegExp(criteria.location.city, 'i');
      }
      if (criteria.location.state) {
        filter.state = criteria.location.state;
      }
      if (criteria.location.zipCode) {
        filter.zipCode = criteria.location.zipCode;
      }
    }

    // Gender
    if (criteria.gender) {
      filter.gender = criteria.gender;
    }

    // Insurance
    if (criteria.insurance) {
      filter.insuranceProvider = new RegExp(criteria.insurance, 'i');
    }

    return filter;
  }

  /**
   * Build smart remark for each patient
   */
  buildRemark(patient, criteria) {
    const remarks = [];

    // Age (if we have DOB)
    if (patient.dateOfBirth) {
      const age = Math.floor((Date.now() - new Date(patient.dateOfBirth)) / 31536000000);
      remarks.push(`Age ${age}`);
    }

    // Location
    if (patient.city) {
      remarks.push(patient.city);
    }

    // Medical conditions (from search criteria, not data)
    if (criteria.medicalConditions?.length > 0) {
      if (criteria.medicalConditions.length === 1) {
        remarks.push(`Has ${criteria.medicalConditions[0]}`);
      } else {
        remarks.push(`Has ${criteria.medicalConditions.length} conditions`);
      }
    }

    return remarks.join(' • ') || 'Matches criteria';
  }

  /**
   * Build user-friendly search message
   */
  buildSearchMessage(count, criteria, page, batchSize) {
    if (count === 0) {
      return 'No patients found matching the criteria';
    }

    const criteriaList = [];
    if (criteria.medicalConditions?.length) {
      criteriaList.push(`conditions: ${criteria.medicalConditions.join(', ')}`);
    }
    if (criteria.ageRange) {
      criteriaList.push(`age ${criteria.ageRange.min}-${criteria.ageRange.max}`);
    }
    if (criteria.location?.city) {
      criteriaList.push(`in ${criteria.location.city}`);
    }

    const showing = count <= batchSize
      ? `Showing all ${count}`
      : `Showing ${((page-1)*batchSize)+1}-${Math.min(page*batchSize, count)} of ${count}`;

    return `${showing} patients${criteriaList.length ? ' with ' + criteriaList.join(', ') : ''}`;
  }

  /**
   * Clear search context (call on session end)
   */
  clearContext(sessionId) {
    this.searchContexts.delete(sessionId);
  }
}

module.exports = PatientSearchService;
```

### 2. Update Agent Service (agentServiceV4.js)

```javascript
// REMOVE these functions:
// - searchPatientsByCondition
// - getPatientsWithMedicalDataSummary

// ADD new function:
async searchPatients(params, practiceContext, session) {
  const searchService = new PatientSearchService();

  // Parse natural language or use structured params
  const criteria = this.parseSearchCriteria(params);

  // Detect if progressive or fresh
  const mode = this.detectSearchMode(params, session);

  // Execute search
  const results = await searchService.searchPatientsUniversal(
    { ...criteria, mode },
    session.id
  );

  return results;
}

// Helper to detect search intent
detectSearchMode(params, session) {
  const progressiveKeywords = [
    'filter', 'narrow', 'from those', 'of these',
    'additionally', 'also', 'further'
  ];

  const query = params.query || params.text || '';
  const isProgressive = progressiveKeywords.some(k =>
    query.toLowerCase().includes(k)
  );

  return isProgressive && session.lastSearch ? 'progressive' : 'fresh';
}
```

### 3. Update Function Definitions

```javascript
// In getMinimalFunctionsForClaude()

// REMOVE:
{
  name: "searchPatientsByCondition",
  // ...
}

// ADD:
{
  name: "searchPatients",
  description: isHebrew
    ? "חיפוש מטופלים לפי קריטריונים מרובים (מחזיר שמות ותעודות זהות בלבד)"
    : "Search patients by multiple criteria (returns names and IDs only)",
  parameters: {
    type: "object",
    properties: {
      medicalConditions: {
        type: "array",
        items: { type: "string" },
        description: "Medical conditions to search for"
      },
      ageRange: {
        type: "object",
        properties: {
          min: { type: "number" },
          max: { type: "number" }
        }
      },
      location: {
        type: "object",
        properties: {
          city: { type: "string" },
          state: { type: "string" },
          zipCode: { type: "string" }
        }
      },
      gender: {
        type: "string",
        enum: ["Male", "Female"]
      },
      page: {
        type: "number",
        default: 1
      },
      batchSize: {
        type: "number",
        default: 50,
        maximum: 100
      },
      mode: {
        type: "string",
        enum: ["fresh", "progressive"],
        description: "Search mode - fresh starts new, progressive filters previous"
      }
    },
    required: []
  }
}
```

### 4. Natural Language Processing

```javascript
// File: /apps/backend-api/services/searchQueryParser.js

class SearchQueryParser {
  parsePatientSearch(query) {
    const criteria = {};

    // Medical conditions
    const conditions = this.extractMedicalConditions(query);
    if (conditions.length) criteria.medicalConditions = conditions;

    // Age parsing
    const agePatterns = [
      /age[d]?\s+(\d+)\s*[-to]+\s*(\d+)/i,
      /(\d+)\s*[-to]+\s*(\d+)\s*years?\s*old/i,
      /between\s+(\d+)\s+and\s+(\d+)/i
    ];

    for (const pattern of agePatterns) {
      const match = query.match(pattern);
      if (match) {
        criteria.ageRange = {
          min: parseInt(match[1]),
          max: parseInt(match[2])
        };
        break;
      }
    }

    // Location parsing
    const cityMatch = query.match(/in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    if (cityMatch) {
      criteria.location = { city: cityMatch[1] };
    }

    // Gender
    if (/\bmale\b|\bmen\b/i.test(query)) {
      criteria.gender = 'Male';
    } else if (/\bfemale\b|\bwomen\b/i.test(query)) {
      criteria.gender = 'Female';
    }

    return criteria;
  }

  extractMedicalConditions(query) {
    // This would use a medical condition dictionary/NLP
    const commonConditions = [
      'diabetes', 'hypertension', 'leukemia', 'cancer',
      'asthma', 'copd', 'heart disease', 'kidney disease'
    ];

    const found = [];
    for (const condition of commonConditions) {
      if (query.toLowerCase().includes(condition)) {
        found.push(condition);
      }
    }

    return found;
  }
}
```

## 🎯 Testing Scenarios

### Test 1: Simple Medical Search
```
Input: "Show patients with diabetes"
Expected: Returns first 50 patients with diabetes (names only)
```

### Test 2: Multi-Criteria Search
```
Input: "Show patients with diabetes and hypertension, aged 65-75, in San Jose"
Expected: Returns patients matching ALL criteria (paginated)
```

### Test 3: Progressive Filtering
```
Step 1: "Show patients with cancer"
Result: 500 patients
Step 2: "Now filter those aged 60-70"
Result: 120 patients (subset)
Step 3: "Now only females"
Result: 65 patients (further subset)
```

### Test 4: Large Result Set
```
Input: "Show all patients with medical data"
Expected: Returns first 50 with pagination info "Showing 1-50 of 10,000"
```

## ⚠️ Critical Reminders

1. **NEVER** return medical data in search results
2. **ALWAYS** paginate (max 100, default 50)
3. **REMOVE** old functions that return full data
4. **TEST** with large datasets to ensure no token overflow
5. **MAINTAIN** search context for progressive filtering

## 📊 Performance Considerations

1. **Index these fields** in MongoDB:
   - patients: city, state, dateOfBirth, gender, insuranceProvider
   - diagnoses: diagnosis, patientId
   - medications: name, genericName, patientId
   - allergies: allergen, patientId

2. **Cache common searches**:
   - "patients with diabetes" (very common)
   - "patients in [major city]"
   - Clear cache when new documents analyzed

3. **Session cleanup**:
   - Clear search contexts after 30 minutes
   - Limit context storage to prevent memory leaks

## 🚀 Implementation Steps

1. **Phase 1**: Remove old functions
   - Delete searchPatientsByCondition
   - Delete getPatientsWithMedicalDataSummary
   - Ensure listAllPatients has projection

2. **Phase 2**: Implement PatientSearchService
   - Create new service file
   - Implement universal search
   - Add progressive filtering

3. **Phase 3**: Update Agent
   - Add new searchPatients function
   - Update function definitions
   - Add natural language parsing

4. **Phase 4**: Testing
   - Test with empty database
   - Test with 10,000+ patients
   - Test token limits
   - Test progressive filtering

5. **Phase 5**: Optimization
   - Add indexes
   - Implement caching
   - Monitor performance

---

**SAVED FOR IMPLEMENTATION AFTER RESTART**
This file contains everything needed to implement the new patient search system.
Remember: Search returns WHO, not WHAT!