/**
 * Medicaid/CHIP Data Service
 * Integrates with state Medicaid programs and CHIP (Children's Health Insurance Program) data
 * Provides eligibility guidelines, managed care plans, provider networks, and state program information
 * 
 * APIs Used:
 * - Medicaid.gov State Plan Amendments API
 * - CMS State Medicaid & CHIP Profiles
 * - Healthcare.gov Medicaid Expansion Data
 * - State Medicaid Program APIs (where available)
 * - CHIP State Program Directory
 */

const axios = require('axios');

// Use lazy loading to resolve circular dependencies
function getServiceProxy() {
  const ServiceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  return ServiceProxyManager;
}

class MedicaidChipService {
  constructor() {
    this.initialized = false;
    this.serviceToken = null;
    this.apiKey = null; // CMS Medicaid API key
    this.baseUrls = {
      cms: 'https://data.cms.gov/api/1/datastore/query',
      medicaid: 'https://www.medicaid.gov/api/v1',
      healthcareGov: 'https://marketplace.api.healthcare.gov/api/v1'
    };
    
    // Dataset IDs for Medicaid/CHIP data
    this.datasetIds = {
      medicaidManagedCare: '7vyb-7c4s', // Medicaid Managed Care Enrollment
      medicaidExpansion: 'xa9c-f7eh', // Medicaid Expansion Status by State
      chipEnrollment: 'vnkh-jz7k', // CHIP Enrollment by State
      medicaidProviders: 'psaq-8nxx', // Medicaid Provider Data
      medicaidBeneficiaries: '6krx-fg7x', // Medicaid Beneficiaries by State
      stateProfiles: 'kqcq-8vqs' // State Medicaid & CHIP Profiles
    };
    
    // Federal Poverty Level guidelines for Medicaid eligibility (2025)
    this.fplGuidelines2025 = {
      contiguous48: {
        1: 15060, 2: 20440, 3: 25820, 4: 31200, 5: 36580,
        6: 41960, 7: 47340, 8: 52720
      },
      alaska: {
        1: 18810, 2: 25540, 3: 32270, 4: 39000, 5: 45730,
        6: 52460, 7: 59190, 8: 65920
      },
      hawaii: {
        1: 17310, 2: 23490, 3: 29670, 4: 35850, 5: 42030,
        6: 48210, 7: 54390, 8: 60570
      }
    };
    
    // Medicaid expansion status by state (as of 2025)
    this.medicaidExpansionStates = {
      expanded: [
        'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'HI', 'ID', 
        'IL', 'IN', 'IA', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 
        'MO', 'MT', 'NV', 'NH', 'NJ', 'NM', 'NY', 'ND', 'OH', 'OK',
        'OR', 'PA', 'RI', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI'
      ],
      nonExpanded: [
        'AL', 'FL', 'GA', 'KS', 'MS', 'NC', 'SC', 'SD', 'TN', 'TX', 'WY'
      ]
    };
    
    // CHIP income eligibility thresholds by state (percentage of FPL)
    this.chipIncomeThresholds = {
      'AL': 312, 'AK': 203, 'AZ': 200, 'AR': 200, 'CA': 200,
      'CO': 260, 'CT': 300, 'DE': 300, 'DC': 200, 'FL': 200,
      'GA': 200, 'HI': 300, 'ID': 190, 'IL': 309, 'IN': 250,
      'IA': 380, 'KS': 243, 'KY': 200, 'LA': 200, 'ME': 200,
      'MD': 300, 'MA': 300, 'MI': 200, 'MN': 275, 'MS': 200,
      'MO': 300, 'MT': 261, 'NE': 200, 'NV': 200, 'NH': 300,
      'NJ': 350, 'NM': 200, 'NY': 400, 'NC': 210, 'ND': 160,
      'OH': 200, 'OK': 200, 'OR': 300, 'PA': 200, 'RI': 257,
      'SC': 200, 'SD': 200, 'TN': 200, 'TX': 200, 'UT': 200,
      'VT': 312, 'VA': 200, 'WA': 312, 'WV': 300, 'WI': 300, 'WY': 200
    };
    
    // Common Medicaid managed care organization types
    this.mcoTypes = {
      'HMO': 'Health Maintenance Organization - Coordinated care model',
      'MCO': 'Managed Care Organization - Full-risk comprehensive care',
      'PIHP': 'Prepaid Inpatient Health Plan - Behavioral health focus',
      'PAHP': 'Prepaid Ambulatory Health Plan - Outpatient services',
      'PCCM': 'Primary Care Case Management - Enhanced primary care'
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      const proxy = getServiceProxy();
      
      // Get services via lazy loading
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      const productionKMS = proxy.getService('productionKMS');
      
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('medicaid-chip-service');
      
      // Get API keys from KMS
      this.apiKey = await productionKMS.getInternalKey('CMS_MEDICAID_API_KEY');
      this.healthcareGovKey = await productionKMS.getInternalKey('HEALTHCARE_GOV_API_KEY');
      
      this.initialized = true;
      console.log('Medicaid/CHIP Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Medicaid/CHIP Service:', error);
      throw new Error('Service initialization failed');
    }
  }

  /**
   * Check Medicaid eligibility for an individual/family
   * @param {Object} applicant - Applicant information
   * @param {string} applicant.state - State abbreviation
   * @param {number} applicant.householdIncome - Annual household income
   * @param {number} applicant.householdSize - Number in household
   * @param {number} applicant.age - Age of applicant
   * @param {boolean} applicant.pregnant - Pregnancy status
   * @param {boolean} applicant.disabled - Disability status
   * @param {Array} applicant.children - Array of children ages
   * @returns {Object} Eligibility determination
   */
  async checkMedicaidEligibility(applicant) {
    await this.initialize();
    
    try {
      const state = applicant.state.toUpperCase();
      const isExpansionState = this.medicaidExpansionStates.expanded.includes(state);
      
      // Get appropriate FPL based on state
      let fplGuidelines = this.fplGuidelines2025.contiguous48;
      if (state === 'AK') fplGuidelines = this.fplGuidelines2025.alaska;
      if (state === 'HI') fplGuidelines = this.fplGuidelines2025.hawaii;
      
      // Calculate Federal Poverty Level percentage
      const fplAmount = fplGuidelines[applicant.householdSize] || 
                       (fplGuidelines[8] + ((applicant.householdSize - 8) * 6380));
      const fplPercentage = Math.round((applicant.householdIncome / fplAmount) * 100);
      
      // Determine eligibility categories
      const eligibility = {
        medicaid: this.determineMedicaidEligibility(applicant, fplPercentage, isExpansionState),
        chip: this.determineCHIPEligibility(applicant, fplPercentage, state),
        other: this.determineOtherPrograms(applicant, fplPercentage, state)
      };
      
      // Get state-specific program information
      const statePrograms = await this.getStateMedicaidPrograms(state);
      
      // Use SecureDataAccess for audit logging
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      
      const auditContext = {
        serviceId: 'medicaid-chip-service',
        operation: 'MEDICAID_ELIGIBILITY_CHECK',
        practiceId: 'global'
      };
      
      await SecureDataAccess.create('audit_logs', {
        action: 'MEDICAID_ELIGIBILITY_CHECK',
        details: { state, fplPercentage, eligible: eligibility },
        timestamp: new Date(),
        serviceId: 'medicaid-chip-service'
      }, auditContext);
      
      return {
        success: true,
        data: {
          applicant: {
            state,
            householdSize: applicant.householdSize,
            householdIncome: applicant.householdIncome,
            fplPercentage,
            fplAmount
          },
          eligibility,
          statePrograms,
          nextSteps: this.generateNextSteps(eligibility),
          applicationResources: this.getApplicationResources(state),
          lastUpdated: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('Medicaid eligibility check failed:', error);
      return {
        success: false,
        error: 'Failed to check eligibility',
        details: error.message
      };
    }
  }

  /**
   * Get Medicaid managed care plans for a state
   * @param {string} state - State abbreviation
   * @param {Object} options - Search options
   * @returns {Object} Managed care plan information
   */
  async getMedicaidManagedCarePlans(state, options = {}) {
    await this.initialize();
    
    try {
      const stateCode = state.toUpperCase();
      
      // Query managed care enrollment data
      const response = await axios.get(this.baseUrls.cms, {
        params: {
          resource_id: this.datasetIds.medicaidManagedCare,
          sql: `SELECT * FROM "${this.datasetIds.medicaidManagedCare}" WHERE state = '${stateCode}'`,
          api_key: this.apiKey
        },
        headers: { 'User-Agent': 'IntelliCare/1.0 Medicaid/CHIP Service' }
      });
      
      const managedCarePlans = response.data.result?.records || [];
      
      // Enrich with additional plan details
      const enrichedPlans = await Promise.all(
        managedCarePlans.map(plan => this.enrichManagedCarePlan(plan))
      );
      
      // Get state-specific managed care information
      const stateInfo = await this.getStateManagedCareInfo(stateCode);
      
      return {
        success: true,
        data: {
          state: stateCode,
          managedCarePlans: enrichedPlans,
          stateInfo,
          planTypes: this.mcoTypes,
          enrollmentProcess: {
            description: 'Medicaid beneficiaries may be auto-enrolled or have choice of plans',
            choicePeriod: '90 days from initial enrollment',
            changesPeriod: 'Monthly with good cause or annually during open enrollment'
          },
          totalPlans: enrichedPlans.length
        }
      };
      
    } catch (error) {
      console.error('Managed care plans retrieval failed:', error);
      return {
        success: false,
        error: 'Failed to get managed care plans',
        details: error.message
      };
    }
  }

  /**
   * Get CHIP program information for a state
   * @param {string} state - State abbreviation
   * @param {Object} options - Additional options
   * @returns {Object} CHIP program details
   */
  async getCHIPProgramInfo(state, options = {}) {
    await this.initialize();
    
    try {
      const stateCode = state.toUpperCase();
      
      // Get CHIP enrollment data
      const enrollmentResponse = await axios.get(this.baseUrls.cms, {
        params: {
          resource_id: this.datasetIds.chipEnrollment,
          sql: `SELECT * FROM "${this.datasetIds.chipEnrollment}" WHERE state = '${stateCode}' ORDER BY year DESC LIMIT 5`,
          api_key: this.apiKey
        },
        headers: { 'User-Agent': 'IntelliCare/1.0 Medicaid/CHIP Service' }
      });
      
      const enrollmentData = enrollmentResponse.data.result?.records || [];
      
      // Get CHIP income threshold for state
      const incomeThreshold = this.chipIncomeThresholds[stateCode] || 200;
      
      // Calculate income eligibility for different family sizes
      const incomeEligibility = this.calculateCHIPIncomeEligibility(stateCode, incomeThreshold);
      
      return {
        success: true,
        data: {
          state: stateCode,
          programName: `${stateCode} CHIP`,
          incomeThreshold: `${incomeThreshold}% of Federal Poverty Level`,
          incomeEligibility,
          enrollmentHistory: enrollmentData,
          benefits: this.getCHIPBenefits(),
          applicationProcess: {
            online: true,
            phone: true,
            inPerson: true,
            renewalPeriod: '12 months'
          },
          costSharing: this.getCHIPCostSharing(stateCode),
          contact: this.getCHIPContactInfo(stateCode)
        }
      };
      
    } catch (error) {
      console.error('CHIP program info retrieval failed:', error);
      return {
        success: false,
        error: 'Failed to get CHIP program information',
        details: error.message
      };
    }
  }

  /**
   * Search Medicaid providers in a state
   * @param {Object} criteria - Search criteria
   * @param {string} criteria.state - State abbreviation
   * @param {string} criteria.providerType - Type of provider
   * @param {string} criteria.specialty - Provider specialty
   * @param {string} criteria.city - City
   * @param {number} criteria.distance - Distance in miles
   * @param {Object} options - Search options
   * @returns {Object} Provider search results
   */
  async searchMedicaidProviders(criteria, options = {}) {
    await this.initialize();
    
    try {
      let conditions = [`state = '${criteria.state.toUpperCase()}'`];
      
      if (criteria.providerType) {
        conditions.push(`provider_type LIKE '%${criteria.providerType}%'`);
      }
      if (criteria.specialty) {
        conditions.push(`specialty LIKE '%${criteria.specialty}%'`);
      }
      if (criteria.city) {
        conditions.push(`city = '${criteria.city}'`);
      }
      
      const whereClause = conditions.join(' AND ');
      const limit = options.limit || 100;
      
      const response = await axios.get(this.baseUrls.cms, {
        params: {
          resource_id: this.datasetIds.medicaidProviders,
          sql: `SELECT * FROM "${this.datasetIds.medicaidProviders}" WHERE ${whereClause} LIMIT ${limit}`,
          api_key: this.apiKey
        },
        headers: { 'User-Agent': 'IntelliCare/1.0 Medicaid/CHIP Service' }
      });
      
      const providers = response.data.result?.records || [];
      
      // Enrich provider data
      const enrichedProviders = await Promise.all(
        providers.map(provider => this.enrichProviderData(provider))
      );
      
      return {
        success: true,
        data: {
          providers: enrichedProviders,
          searchCriteria: criteria,
          totalResults: enrichedProviders.length,
          providerTypes: [
            'Primary Care Physician',
            'Specialist',
            'Hospital',
            'Pharmacy',
            'Behavioral Health Provider',
            'Dental Provider',
            'Vision Provider'
          ]
        }
      };
      
    } catch (error) {
      console.error('Provider search failed:', error);
      return {
        success: false,
        error: 'Failed to search providers',
        details: error.message
      };
    }
  }

  /**
   * Get state Medicaid program statistics and trends
   * @param {string} state - State abbreviation
   * @param {Object} dateRange - Date range for statistics
   * @returns {Object} Program statistics
   */
  async getStateMedicaidStatistics(state, dateRange = {}) {
    await this.initialize();
    
    try {
      const stateCode = state.toUpperCase();
      
      // Get beneficiary data
      const beneficiaryResponse = await axios.get(this.baseUrls.cms, {
        params: {
          resource_id: this.datasetIds.medicaidBeneficiaries,
          sql: `SELECT * FROM "${this.datasetIds.medicaidBeneficiaries}" WHERE state = '${stateCode}' ORDER BY year DESC LIMIT 10`,
          api_key: this.apiKey
        },
        headers: { 'User-Agent': 'IntelliCare/1.0 Medicaid/CHIP Service' }
      });
      
      const beneficiaryData = beneficiaryResponse.data.result?.records || [];
      
      // Calculate trends and statistics
      const statistics = this.calculateMedicaidStatistics(beneficiaryData);
      
      return {
        success: true,
        data: {
          state: stateCode,
          statistics,
          enrollmentTrends: this.analyzeEnrollmentTrends(beneficiaryData),
          demographics: this.analyzeDemographics(beneficiaryData),
          programCost: this.analyzeProgramCosts(beneficiaryData),
          expansionStatus: {
            expanded: this.medicaidExpansionStates.expanded.includes(stateCode),
            expansionDate: this.getExpansionDate(stateCode)
          }
        }
      };
      
    } catch (error) {
      console.error('State statistics retrieval failed:', error);
      return {
        success: false,
        error: 'Failed to get state statistics',
        details: error.message
      };
    }
  }

  // Helper methods for eligibility determination and data processing

  determineMedicaidEligibility(applicant, fplPercentage, isExpansionState) {
    const eligibilityCategories = [];
    
    // Adults (19-64) in expansion states
    if (isExpansionState && applicant.age >= 19 && applicant.age < 65 && fplPercentage <= 138) {
      eligibilityCategories.push({
        category: 'Medicaid Expansion Adults',
        eligible: true,
        incomeLimit: '138% FPL',
        description: 'Adult Medicaid expansion coverage'
      });
    }
    
    // Pregnant women
    if (applicant.pregnant && fplPercentage <= 200) {
      eligibilityCategories.push({
        category: 'Pregnant Women',
        eligible: true,
        incomeLimit: '200% FPL (varies by state)',
        description: 'Medicaid coverage for pregnant women'
      });
    }
    
    // Children
    if (applicant.age < 19 && fplPercentage <= 142) {
      eligibilityCategories.push({
        category: 'Children',
        eligible: true,
        incomeLimit: '142% FPL (minimum federal requirement)',
        description: 'Medicaid coverage for children'
      });
    }
    
    // Disabled individuals
    if (applicant.disabled && fplPercentage <= 75) {
      eligibilityCategories.push({
        category: 'Individuals with Disabilities',
        eligible: true,
        incomeLimit: '75% FPL (SSI income limit)',
        description: 'Medicaid for individuals receiving SSI'
      });
    }
    
    return {
      eligible: eligibilityCategories.length > 0,
      categories: eligibilityCategories,
      overallStatus: eligibilityCategories.length > 0 ? 'Likely Eligible' : 'Not Eligible Based on Standard Categories'
    };
  }

  determineCHIPEligibility(applicant, fplPercentage, state) {
    const stateThreshold = this.chipIncomeThresholds[state] || 200;
    
    // Check if any children in household are eligible
    const eligibleChildren = (applicant.children || []).filter(childAge => {
      return childAge < 19 && fplPercentage <= stateThreshold;
    });
    
    return {
      eligible: eligibleChildren.length > 0,
      eligibleChildren: eligibleChildren.length,
      incomeThreshold: `${stateThreshold}% FPL`,
      description: eligibleChildren.length > 0 ? 
        `${eligibleChildren.length} child(ren) eligible for CHIP` :
        'No children eligible for CHIP based on income'
    };
  }

  determineOtherPrograms(applicant, fplPercentage, state) {
    const programs = [];
    
    // Emergency Medicaid
    programs.push({
      program: 'Emergency Medicaid',
      eligible: true,
      description: 'Available regardless of income for emergency services',
      note: 'Limited to emergency medical conditions'
    });
    
    // Medicare Savings Programs
    if (applicant.age >= 65 && fplPercentage <= 135) {
      programs.push({
        program: 'Medicare Savings Programs',
        eligible: true,
        description: 'Help with Medicare premiums and cost-sharing',
        incomeLimit: '100-135% FPL depending on program'
      });
    }
    
    return programs;
  }

  generateNextSteps(eligibility) {
    const steps = [];
    
    if (eligibility.medicaid.eligible) {
      steps.push('Apply for Medicaid through your state Medicaid office or Healthcare.gov');
      steps.push('Gather required documents: proof of income, identity, residency');
    }
    
    if (eligibility.chip.eligible) {
      steps.push('Apply for CHIP through your state CHIP program');
      steps.push('Children may be eligible even if adults are not');
    }
    
    if (!eligibility.medicaid.eligible && !eligibility.chip.eligible) {
      steps.push('Check Healthcare.gov for subsidized private insurance plans');
      steps.push('Consider short-term health insurance options');
      steps.push('Look into community health center services');
    }
    
    return steps;
  }

  getApplicationResources(state) {
    return {
      online: `https://www.healthcare.gov or state Medicaid website`,
      phone: '1-800-318-2596 (Healthcare.gov) or state Medicaid office',
      inPerson: 'Local Department of Social Services or community organizations',
      assistancePrograms: [
        'Navigator Programs',
        'Certified Application Counselors',
        'Community Health Centers',
        'Local Social Services Offices'
      ]
    };
  }

  // Additional helper methods would be implemented here...
  async enrichManagedCarePlan(plan) {
    // Enrich managed care plan data
    return { ...plan };
  }

  async getStateManagedCareInfo(state) {
    // Get state-specific managed care information
    return {};
  }

  calculateCHIPIncomeEligibility(state, threshold) {
    // Calculate CHIP income eligibility for different family sizes
    const eligibility = {};
    const fplGuidelines = this.fplGuidelines2025.contiguous48;
    
    for (let size = 1; size <= 8; size++) {
      const fplAmount = fplGuidelines[size];
      const chipLimit = Math.round((fplAmount * threshold) / 100);
      eligibility[size] = {
        householdSize: size,
        maxIncome: chipLimit,
        monthlyIncome: Math.round(chipLimit / 12)
      };
    }
    
    return eligibility;
  }

  getCHIPBenefits() {
    return [
      'Doctor visits and checkups',
      'Prescription medications',
      'Hospital care',
      'Emergency services',
      'Dental and vision care',
      'Mental health services',
      'Immunizations',
      'Laboratory and X-ray services'
    ];
  }

  getCHIPCostSharing(state) {
    return {
      premiums: 'May apply for families above 150% FPL',
      copayments: '$3-$25 for services',
      maxAnnualCosts: '5% of family income',
      note: 'Cost-sharing varies by state and income level'
    };
  }

  getCHIPContactInfo(state) {
    return {
      website: `State CHIP program website`,
      phone: `State CHIP program phone number`,
      email: `State CHIP program email`
    };
  }

  async enrichProviderData(provider) {
    // Enrich provider data with additional information
    return { ...provider };
  }

  calculateMedicaidStatistics(data) {
    // Calculate statistics from beneficiary data
    return {};
  }

  analyzeEnrollmentTrends(data) {
    // Analyze enrollment trends
    return {};
  }

  analyzeDemographics(data) {
    // Analyze demographic data
    return {};
  }

  analyzeProgramCosts(data) {
    // Analyze program costs
    return {};
  }

  getExpansionDate(state) {
    // Get Medicaid expansion date for state
    return null;
  }

  async getStateMedicaidPrograms(state) {
    // Get state-specific Medicaid programs
    return {};
  }
}

// Register service with ServiceProxyManager for lazy loading
const proxy = getServiceProxy();
proxy.registerService('medicaidChipService', () => new MedicaidChipService());

module.exports = MedicaidChipService;