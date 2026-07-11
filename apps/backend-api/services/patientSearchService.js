const SecureDataAccess = require('./secureDataAccess');
const PracticeContextNormalizer = require('./practiceContextNormalizer');
const serviceAccountManager = require('./serviceAccountManager');

class PatientSearchService {
  constructor() {
    this.searchContexts = new Map();
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Authenticate as patient-search-service
      this.serviceToken = await serviceAccountManager.authenticate('patient-search-service');
      if (this.serviceToken) {
        console.log('✅ PatientSearchService authenticated');
        this.initialized = true;
      } else {
        throw new Error('Failed to authenticate PatientSearchService');
      }
    } catch (error) {
      console.error('❌ PatientSearchService authentication failed:', error.message);
      throw error;
    }
  }

  async searchPatientsUniversal(params, sessionId, practiceContext) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }
    const {
      medicalConditions = [],
      medications = [],
      allergies = [],
      ageRange = null,
      gender = null,
      location = null,
      insurance = null,
      provider = null,
      page = 1,
      batchSize = 50,
      mode = 'fresh'
    } = params;

    const effectiveBatchSize = Math.min(batchSize, 100);

    if (mode === 'progressive' && this.searchContexts.has(sessionId)) {
      return await this.progressiveFilter(params, sessionId, page, effectiveBatchSize, practiceContext);
    } else {
      return await this.freshSearch(params, sessionId, page, effectiveBatchSize, practiceContext);
    }
  }

  async freshSearch(criteria, sessionId, page, batchSize, practiceContext) {
    try {
      const context = PracticeContextNormalizer.createSecureContext(
        { ...practiceContext, apiKey: this.serviceToken?.apiKey || this.serviceToken },
        'searchPatients',
        'patient-search-service'
      );

      let patientIdSets = [];

      if (criteria.medicalConditions?.length > 0) {
        const diagnosisIds = await this.searchDiagnoses(criteria.medicalConditions, context);
        patientIdSets.push(new Set(diagnosisIds));
      }

      if (criteria.medications?.length > 0) {
        const medicationIds = await this.searchMedications(criteria.medications, context);
        patientIdSets.push(new Set(medicationIds));
      }

      if (criteria.allergies?.length > 0) {
        const allergyIds = await this.searchAllergies(criteria.allergies, context);
        patientIdSets.push(new Set(allergyIds));
      }

      const patientFilter = this.buildPatientFilter(criteria);

      if (patientIdSets.length > 0) {
        const intersectedIds = patientIdSets.reduce((a, b) =>
          new Set([...a].filter(x => b.has(x)))
        );

        patientFilter._id = { $in: Array.from(intersectedIds) };
      }

      // Get total count by querying all matching patients (with projection for efficiency)
      const allMatchingPatients = await SecureDataAccess.query('patients',
        patientFilter,
        { projection: { _id: 1 } },
        context
      );
      const totalCount = allMatchingPatients.length;

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
            city: 1,
            dateOfBirth: 1
          },
          sort: { lastName: 1, firstName: 1 }
        },
        context
      );

      this.searchContexts.set(sessionId, {
        baseFilter: patientFilter,
        appliedCriteria: criteria,
        totalCount: totalCount,
        timestamp: Date.now()
      });

      this.cleanupOldContexts();

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
        message: this.buildSearchMessage(totalCount, criteria, page, batchSize, practiceContext.language === 'he')
      };
    } catch (error) {
      console.error('Error in fresh search:', error);
      throw error;
    }
  }

  async progressiveFilter(newCriteria, sessionId, page, batchSize, practiceContext) {
    const context = this.searchContexts.get(sessionId);
    if (!context) {
      throw new Error('No previous search found. Start with a fresh search.');
    }

    const mergedCriteria = { ...context.appliedCriteria, ...newCriteria };

    const results = await this.freshSearch(mergedCriteria, sessionId, page, batchSize, practiceContext);

    results.searchMode = 'progressive';
    results.previousCount = context.totalCount;
    results.narrowedBy = Object.keys(newCriteria);

    return results;
  }

  async searchDiagnoses(conditions, context) {
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
      { projection: { patientId: 1 } },
      context
    );

    return [...new Set(results.map(r => r.patientId))];
  }

  async searchMedications(meds, context) {
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
      { projection: { patientId: 1 } },
      context
    );

    return [...new Set(results.map(r => r.patientId))];
  }

  async searchAllergies(allergies, context) {
    const filter = {
      allergen: { $in: allergies.map(a => new RegExp(a, 'i')) }
    };

    const results = await SecureDataAccess.query('allergies',
      filter,
      { projection: { patientId: 1 } },
      context
    );

    return [...new Set(results.map(r => r.patientId))];
  }

  buildPatientFilter(criteria) {
    const filter = {};

    // Handle name/ID search
    if (criteria.name || criteria.query) {
      const searchQuery = criteria.name || criteria.query;
      filter.$or = [
        { firstName: new RegExp(searchQuery.split(' ')[0], 'i') },
        { lastName: new RegExp(searchQuery.split(' ').slice(-1)[0], 'i') },
        {
          $and: [
            { firstName: new RegExp(searchQuery.split(' ')[0], 'i') },
            { lastName: new RegExp(searchQuery.split(' ').slice(1).join(' '), 'i') }
          ]
        },
        // Also search by SSN and National ID (exact match)
        { socialSecurityNumber: searchQuery },
        { nationalId: searchQuery }
      ];
    }

    if (criteria.ageRange) {
      const today = new Date();
      const maxBirth = new Date(today.getFullYear() - criteria.ageRange.min, 0, 1);
      const minBirth = new Date(today.getFullYear() - criteria.ageRange.max - 1, 11, 31);

      filter.dateOfBirth = {
        $gte: minBirth,
        $lte: maxBirth
      };
    }

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

    if (criteria.gender) {
      filter.gender = criteria.gender;
    }

    if (criteria.insurance) {
      filter.insuranceProvider = new RegExp(criteria.insurance, 'i');
    }

    return filter;
  }

  buildRemark(patient, criteria) {
    const remarks = [];

    if (patient.dateOfBirth) {
      const age = Math.floor((Date.now() - new Date(patient.dateOfBirth)) / 31536000000);
      remarks.push(`Age ${age}`);
    }

    if (patient.city) {
      remarks.push(patient.city);
    }

    if (criteria.medicalConditions?.length > 0) {
      if (criteria.medicalConditions.length === 1) {
        remarks.push(`Has ${criteria.medicalConditions[0]}`);
      } else {
        remarks.push(`Has ${criteria.medicalConditions.length} conditions`);
      }
    }

    return remarks.join(' • ') || 'Matches criteria';
  }

  buildSearchMessage(count, criteria, page, batchSize, isHebrew) {
    if (count === 0) {
      return isHebrew ? 'לא נמצאו מטופלים התואמים לקריטריונים' : 'No patients found matching the criteria';
    }

    const criteriaList = [];
    if (criteria.medicalConditions?.length) {
      criteriaList.push(isHebrew
        ? `מצבים: ${criteria.medicalConditions.join(', ')}`
        : `conditions: ${criteria.medicalConditions.join(', ')}`);
    }
    if (criteria.medications?.length) {
      criteriaList.push(isHebrew
        ? `תרופות: ${criteria.medications.join(', ')}`
        : `medications: ${criteria.medications.join(', ')}`);
    }
    if (criteria.ageRange) {
      criteriaList.push(isHebrew
        ? `גיל ${criteria.ageRange.min}-${criteria.ageRange.max}`
        : `age ${criteria.ageRange.min}-${criteria.ageRange.max}`);
    }
    if (criteria.location?.city) {
      criteriaList.push(isHebrew
        ? `ב${criteria.location.city}`
        : `in ${criteria.location.city}`);
    }

    const showing = count <= batchSize
      ? isHebrew ? `מוצגים כל ${count}` : `Showing all ${count}`
      : isHebrew
        ? `מוצגים ${((page-1)*batchSize)+1}-${Math.min(page*batchSize, count)} מתוך ${count}`
        : `Showing ${((page-1)*batchSize)+1}-${Math.min(page*batchSize, count)} of ${count}`;

    const withCriteria = criteriaList.length
      ? isHebrew
        ? ' עם ' + criteriaList.join(', ')
        : ' with ' + criteriaList.join(', ')
      : '';

    return isHebrew
      ? `${showing} מטופלים${withCriteria}`
      : `${showing} patients${withCriteria}`;
  }

  cleanupOldContexts() {
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    for (const [sessionId, context] of this.searchContexts) {
      if (context.timestamp < thirtyMinutesAgo) {
        this.searchContexts.delete(sessionId);
      }
    }
  }

  clearContext(sessionId) {
    this.searchContexts.delete(sessionId);
  }
}

module.exports = PatientSearchService;