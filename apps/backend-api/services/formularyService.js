const https = require('https');
const http = require('http');

/**
 * Formulary Service
 * Implements CMS QHP Formulary API for medication coverage lookup
 *
 * Based on: https://github.com/CMSgov/QHP-provider-formulary-APIs
 *
 * CMS Interoperability Rule (CMS-0057-F) mandates formulary data by January 1, 2027
 * - QHP issuers must provide formulary data in standardized JSON format
 * - Free access via HTTPS (no API fees required for contracted providers)
 * - Drug identification via RxCUI (RXNORM identifiers)
 * - Coverage details: tiers, copay, prior auth, step therapy, quantity limits
 *
 * Data Structure:
 * - index.json: Discovery file with URLs to other files
 * - plans.json: Health plans with formulary tiers and cost-sharing
 * - providers.json: Provider networks
 * - drugs.json: Medication coverage by plan
 */

class FormularyService {
  constructor() {
    this.cache = new Map(); // Cache formulary data (expires after 24 hours)
    this.cacheExpiration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    // Sample insurance company formulary URLs
    // In production, these would be configured per practice/insurance
    this.formularyUrls = {
      // Example URLs (would be configured in practice settings)
      'aetna': {
        index: 'https://example-aetna.com/formulary/index.json',
        drugs: 'https://example-aetna.com/formulary/drugs.json',
        plans: 'https://example-aetna.com/formulary/plans.json'
      },
      'bluecross': {
        index: 'https://example-bcbs.com/formulary/index.json',
        drugs: 'https://example-bcbs.com/formulary/drugs.json',
        plans: 'https://example-bcbs.com/formulary/plans.json'
      },
      'uhc': {
        index: 'https://example-uhc.com/formulary/index.json',
        drugs: 'https://example-uhc.com/formulary/drugs.json',
        plans: 'https://example-uhc.com/formulary/plans.json'
      }
      // More insurers to be added as they implement CMS mandate
    };
  }

  /**
   * Fetch formulary file via HTTPS
   * @param {string} url - URL to formulary JSON file
   * @returns {Promise<Object>} Parsed JSON data
   */
  async fetchFormularyFile(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;

      protocol.get(url, (res) => {
        let data = '';

        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          return this.fetchFormularyFile(res.headers.location)
            .then(resolve)
            .catch(reject);
        }

        // Handle errors
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: Failed to fetch ${url}`));
        }

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (err) {
            reject(new Error(`JSON parse error for ${url}: ${err.message}`));
          }
        });
      }).on('error', (err) => {
        reject(new Error(`Network error fetching ${url}: ${err.message}`));
      });
    });
  }

  /**
   * Get formulary drugs data for an insurance company
   * Uses cache if available and not expired
   * @param {string} insuranceCompany - Insurance company identifier (lowercase)
   * @returns {Promise<Object>} Drugs formulary data
   */
  async getDrugsFormulary(insuranceCompany) {
    const cacheKey = `drugs:${insuranceCompany}`;
    const cached = this.cache.get(cacheKey);

    // Check cache
    if (cached && (Date.now() - cached.timestamp < this.cacheExpiration)) {
      return cached.data;
    }

    // Get URLs for this insurance company
    const urls = this.formularyUrls[insuranceCompany.toLowerCase()];
    if (!urls || !urls.drugs) {
      throw new Error(`No formulary URL configured for insurance: ${insuranceCompany}`);
    }

    // Fetch drugs.json
    try {
      const drugsData = await this.fetchFormularyFile(urls.drugs);

      // Cache the data
      this.cache.set(cacheKey, {
        data: drugsData,
        timestamp: Date.now()
      });

      return drugsData;
    } catch (error) {
      throw new Error(`Failed to fetch formulary for ${insuranceCompany}: ${error.message}`);
    }
  }

  /**
   * Get plans formulary data for an insurance company
   * @param {string} insuranceCompany - Insurance company identifier
   * @returns {Promise<Object>} Plans formulary data
   */
  async getPlansFormulary(insuranceCompany) {
    const cacheKey = `plans:${insuranceCompany}`;
    const cached = this.cache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < this.cacheExpiration)) {
      return cached.data;
    }

    const urls = this.formularyUrls[insuranceCompany.toLowerCase()];
    if (!urls || !urls.plans) {
      throw new Error(`No formulary URL configured for insurance: ${insuranceCompany}`);
    }

    try {
      const plansData = await this.fetchFormularyFile(urls.plans);

      this.cache.set(cacheKey, {
        data: plansData,
        timestamp: Date.now()
      });

      return plansData;
    } catch (error) {
      throw new Error(`Failed to fetch plans for ${insuranceCompany}: ${error.message}`);
    }
  }

  /**
   * Look up medication coverage by RxCUI
   * @param {string} rxcui - RXNORM identifier for the medication
   * @param {string} insuranceCompany - Insurance company identifier
   * @param {string} planId - Optional specific plan ID
   * @returns {Promise<Object>} Coverage information
   */
  async lookupMedicationCoverageByRxCUI(rxcui, insuranceCompany, planId = null) {
    try {
      // Get drugs formulary
      const drugsData = await this.getDrugsFormulary(insuranceCompany);

      // Find drug by RxCUI
      const drug = drugsData.formulary_drugs?.find(d => d.rxnorm_id === rxcui);

      if (!drug) {
        return {
          covered: false,
          reason: 'Medication not found in formulary',
          rxcui: rxcui
        };
      }

      // If specific plan requested, filter to that plan
      let planCoverage = drug.plans || [];
      if (planId) {
        planCoverage = planCoverage.filter(p => p.plan_id === planId);
      }

      if (planCoverage.length === 0) {
        return {
          covered: false,
          reason: planId ? 'Medication not covered under this plan' : 'No plan coverage found',
          rxcui: rxcui,
          drugName: drug.drug_name
        };
      }

      // Return coverage details
      return {
        covered: true,
        rxcui: rxcui,
        drugName: drug.drug_name,
        plans: planCoverage.map(plan => ({
          planId: plan.plan_id,
          tier: plan.drug_tier,
          priorAuthorization: plan.prior_authorization || false,
          stepTherapy: plan.step_therapy || false,
          quantityLimit: plan.quantity_limit || false
        }))
      };
    } catch (error) {
      throw new Error(`Failed to lookup medication coverage: ${error.message}`);
    }
  }

  /**
   * Look up medication coverage by drug name (fuzzy match)
   * Note: This is less reliable than RxCUI lookup
   * @param {string} drugName - Medication name
   * @param {string} insuranceCompany - Insurance company identifier
   * @param {string} planId - Optional specific plan ID
   * @returns {Promise<Object>} Coverage information
   */
  async lookupMedicationCoverageByName(drugName, insuranceCompany, planId = null) {
    try {
      const drugsData = await this.getDrugsFormulary(insuranceCompany);

      // Fuzzy match on drug name (case-insensitive)
      const normalizedSearch = drugName.toLowerCase().trim();
      const matches = drugsData.formulary_drugs?.filter(d =>
        d.drug_name.toLowerCase().includes(normalizedSearch)
      ) || [];

      if (matches.length === 0) {
        return {
          covered: false,
          reason: 'Medication not found in formulary',
          searchTerm: drugName
        };
      }

      // If multiple matches, return all
      const coverageResults = matches.map(drug => {
        let planCoverage = drug.plans || [];
        if (planId) {
          planCoverage = planCoverage.filter(p => p.plan_id === planId);
        }

        return {
          rxcui: drug.rxnorm_id,
          drugName: drug.drug_name,
          covered: planCoverage.length > 0,
          plans: planCoverage.map(plan => ({
            planId: plan.plan_id,
            tier: plan.drug_tier,
            priorAuthorization: plan.prior_authorization || false,
            stepTherapy: plan.step_therapy || false,
            quantityLimit: plan.quantity_limit || false
          }))
        };
      });

      return {
        searchTerm: drugName,
        exactMatch: matches.length === 1,
        results: coverageResults
      };
    } catch (error) {
      throw new Error(`Failed to lookup medication coverage: ${error.message}`);
    }
  }

  /**
   * Get plan cost-sharing details for a specific tier
   * @param {string} insuranceCompany - Insurance company identifier
   * @param {string} planId - Plan ID
   * @param {string} tier - Drug tier (e.g., "GENERIC", "BRAND", "SPECIALTY")
   * @returns {Promise<Object>} Cost-sharing information
   */
  async getPlanCostSharing(insuranceCompany, planId, tier) {
    try {
      const plansData = await this.getPlansFormulary(insuranceCompany);

      const plan = plansData.plans?.find(p => p.plan_id === planId);
      if (!plan) {
        throw new Error(`Plan ${planId} not found`);
      }

      // Find cost-sharing for this tier
      const formulary = plan.formulary || [];
      const tierInfo = formulary.find(f => f.drug_tier === tier);

      if (!tierInfo) {
        return {
          tier: tier,
          available: false
        };
      }

      return {
        tier: tier,
        available: true,
        costSharing: {
          copay: tierInfo.cost_sharing?.copay_amount,
          copayCurrency: tierInfo.cost_sharing?.copay_currency,
          coinsurance: tierInfo.cost_sharing?.coinsurance_rate,
          mailOrder: tierInfo.mail_order
        }
      };
    } catch (error) {
      throw new Error(`Failed to get cost-sharing details: ${error.message}`);
    }
  }

  /**
   * Add or update insurance company formulary URLs
   * Used by practice administrators to configure formulary endpoints
   * @param {string} insuranceCompany - Insurance company identifier
   * @param {Object} urls - URLs object {index, drugs, plans}
   */
  setFormularyUrls(insuranceCompany, urls) {
    this.formularyUrls[insuranceCompany.toLowerCase()] = urls;

    // Clear cache for this insurance company
    this.cache.delete(`drugs:${insuranceCompany}`);
    this.cache.delete(`plans:${insuranceCompany}`);
  }

  /**
   * Get list of configured insurance companies
   * @returns {Array<string>} List of insurance company identifiers
   */
  getConfiguredInsurers() {
    return Object.keys(this.formularyUrls);
  }

  /**
   * Clear cache (useful for testing or forcing refresh)
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new FormularyService();
