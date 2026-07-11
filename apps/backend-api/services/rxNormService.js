/**
 * RxNorm/RxNav Drug Nomenclature Service
 * Integrates with NLM's RxNorm API for standardized drug naming,
 * RxCUI codes, brand/generic mappings, drug interactions, and classifications.
 *
 * API: https://rxnav.nlm.nih.gov/REST (FREE, no API key required)
 * Rate Limit: 20 requests/second/IP
 */

const NodeCache = require('node-cache');
const externalApiGateway = require('./externalApiGatewayService');
const serviceAccountManager = require('./serviceAccountManager');

class RxNormService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    // 24-hour cache - RxNorm data changes infrequently
    this.cache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });
  }

  async initialize() {
    if (this.initialized) return;

    try {
      this.serviceToken = await serviceAccountManager.authenticate('rxnorm-service');
      await externalApiGateway.initialize();
      this.initialized = true;
      console.log('✅ RxNorm Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize RxNorm Service:', error);
      throw error;
    }
  }

  /**
   * Search for a drug by name (supports fuzzy matching)
   * Uses approximateTerm for typo tolerance, falls back to exact search
   * @param {string} name - Drug name (can include misspellings)
   * @param {object} options - { userId }
   * @returns {object} { drugs: [{ rxcui, name, synonym, tty, score }], suggestions: [] }
   */
  async searchDrugByName(name, options = {}) {
    await this.initialize();

    try {
      // Try approximate/fuzzy search first (handles misspellings)
      const approxResult = await externalApiGateway.makeRequest(
        'rxnorm',
        '/approximateTerm.json',
        { term: name, maxEntries: 10 },
        { userId: options.userId }
      );

      const candidates = approxResult?.approximateGroup?.candidate || [];

      if (candidates.length > 0) {
        const drugs = candidates.map(c => ({
          rxcui: c.rxcui,
          name: c.name || '',
          score: c.score,
          rank: c.rank
        }));

        // Also get spelling suggestions if the name looks misspelled
        let suggestions = [];
        if (candidates[0]?.score && parseInt(candidates[0].score) < 100) {
          suggestions = await this.getSpellingSuggestions(name);
        }

        return {
          query: name,
          totalResults: drugs.length,
          drugs,
          suggestions,
          source: 'RxNorm (NLM)'
        };
      }

      // Fallback: exact name search
      const exactResult = await externalApiGateway.makeRequest(
        'rxnorm',
        '/rxcui.json',
        { name, allsrc: 0 },
        { userId: options.userId }
      );

      const rxcui = exactResult?.idGroup?.rxnormId?.[0];
      if (rxcui) {
        return {
          query: name,
          totalResults: 1,
          drugs: [{ rxcui, name: exactResult.idGroup.name || name, score: '100', rank: '1' }],
          suggestions: [],
          source: 'RxNorm (NLM)'
        };
      }

      // Nothing found - return spelling suggestions
      const suggestions = await this.getSpellingSuggestions(name);
      return {
        query: name,
        totalResults: 0,
        drugs: [],
        suggestions,
        source: 'RxNorm (NLM)',
        message: suggestions.length > 0
          ? `No exact match found. Did you mean: ${suggestions.join(', ')}?`
          : `No drugs found matching "${name}".`
      };

    } catch (error) {
      console.error('RxNorm search error:', error);
      throw new Error(`Failed to search RxNorm for "${name}": ${error.message}`);
    }
  }

  /**
   * Get full drug details by RxCUI
   * Returns ingredients, brands, generics, dose forms
   * @param {string} rxcui - RxCUI code
   * @param {object} options - { userId }
   */
  async getDrugDetails(rxcui, options = {}) {
    await this.initialize();

    const cacheKey = `details_${rxcui}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await externalApiGateway.makeRequest(
        'rxnorm',
        `/rxcui/${rxcui}/allrelated.json`,
        {},
        { userId: options.userId }
      );

      const groups = result?.allRelatedGroup?.conceptGroup || [];
      const details = {
        rxcui,
        ingredients: this._extractConceptsByTTY(groups, ['IN', 'PIN']),
        brandNames: this._extractConceptsByTTY(groups, ['BN']),
        genericNames: this._extractConceptsByTTY(groups, ['SBD', 'SCD']),
        doseForms: this._extractConceptsByTTY(groups, ['DF']),
        strengths: this._extractConceptsByTTY(groups, ['SCDC', 'SBDC']),
        allConcepts: groups.map(g => ({
          tty: g.tty,
          concepts: (g.conceptProperties || []).map(c => ({
            rxcui: c.rxcui,
            name: c.name,
            synonym: c.synonym
          }))
        })).filter(g => g.concepts.length > 0),
        source: 'RxNorm (NLM)'
      };

      this.cache.set(cacheKey, details);
      return details;

    } catch (error) {
      console.error('RxNorm details error:', error);
      throw new Error(`Failed to get drug details for RxCUI ${rxcui}: ${error.message}`);
    }
  }

  /**
   * Map brand name to generic alternatives
   * @param {string} rxcui - RxCUI of the brand drug
   * @param {object} options - { userId }
   */
  async getBrandToGeneric(rxcui, options = {}) {
    await this.initialize();

    try {
      // Get ingredients (IN = ingredient)
      const ingredientResult = await externalApiGateway.makeRequest(
        'rxnorm',
        `/rxcui/${rxcui}/related.json`,
        { tty: 'IN' },
        { userId: options.userId }
      );

      const ingredients = this._extractRelatedConcepts(ingredientResult);

      // Get generic clinical drugs (SCD = Semantic Clinical Drug)
      const genericResult = await externalApiGateway.makeRequest(
        'rxnorm',
        `/rxcui/${rxcui}/related.json`,
        { tty: 'SCD' },
        { userId: options.userId }
      );

      const generics = this._extractRelatedConcepts(genericResult);

      return {
        brandRxcui: rxcui,
        ingredients,
        genericAlternatives: generics,
        totalGenerics: generics.length,
        source: 'RxNorm (NLM)'
      };

    } catch (error) {
      console.error('RxNorm brand-to-generic error:', error);
      throw new Error(`Failed to find generics for RxCUI ${rxcui}: ${error.message}`);
    }
  }

  /**
   * Map generic to available brand names
   * @param {string} rxcui - RxCUI of the generic drug
   * @param {object} options - { userId }
   */
  async getGenericToBrands(rxcui, options = {}) {
    await this.initialize();

    try {
      // Get brand names (BN = Brand Name)
      const brandResult = await externalApiGateway.makeRequest(
        'rxnorm',
        `/rxcui/${rxcui}/related.json`,
        { tty: 'BN' },
        { userId: options.userId }
      );

      const brands = this._extractRelatedConcepts(brandResult);

      // Get branded drugs (SBD = Semantic Branded Drug)
      const brandedDrugResult = await externalApiGateway.makeRequest(
        'rxnorm',
        `/rxcui/${rxcui}/related.json`,
        { tty: 'SBD' },
        { userId: options.userId }
      );

      const brandedDrugs = this._extractRelatedConcepts(brandedDrugResult);

      return {
        genericRxcui: rxcui,
        brandNames: brands,
        brandedProducts: brandedDrugs,
        totalBrands: brands.length,
        source: 'RxNorm (NLM)'
      };

    } catch (error) {
      console.error('RxNorm generic-to-brands error:', error);
      throw new Error(`Failed to find brands for RxCUI ${rxcui}: ${error.message}`);
    }
  }

  /**
   * Get drug classes/classifications (ATC, MESH, disease-based)
   * @param {string} drugName - Drug name
   * @param {object} options - { userId }
   */
  async getDrugClasses(drugName, options = {}) {
    await this.initialize();

    try {
      const result = await externalApiGateway.makeRequest(
        'rxnorm',
        '/rxclass/class/byDrugName.json',
        { drugName, relaSource: 'ATC' },
        { userId: options.userId }
      );

      const atcClasses = (result?.rxclassDrugInfoList?.rxclassDrugInfo || []).map(info => ({
        className: info.rxclassMinConceptItem?.className,
        classId: info.rxclassMinConceptItem?.classId,
        classType: info.rxclassMinConceptItem?.classType,
        relation: info.rela
      }));

      // Also try MESH classification
      const meshResult = await externalApiGateway.makeRequest(
        'rxnorm',
        '/rxclass/class/byDrugName.json',
        { drugName, relaSource: 'MESH' },
        { userId: options.userId }
      );

      const meshClasses = (meshResult?.rxclassDrugInfoList?.rxclassDrugInfo || []).map(info => ({
        className: info.rxclassMinConceptItem?.className,
        classId: info.rxclassMinConceptItem?.classId,
        classType: info.rxclassMinConceptItem?.classType,
        relation: info.rela
      }));

      return {
        drugName,
        atcClasses,
        meshClasses,
        totalClasses: atcClasses.length + meshClasses.length,
        source: 'RxClass API (NLM)'
      };

    } catch (error) {
      console.error('RxNorm drug class error:', error);
      throw new Error(`Failed to get drug classes for "${drugName}": ${error.message}`);
    }
  }

  /**
   * Get spelling suggestions for a misspelled drug name
   * @param {string} term - Possibly misspelled drug name
   * @returns {string[]} Array of suggested spellings
   */
  async getSpellingSuggestions(term) {
    try {
      const result = await externalApiGateway.makeRequest(
        'rxnorm',
        '/spellingsuggestions.json',
        { name: term },
        {}
      );

      return result?.suggestionGroup?.suggestionList?.suggestion || [];

    } catch (error) {
      console.error('RxNorm spelling suggestions error:', error);
      return [];
    }
  }

  /**
   * Normalize a free-text drug name to standardized form + RxCUI
   * @param {string} input - Free-text drug name (e.g., "liptor 20mg", "lisinipril")
   * @param {object} options - { userId }
   * @returns {object} { originalInput, normalizedName, rxcui, suggestions }
   */
  async normalizeDrugName(input, options = {}) {
    await this.initialize();

    try {
      // Step 1: Try exact match
      const exactResult = await externalApiGateway.makeRequest(
        'rxnorm',
        '/rxcui.json',
        { name: input, allsrc: 0 },
        { userId: options.userId }
      );

      const exactRxcui = exactResult?.idGroup?.rxnormId?.[0];
      if (exactRxcui) {
        return {
          originalInput: input,
          normalizedName: exactResult.idGroup.name || input,
          rxcui: exactRxcui,
          confidence: 'exact',
          source: 'RxNorm (NLM)'
        };
      }

      // Step 2: Try approximate match
      const approxResult = await externalApiGateway.makeRequest(
        'rxnorm',
        '/approximateTerm.json',
        { term: input, maxEntries: 5 },
        { userId: options.userId }
      );

      const topMatch = approxResult?.approximateGroup?.candidate?.[0];
      if (topMatch) {
        return {
          originalInput: input,
          normalizedName: topMatch.name || '',
          rxcui: topMatch.rxcui,
          confidence: parseInt(topMatch.score) >= 80 ? 'high' : 'low',
          score: topMatch.score,
          suggestions: await this.getSpellingSuggestions(input),
          source: 'RxNorm (NLM)'
        };
      }

      // Step 3: Nothing found
      const suggestions = await this.getSpellingSuggestions(input);
      return {
        originalInput: input,
        normalizedName: null,
        rxcui: null,
        confidence: 'none',
        suggestions,
        message: suggestions.length > 0
          ? `Could not normalize "${input}". Did you mean: ${suggestions.join(', ')}?`
          : `Could not find "${input}" in RxNorm database.`,
        source: 'RxNorm (NLM)'
      };

    } catch (error) {
      console.error('RxNorm normalize error:', error);
      throw new Error(`Failed to normalize drug name "${input}": ${error.message}`);
    }
  }

  // ─── Helper Methods ─────────────────────────────────────────────

  /**
   * Extract concepts from allrelated response by term type (TTY)
   */
  _extractConceptsByTTY(groups, ttyList) {
    const results = [];
    for (const group of groups) {
      if (ttyList.includes(group.tty)) {
        for (const concept of (group.conceptProperties || [])) {
          results.push({
            rxcui: concept.rxcui,
            name: concept.name,
            tty: group.tty,
            synonym: concept.synonym || ''
          });
        }
      }
    }
    return results;
  }

  /**
   * Extract concepts from a related.json response
   */
  _extractRelatedConcepts(result) {
    const groups = result?.relatedGroup?.conceptGroup || [];
    const concepts = [];
    for (const group of groups) {
      for (const concept of (group.conceptProperties || [])) {
        concepts.push({
          rxcui: concept.rxcui,
          name: concept.name,
          tty: concept.tty || group.tty,
          synonym: concept.synonym || ''
        });
      }
    }
    return concepts;
  }
}

// Singleton export
const rxNormService = new RxNormService();
module.exports = rxNormService;
