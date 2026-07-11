// CMS Marketplace API Service
// Migrated to DDD NX architecture - Integration Context - External APIs Feature
// Comprehensive service integrating HealthCare.gov Marketplace APIs for health insurance

const crypto = require('crypto');

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

/**
 * CMS Marketplace Service
 * Integrates with HealthCare.gov and state marketplace APIs
 */
class CMSMarketplaceService {
  constructor() {
    this.serviceId = 'cms-marketplace-service';
    this.serviceToken = null;
    this.initialized = false;
    
    // Marketplace types
    this.marketplaceTypes = {
      INDIVIDUAL: 'Individual Market',
      SMALL_GROUP: 'Small Group Market',
      SHOP: 'Small Business Health Options Program'
    };
    
    // Plan categories (metal levels)
    this.planCategories = {
      CATASTROPHIC: { metalLevel: 'Catastrophic', actuarialValue: '60%' },
      BRONZE: { metalLevel: 'Bronze', actuarialValue: '60%' },
      SILVER: { metalLevel: 'Silver', actuarialValue: '70%' },
      GOLD: { metalLevel: 'Gold', actuarialValue: '80%' },
      PLATINUM: { metalLevel: 'Platinum', actuarialValue: '90%' }
    };
    
    // Plan types
    this.planTypes = {
      HMO: 'Health Maintenance Organization',
      PPO: 'Preferred Provider Organization', 
      EPO: 'Exclusive Provider Organization',
      POS: 'Point of Service'
    };
    
    // Enrollment periods
    this.enrollmentPeriods = {
      OPEN: 'Open Enrollment Period',
      SPECIAL: 'Special Enrollment Period',
      ANNUAL: 'Annual Open Enrollment'
    };
    
    // State marketplace types
    this.stateMarketplaceTypes = {
      FFM: 'Federally Facilitated Marketplace',
      SBM: 'State-Based Marketplace',
      SPM: 'State Partnership Marketplace',
      FFM_FP: 'Federally Facilitated Marketplace with Full Partnership'
    };
    
    // US states and their marketplace types (2025)
    this.stateMarketplaces = {
      'CA': { type: 'SBM', name: 'Covered California' },
      'CO': { type: 'SBM', name: 'Connect for Health Colorado' },
      'CT': { type: 'SBM', name: 'Access Health CT' },
      'DC': { type: 'SBM', name: 'DC Health Link' },
      'ID': { type: 'SBM', name: 'Your Health Idaho' },
      'MA': { type: 'SBM', name: 'Massachusetts Health Connector' },
      'MD': { type: 'SBM', name: 'Maryland Health Connection' },
      'MN': { type: 'SBM', name: 'MNsure' },
      'NV': { type: 'SBM', name: 'Nevada Health Link' },
      'NJ': { type: 'SBM', name: 'Get Covered New Jersey' },
      'NY': { type: 'SBM', name: 'NY State of Health' },
      'PA': { type: 'SBM', name: 'Pennie' },
      'RI': { type: 'SBM', name: 'HealthSource RI' },
      'VT': { type: 'SBM', name: 'Vermont Health Connect' },
      'WA': { type: 'SBM', name: 'Washington Healthplanfinder' }
    };
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Authenticate service with serviceAccountManager
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Load marketplace cache
      await this.loadMarketplaceCache();
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize',
        practiceId: 'global'
      };
      
      const SecureDataAccess = proxy.getService('secureDataAccess');
      await SecureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'cmsMarketplaceService',
        timestamp: new Date()
      }, context);
      
      console.log('✅ CMSMarketplaceService initialized with ServiceProxy');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize CMS Marketplace Service:', error);
      throw error;
    }
  }

  async loadMarketplaceCache() {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'load-marketplace-cache',
        practiceId: 'global'
      };

      console.log('📡 Loading CMS marketplace cache...');
      // Implementation for loading cached marketplace data
    } catch (error) {
      console.warn('⚠️ Could not load marketplace cache:', error.message);
    }
  }

  /**
   * Search health insurance plans
   */
  async searchHealthPlans(criteria, practiceContext = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      const limit = Math.min(practiceContext.limit || 20, 100);
      
      // Build search parameters
      const searchParams = {
        state: criteria.state,
        county: criteria.county,
        zip: criteria.zipCode,
        year: criteria.year || new Date().getFullYear(),
        market: criteria.market || 'Individual',
        limit: limit
      };
      
      if (criteria.metalLevel) {
        searchParams.metal_level = criteria.metalLevel;
      }
      
      if (criteria.planType) {
        searchParams.plan_type = criteria.planType;
      }
      
      if (criteria.issuer) {
        searchParams.issuer = criteria.issuer;
      }
      
      const proxy = getServiceProxy();
      const externalApiGateway = proxy.getService('externalApiGateway');
      const response = await externalApiGateway.makeRequest(
        'healthcareGov',
        '/marketplace/plans',
        searchParams
      );
      
      if (!response.plans) {
        return { plans: [], total: 0, searchCriteria: criteria };
      }
      
      const plans = response.plans.map(plan => ({
        planId: plan.plan_id,
        planName: plan.plan_name,
        issuer: {
          id: plan.issuer_id,
          name: plan.issuer_name,
          state: plan.issuer_state
        },
        marketType: plan.market,
        metalLevel: plan.metal_level,
        planType: plan.plan_type,
        productType: plan.product_type,
        premiums: {
          individual: {
            age21: plan.premium_adult_individual_age_21,
            age27: plan.premium_adult_individual_age_27,
            age30: plan.premium_adult_individual_age_30,
            age40: plan.premium_adult_individual_age_40,
            age50: plan.premium_adult_individual_age_50,
            age60: plan.premium_adult_individual_age_60
          },
          couple: plan.premium_couple,
          family: plan.premium_family
        },
        deductibles: {
          individual: plan.deductible_individual,
          family: plan.deductible_family
        },
        outOfPocketLimits: {
          individual: plan.out_of_pocket_maximum_individual,
          family: plan.out_of_pocket_maximum_family
        },
        benefits: {
          medicalDeductible: plan.medical_deductible,
          drugDeductible: plan.drug_deductible,
          primaryCareCopay: plan.primary_care_physician_standard_cost,
          specialistCopay: plan.specialist_standard_cost,
          emergencyRoomCopay: plan.emergency_room_standard_cost
        },
        network: {
          networkId: plan.network_id,
          providerCount: plan.providers_in_network,
          hospitalCount: plan.hospitals_in_network
        },
        coverage: {
          state: plan.state,
          county: plan.county,
          zipCodes: plan.zip_codes || [],
          serviceArea: plan.service_area_id
        },
        qualityRating: plan.quality_rating,
        hasaoCertified: plan.hsa_eligible,
        childOnlyOffering: plan.child_only_offering,
        limitedNetwork: plan.limited_network,
        specialtyDrugTiers: plan.specialty_drug_tiers,
        formularyId: plan.formulary_id
      }));
      
      await this.logPlanSearch(criteria, plans.length, practiceContext.userId);
      
      return {
        plans: plans,
        total: response.total || plans.length,
        searchCriteria: criteria,
        searchedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Health plan search error:', error);
      throw new Error(`Failed to search health plans: ${error.message}`);
    }
  }

  /**
   * Get detailed plan information
   */
  async getPlanDetails(planId, practiceContext = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      const proxy = getServiceProxy();
      const externalApiGateway = proxy.getService('externalApiGateway');
      const response = await externalApiGateway.makeRequest(
        'healthcareGov',
        `/marketplace/plans/${planId}`,
        {}
      );
      
      if (!response.plan) {
        return null;
      }
      
      const plan = response.plan;
      
      const planDetails = {
        planId: plan.plan_id,
        planName: plan.plan_name,
        marketingName: plan.marketing_name,
        summary: plan.summary,
        issuer: {
          id: plan.issuer_id,
          name: plan.issuer_name,
          state: plan.issuer_state,
          website: plan.issuer_url,
          customerServicePhone: plan.customer_service_phone
        },
        planDetails: {
          metalLevel: plan.metal_level,
          planType: plan.plan_type,
          productType: plan.product_type,
          effectiveDate: plan.effective_date,
          expirationDate: plan.expiration_date,
          planYear: plan.plan_year
        },
        costs: {
          premiums: {
            individual21: plan.premium_adult_individual_age_21,
            individual27: plan.premium_adult_individual_age_27,
            individual30: plan.premium_adult_individual_age_30,
            individual40: plan.premium_adult_individual_age_40,
            individual50: plan.premium_adult_individual_age_50,
            individual60: plan.premium_adult_individual_age_60,
            couple: plan.premium_couple,
            family: plan.premium_family
          },
          deductibles: {
            medical: {
              individual: plan.medical_deductible_individual,
              family: plan.medical_deductible_family
            },
            drug: {
              individual: plan.drug_deductible_individual,
              family: plan.drug_deductible_family
            }
          },
          outOfPocketMaximums: {
            individual: plan.out_of_pocket_maximum_individual,
            family: plan.out_of_pocket_maximum_family
          }
        },
        benefits: {
          primaryCareCost: plan.primary_care_physician_standard_cost,
          specialistCost: plan.specialist_standard_cost,
          emergencyRoomCost: plan.emergency_room_standard_cost,
          urgentCareCost: plan.urgent_care_standard_cost,
          inpatientFacilityCost: plan.inpatient_facility_standard_cost,
          outpatientFacilityCost: plan.outpatient_facility_standard_cost,
          mentalHealthCost: plan.mental_health_standard_cost,
          prescriptionDrugCost: plan.prescription_drugs_standard_cost
        },
        network: {
          networkId: plan.network_id,
          networkName: plan.network_name,
          networkURL: plan.network_url,
          providersInNetwork: plan.providers_in_network,
          hospitalsInNetwork: plan.hospitals_in_network,
          limitedNetwork: plan.limited_network
        },
        coverage: {
          serviceAreas: plan.service_areas || [],
          counties: plan.counties || [],
          zipCodes: plan.zip_codes || []
        },
        quality: {
          qualityRating: plan.quality_rating,
          preventiveCareCoverage: plan.preventive_care_coverage,
          wellnessProgramOffered: plan.wellness_program_offered
        },
        specialFeatures: {
          hsaEligible: plan.hsa_eligible,
          childOnlyOffering: plan.child_only_offering,
          adultDentalCoverage: plan.adult_dental_coverage,
          childDentalCoverage: plan.child_dental_coverage
        },
        formulary: {
          formularyId: plan.formulary_id,
          formularyURL: plan.formulary_url,
          drugTiers: plan.drug_tiers || []
        },
        lastUpdated: plan.last_updated_on
      };
      
      await this.logPlanLookup(planId, practiceContext.userId);
      
      return planDetails;
      
    } catch (error) {
      console.error('Plan details error:', error);
      throw new Error(`Failed to get plan details: ${error.message}`);
    }
  }

  /**
   * Compare multiple health plans
   */
  async comparePlans(planIds, practiceContext = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      const plans = [];
      
      // Get details for each plan
      for (const planId of planIds) {
        try {
          const planDetails = await this.getPlanDetails(planId, practiceContext);
          if (planDetails) {
            plans.push(planDetails);
          }
        } catch (error) {
          console.warn(`Failed to get details for plan ${planId}:`, error.message);
        }
      }
      
      if (plans.length === 0) {
        return { comparison: [], summary: {} };
      }
      
      const comparison = {
        plans: plans,
        summary: {
          totalPlans: plans.length,
          metalLevels: [...new Set(plans.map(p => p.planDetails.metalLevel))],
          planTypes: [...new Set(plans.map(p => p.planDetails.planType))],
          issuers: [...new Set(plans.map(p => p.issuer.name))],
          priceRange: {
            lowest: Math.min(...plans.map(p => p.costs.premiums.individual27 || 0)),
            highest: Math.max(...plans.map(p => p.costs.premiums.individual27 || 0))
          }
        },
        comparison: {
          premiums: plans.map(p => ({
            planId: p.planId,
            planName: p.planName,
            individual27: p.costs.premiums.individual27,
            family: p.costs.premiums.family
          })),
          deductibles: plans.map(p => ({
            planId: p.planId,
            planName: p.planName,
            medicalIndividual: p.costs.deductibles.medical.individual,
            medicalFamily: p.costs.deductibles.medical.family
          })),
          outOfPocketMaximums: plans.map(p => ({
            planId: p.planId,
            planName: p.planName,
            individual: p.costs.outOfPocketMaximums.individual,
            family: p.costs.outOfPocketMaximums.family
          })),
          networks: plans.map(p => ({
            planId: p.planId,
            planName: p.planName,
            networkName: p.network.networkName,
            providersInNetwork: p.network.providersInNetwork,
            limitedNetwork: p.network.limitedNetwork
          }))
        },
        recommendations: this.generatePlanRecommendations(plans),
        comparedAt: new Date().toISOString()
      };
      
      await this.logPlanComparison(planIds.length, practiceContext.userId);
      
      return comparison;
      
    } catch (error) {
      console.error('Plan comparison error:', error);
      throw new Error(`Failed to compare plans: ${error.message}`);
    }
  }

  /**
   * Calculate premium tax credits and subsidies
   */
  async calculateSubsidies(householdIncome, householdSize, state, practiceContext = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      // Federal Poverty Level (FPL) for 2025
      const fpl2025 = {
        1: 15060,
        2: 20440,
        3: 25820,
        4: 31200,
        5: 36580,
        6: 41960,
        7: 47340,
        8: 52720
      };
      
      // Calculate FPL percentage
      const baseFPL = fpl2025[Math.min(householdSize, 8)] || fpl2025[8];
      const additionalMembers = Math.max(0, householdSize - 8);
      const adjustedFPL = baseFPL + (additionalMembers * 5380);
      const fplPercentage = (householdIncome / adjustedFPL) * 100;
      
      const subsidyCalculation = {
        householdIncome: householdIncome,
        householdSize: householdSize,
        state: state,
        federalPovertyLevel: adjustedFPL,
        fplPercentage: Math.round(fplPercentage),
        eligibility: {
          premiumTaxCredit: false,
          costSharingReduction: false,
          medicaidEligible: false,
          chipEligible: false
        },
        subsidies: {
          maxPremiumContribution: 0,
          estimatedTaxCredit: 0,
          costSharingReductionLevel: null
        },
        enrollmentPeriods: {
          openEnrollment: this.getOpenEnrollmentDates(),
          specialEnrollmentEligible: false
        }
      };
      
      // Determine eligibility based on FPL percentage
      if (fplPercentage >= 100 && fplPercentage <= 400) {
        subsidyCalculation.eligibility.premiumTaxCredit = true;
        subsidyCalculation.subsidies.maxPremiumContribution = this.calculateMaxPremiumContribution(fplPercentage, householdIncome);
      }
      
      if (fplPercentage >= 100 && fplPercentage <= 250) {
        subsidyCalculation.eligibility.costSharingReduction = true;
        subsidyCalculation.subsidies.costSharingReductionLevel = this.getCostSharingReductionLevel(fplPercentage);
      }
      
      // Check Medicaid eligibility (varies by state expansion status)
      const medicaidExpansionStates = ['CA', 'NY', 'FL', 'TX', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI', 'NJ', 'VA', 'WA', 'AZ', 'MA', 'TN', 'IN', 'MO', 'MD', 'WI', 'CO', 'MN', 'SC', 'AL', 'LA', 'KY', 'OR', 'OK', 'CT', 'UT', 'IA', 'NV', 'AR', 'MS', 'KS', 'NM', 'NE', 'ID', 'WV', 'HI', 'NH', 'ME', 'MT', 'RI', 'DE', 'ND', 'AK', 'DC', 'VT'];
      
      if (medicaidExpansionStates.includes(state) && fplPercentage <= 138) {
        subsidyCalculation.eligibility.medicaidEligible = true;
      } else if (!medicaidExpansionStates.includes(state) && fplPercentage <= 100) {
        subsidyCalculation.eligibility.medicaidEligible = true;
      }
      
      await this.logSubsidyCalculation(householdIncome, householdSize, subsidyCalculation.eligibility.premiumTaxCredit, practiceContext.userId);
      
      return subsidyCalculation;
      
    } catch (error) {
      console.error('Subsidy calculation error:', error);
      throw new Error(`Failed to calculate subsidies: ${error.message}`);
    }
  }

  /**
   * Get enrollment assistance and marketplace information
   */
  async getEnrollmentAssistance(state, practiceContext = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      const marketplaceInfo = this.stateMarketplaces[state] || {
        type: 'FFM',
        name: 'HealthCare.gov'
      };
      
      const assistance = {
        state: state,
        marketplace: marketplaceInfo,
        enrollmentPeriods: {
          openEnrollment: this.getOpenEnrollmentDates(),
          current: this.getCurrentEnrollmentStatus()
        },
        assistancePrograms: {
          navigators: [],
          certifiedApplicationCounselors: [],
          agents: []
        },
        resources: {
          website: marketplaceInfo.type === 'FFM' ? 'https://www.healthcare.gov' : null,
          phone: '1-800-318-2596',
          languages: ['English', 'Spanish', 'Chinese', 'Vietnamese', 'Korean', 'Tagalog', 'Russian', 'Arabic', 'Haitian Creole', 'French', 'Polish', 'Portuguese', 'Italian', 'German', 'Japanese', 'Hindi', 'Gujarati']
        },
        specialEnrollmentEvents: [
          'Loss of health coverage',
          'Changes in household',
          'Changes in residence',
          'Changes in income',
          'Other qualifying events'
        ],
        documents: [
          'Social Security numbers',
          'Tax forms or pay stubs',
          'Policy numbers for current plans',
          'Immigration documents (if applicable)'
        ]
      };
      
      await this.logEnrollmentAssistance(state, practiceContext.userId);
      
      return assistance;
      
    } catch (error) {
      console.error('Enrollment assistance error:', error);
      throw new Error(`Failed to get enrollment assistance: ${error.message}`);
    }
  }

  // Helper methods

  /**
   * Generate plan recommendations
   */
  generatePlanRecommendations(plans) {
    const recommendations = [];
    
    if (plans.length === 0) return recommendations;
    
    // Find lowest premium plan
    const lowestPremium = plans.reduce((prev, current) => 
      (prev.costs.premiums.individual27 < current.costs.premiums.individual27) ? prev : current
    );
    recommendations.push({
      type: 'Lowest Premium',
      planId: lowestPremium.planId,
      planName: lowestPremium.planName,
      reason: 'Lowest monthly premium cost'
    });
    
    // Find best value (considering deductible and premium)
    const bestValue = plans.reduce((prev, current) => {
      const prevTotal = (prev.costs.premiums.individual27 * 12) + prev.costs.deductibles.medical.individual;
      const currentTotal = (current.costs.premiums.individual27 * 12) + current.costs.deductibles.medical.individual;
      return prevTotal < currentTotal ? prev : current;
    });
    recommendations.push({
      type: 'Best Value',
      planId: bestValue.planId,
      planName: bestValue.planName,
      reason: 'Best balance of premium and deductible costs'
    });
    
    return recommendations;
  }

  /**
   * Calculate maximum premium contribution based on FPL
   */
  calculateMaxPremiumContribution(fplPercentage, income) {
    // 2025 premium contribution percentages
    const contributionTable = {
      100: 0.0285,  // 2.85%
      150: 0.038,   // 3.8%
      200: 0.063,   // 6.3%
      250: 0.083,   // 8.3%
      300: 0.095,   // 9.5%
      400: 0.095    // 9.5%
    };
    
    let percentage = 0.095; // Default to 9.5% for 300-400% FPL
    
    for (const [threshold, rate] of Object.entries(contributionTable)) {
      if (fplPercentage <= parseInt(threshold)) {
        percentage = rate;
        break;
      }
    }
    
    return Math.round((income * percentage) / 12); // Monthly contribution
  }

  /**
   * Get cost sharing reduction level
   */
  getCostSharingReductionLevel(fplPercentage) {
    if (fplPercentage <= 150) return '94%';
    if (fplPercentage <= 200) return '87%';
    if (fplPercentage <= 250) return '73%';
    return null;
  }

  /**
   * Get open enrollment dates
   */
  getOpenEnrollmentDates() {
    const currentYear = new Date().getFullYear();
    return {
      start: `November 1, ${currentYear}`,
      end: `January 15, ${currentYear + 1}`,
      year: currentYear + 1
    };
  }

  /**
   * Get current enrollment status
   */
  getCurrentEnrollmentStatus() {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const day = now.getDate();
    
    if ((month === 11) || (month === 12) || (month === 1 && day <= 15)) {
      return 'OPEN';
    }
    
    return 'CLOSED';
  }

  // Audit logging methods
  async logPlanSearch(criteria, resultCount, userId) {
    await this.auditLog('PLAN_SEARCH', { criteria, resultCount }, userId);
  }

  async logPlanLookup(planId, userId) {
    await this.auditLog('PLAN_LOOKUP', { planId }, userId);
  }

  async logPlanComparison(planCount, userId) {
    await this.auditLog('PLAN_COMPARISON', { planCount }, userId);
  }

  async logSubsidyCalculation(income, householdSize, eligible, userId) {
    await this.auditLog('SUBSIDY_CALCULATION', { income, householdSize, eligible }, userId);
  }

  async logEnrollmentAssistance(state, userId) {
    await this.auditLog('ENROLLMENT_ASSISTANCE', { state }, userId);
  }

  async auditLog(action, details, userId) {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'audit-log',
        practiceId: 'global'
      };
      
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      await SecureDataAccess.create('audit_logs', {
        action: action,
        resourceType: 'marketplace_data',
        userId: userId || 'system',
        details: details,
        timestamp: new Date()
      }, context);
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      serviceId: this.serviceId,
      initialized: this.initialized,
      marketplaceTypesSupported: Object.keys(this.marketplaceTypes).length,
      planCategoriesAvailable: Object.keys(this.planCategories).length,
      stateMarketplacesTracked: Object.keys(this.stateMarketplaces).length
    };
  }
}

// Export singleton instance
const cmsMarketplaceServiceInstance = new CMSMarketplaceService();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('cmsMarketplaceService', () => cmsMarketplaceServiceInstance);
}

module.exports = cmsMarketplaceServiceInstance;