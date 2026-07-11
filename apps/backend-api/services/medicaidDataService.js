/**
 * Medicaid Data Service
 * Integrates with CMS data.medicaid.gov DKAN API
 * Provides Medicaid/CHIP enrollment data and State Drug Utilization Data (SDUD)
 *
 * API: https://data.medicaid.gov (FREE, no API key required)
 * Rate Limit: ~1000 requests/hour (unauthenticated)
 * Data Format: DKAN 2 Datastore API (JSON)
 */

const axios = require('axios');
const https = require('https');
const NodeCache = require('node-cache');
const serviceAccountManager = require('./serviceAccountManager');

// Dataset IDs on data.medicaid.gov (DKAN format)
const DATASETS = {
  // Medicaid & CHIP enrollment, applications, eligibility determinations
  enrollment: '6165f45b-ca93-5bb5-9d06-db29c692a360',
  // New Adult Group enrollment (Medicaid expansion)
  newAdultGroup: '6c114b2c-cb83-559b-832f-4d8b06d6c1b9',
  // Managed Care Enrollment by Program and Plan
  managedCare: '0bef7b8a-c663-5b14-9a46-0b5c2b86b0fe',
  // State Drug Utilization Data by year (most recent available)
  sdud2020: 'cc318bfb-a9b2-55f3-a924-d47376b32ea3',
  sdud2019: 'daba7980-e219-5996-9bec-90358fd156f1',
  sdud2018: 'a1f3598e-fc71-51aa-8560-78e7e1a61b09',
};

// Map year to SDUD dataset ID
const SDUD_BY_YEAR = {
  2020: DATASETS.sdud2020,
  2019: DATASETS.sdud2019,
  2018: DATASETS.sdud2018,
};

class MedicaidDataService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    // 1-hour cache - enrollment data is monthly/quarterly
    this.cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
    this.baseUrl = 'https://data.medicaid.gov/api/1/datastore/query';
  }

  async initialize() {
    if (this.initialized) return;
    try {
      this.serviceToken = await serviceAccountManager.authenticate('medicaid-data-service');
      // Create axios instance with IPv4 preference (avoids IPv6 connectivity issues)
      this.client = axios.create({
        baseURL: this.baseUrl,
        timeout: 15000,
        httpsAgent: new https.Agent({ family: 4 }),
        headers: { 'Accept': 'application/json' }
      });
      this.initialized = true;
      console.log('✅ Medicaid Data Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Medicaid Data Service:', error);
      throw error;
    }
  }

  /**
   * Query DKAN datastore API
   * @param {string} datasetId - DKAN dataset identifier
   * @param {Object} conditions - Query conditions [{property, value, operator}]
   * @param {Object} options - limit, offset, sort
   */
  async queryDataset(datasetId, conditions = [], options = {}) {
    await this.initialize();

    const { limit = 50, offset = 0, sort } = options;
    const cacheKey = `medicaid:${datasetId}:${JSON.stringify(conditions)}:${limit}:${offset}`;

    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      // Build DKAN query URL
      let url = `${this.baseUrl}/${datasetId}/0?limit=${limit}&offset=${offset}`;

      // Add conditions
      conditions.forEach((cond, i) => {
        url += `&conditions[${i}][property]=${encodeURIComponent(cond.property)}`;
        url += `&conditions[${i}][value]=${encodeURIComponent(cond.value)}`;
        if (cond.operator) {
          url += `&conditions[${i}][operator]=${encodeURIComponent(cond.operator)}`;
        }
      });

      // Add sort
      if (sort) {
        url += `&sorts[0][property]=${encodeURIComponent(sort.property)}`;
        url += `&sorts[0][order]=${sort.order || 'desc'}`;
      }

      const response = await this.client.get(url);

      const result = {
        results: response.data?.results || [],
        count: response.data?.count || 0,
        query: { datasetId, conditions, limit, offset },
        source: 'CMS data.medicaid.gov'
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`❌ Medicaid Data API error for dataset ${datasetId}:`, error.message);
      return {
        results: [],
        count: 0,
        query: { datasetId, conditions, limit, offset },
        error: error.message,
        source: 'CMS data.medicaid.gov'
      };
    }
  }

  /**
   * Get Medicaid/CHIP enrollment data for a state
   * Returns: total enrollment, child enrollment, CHIP, Medicaid, expansion status
   */
  async getMedicaidEnrollment(state, options = {}) {
    const { reportingPeriod } = options;

    const conditions = [];
    if (state) {
      conditions.push({ property: 'state_abbreviation', value: state.toUpperCase() });
    }
    if (reportingPeriod) {
      conditions.push({ property: 'reporting_period', value: reportingPeriod });
    }

    const sort = { property: 'reporting_period', order: 'desc' };
    const raw = await this.queryDataset(DATASETS.enrollment, conditions, {
      limit: options.limit || 12,
      sort
    });

    // Format results for readability
    const formatted = raw.results.map(r => ({
      state: r.state_name || r.state_abbreviation,
      stateAbbreviation: r.state_abbreviation,
      reportingPeriod: r.reporting_period,
      expandedMedicaid: r.state_expanded_medicaid === 'Y',
      finalReport: r.final_report === 'Y',
      totalMedicaidAndChipEnrollment: r.total_medicaid_and_chip_enrollment ? parseInt(r.total_medicaid_and_chip_enrollment) : null,
      totalMedicaidEnrollment: r.total_medicaid_enrollment ? parseInt(r.total_medicaid_enrollment) : null,
      totalChipEnrollment: r.total_chip_enrollment ? parseInt(r.total_chip_enrollment) : null,
      childEnrollment: r.medicaid_and_chip_child_enrollment ? parseInt(r.medicaid_and_chip_child_enrollment) : null,
      newApplications: r.new_applications_submitted_to_medicaid_and_chip_agencies ? parseInt(r.new_applications_submitted_to_medicaid_and_chip_agencies) : null,
      determinationsEligibleMedicaid: r.individuals_determined_eligible_for_medicaid_at_application ? parseInt(r.individuals_determined_eligible_for_medicaid_at_application) : null,
      determinationsEligibleChip: r.individuals_determined_eligible_for_chip_at_application ? parseInt(r.individuals_determined_eligible_for_chip_at_application) : null,
    }));

    return {
      results: formatted,
      count: raw.count,
      source: 'CMS data.medicaid.gov - Medicaid & CHIP Enrollment Data',
      note: raw.error ? `API error: ${raw.error}` : undefined
    };
  }

  /**
   * Get State Drug Utilization Data (SDUD) for a drug
   * Shows Medicaid prescribing patterns by state
   */
  async getMedicaidDrugUtilization(drugName, options = {}) {
    const { state, year = 2020 } = options;

    const datasetId = SDUD_BY_YEAR[year] || DATASETS.sdud2020;

    // Use LIKE with wildcards - SDUD product names have trailing spaces and
    // may include dosage forms (e.g., "TRULICITY " not "TRULICITY")
    const conditions = [
      { property: 'product_name', value: `%${drugName.toUpperCase()}%`, operator: 'LIKE' }
    ];
    if (state) {
      conditions.push({ property: 'state', value: state.toUpperCase() });
    }

    const sort = { property: 'number_of_prescriptions', order: 'desc' };
    const raw = await this.queryDataset(datasetId, conditions, {
      limit: options.limit || 20,
      sort
    });

    // Aggregate results by state for summary
    const byState = {};
    for (const r of raw.results) {
      const st = r.state;
      if (!byState[st]) {
        byState[st] = {
          state: st,
          productName: r.product_name,
          totalPrescriptions: 0,
          totalUnitsReimbursed: 0,
          totalAmountReimbursed: 0,
          medicaidAmountReimbursed: 0,
          quarters: []
        };
      }
      const prescriptions = parseInt(r.number_of_prescriptions) || 0;
      const units = parseFloat(r.units_reimbursed) || 0;
      const totalAmt = parseFloat(r.total_amount_reimbursed) || 0;
      const medicaidAmt = parseFloat(r.medicaid_amount_reimbursed) || 0;

      byState[st].totalPrescriptions += prescriptions;
      byState[st].totalUnitsReimbursed += units;
      byState[st].totalAmountReimbursed += totalAmt;
      byState[st].medicaidAmountReimbursed += medicaidAmt;
      byState[st].quarters.push({
        quarter: r.quarter,
        year: r.year,
        prescriptions,
        unitsReimbursed: units,
        totalAmountReimbursed: totalAmt,
        ndc: r.ndc
      });
    }

    const summary = Object.values(byState).sort((a, b) => b.totalPrescriptions - a.totalPrescriptions);

    return {
      drugName: drugName.toUpperCase(),
      year,
      results: summary,
      rawCount: raw.count,
      source: `CMS data.medicaid.gov - State Drug Utilization Data ${year}`,
      note: raw.error ? `API error: ${raw.error}` : undefined
    };
  }

  /**
   * Check Medicaid eligibility context for a state
   * Returns enrollment data and expansion status as a practical proxy
   */
  async checkMedicaidEligibility(state, options = {}) {
    const enrollment = await this.getMedicaidEnrollment(state, { limit: 1 });

    const latest = enrollment.results[0];
    if (!latest) {
      return {
        state: state?.toUpperCase(),
        available: false,
        message: `No enrollment data found for state: ${state}`,
        source: 'CMS data.medicaid.gov'
      };
    }

    return {
      state: latest.state,
      stateAbbreviation: latest.stateAbbreviation,
      expandedMedicaid: latest.expandedMedicaid,
      latestReportingPeriod: latest.reportingPeriod,
      totalEnrollment: latest.totalMedicaidAndChipEnrollment,
      medicaidEnrollment: latest.totalMedicaidEnrollment,
      chipEnrollment: latest.totalChipEnrollment,
      childEnrollment: latest.childEnrollment,
      note: 'This data shows state-level enrollment statistics. Individual eligibility depends on income, household size, age, disability status, and state-specific rules. Contact your state Medicaid agency for individual eligibility determination.',
      source: 'CMS data.medicaid.gov - Medicaid & CHIP Enrollment Data'
    };
  }
}

// Singleton export
const medicaidDataService = new MedicaidDataService();
module.exports = medicaidDataService;
