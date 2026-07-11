/**
 * DailyMed Drug Labeling Service
 * Integrates with NLM's DailyMed API for official FDA drug prescribing information.
 * Package inserts, black box warnings, dosage, contraindications, interactions, pregnancy info.
 *
 * API: https://dailymed.nlm.nih.gov/dailymed/services/v2 (FREE, no API key required)
 */

const NodeCache = require('node-cache');
const axios = require('axios');
const https = require('https');
const externalApiGateway = require('./externalApiGatewayService');
const serviceAccountManager = require('./serviceAccountManager');

// Force IPv4 to avoid IPv6 timeout issues
const httpsAgent = new https.Agent({ family: 4 });

class DailyMedService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    // 7-day cache - drug labels change very infrequently
    this.cache = new NodeCache({ stdTTL: 604800, checkperiod: 3600 });
  }

  async initialize() {
    if (this.initialized) return;

    try {
      this.serviceToken = await serviceAccountManager.authenticate('dailymed-service');
      await externalApiGateway.initialize();
      this.initialized = true;
      console.log('✅ DailyMed Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize DailyMed Service:', error);
      throw error;
    }
  }

  /**
   * Search for drug labels by name
   * @param {string} drugName - Drug name to search
   * @param {object} options - { userId, limit }
   * @returns {object} { results: [{ setId, title, publishedDate }] }
   */
  async searchDrugLabel(drugName, options = {}) {
    await this.initialize();

    const cacheKey = `search:${drugName.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await externalApiGateway.makeRequest(
        'dailymed',
        '/spls.json',
        { drug_name: drugName, page: 1, pagesize: options.limit || 10 },
        { userId: options.userId }
      );

      const data = result?.data || [];
      const results = data.map(item => ({
        setId: item.setid,
        title: item.title,
        publishedDate: item.published_date,
        labeler: item.labeler
      }));

      const response = {
        query: drugName,
        totalResults: result?.metadata?.total_elements || results.length,
        results,
        source: 'DailyMed (NLM/FDA)'
      };

      this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      console.error('DailyMed search error:', error);
      return {
        query: drugName,
        totalResults: 0,
        results: [],
        error: error.message,
        source: 'DailyMed (NLM/FDA)'
      };
    }
  }

  /**
   * Get full drug label (prescribing information) by Set ID
   * @param {string} setId - DailyMed Set ID
   * @param {object} options - { userId }
   * @returns {object} Full label with all sections
   */
  async getDrugLabel(setId, options = {}) {
    await this.initialize();

    const cacheKey = `label:${setId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      // DailyMed only returns full label content as XML (JSON returns 415)
      const url = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${setId}.xml`;
      const axiosResponse = await axios.get(url, {
        timeout: 30000,
        httpsAgent,
        responseType: 'text',
        headers: {
          'User-Agent': 'IntelliCare/1.0 (Healthcare Management System)',
          'Accept': '*/*'
        }
      });

      const xml = axiosResponse.data;
      const sections = this.parseSplXml(xml);

      const response = {
        setId,
        title: sections._title || '',
        sections,
        source: 'DailyMed (NLM/FDA)'
      };

      this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      console.error('DailyMed get label error:', error.message);
      return { setId, sections: {}, error: error.message, source: 'DailyMed (NLM/FDA)' };
    }
  }

  /**
   * Get prescribing information - searches by name, gets first label, extracts key sections
   * @param {string} drugName - Drug name
   * @param {object} options - { userId }
   * @returns {object} Key prescribing sections
   */
  async getDrugPrescribingInfo(drugName, options = {}) {
    await this.initialize();

    const cacheKey = `prescribing:${drugName.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      // Search with more results to find a label with actual content
      // Repackager labels (e.g., Aphena Pharma) often have empty sections
      const searchResult = await this.searchDrugLabel(drugName, { ...options, limit: 20 });
      if (!searchResult.results || searchResult.results.length === 0) {
        return {
          drugName,
          found: false,
          message: `No FDA label found for "${drugName}". Try the exact brand or generic name.`,
          source: 'DailyMed (NLM/FDA)'
        };
      }

      // Key prescribing sections we expect in a real (non-repackager) label
      const KEY_SECTIONS = ['indicationsAndUsage', 'dosageAndAdministration', 'contraindications', 'warningsAndPrecautions', 'adverseReactions'];

      // Try up to 5 labels to find one with actual prescribing content
      let bestLabel = null;
      let bestResult = null;
      let bestSectionCount = 0;

      const maxTries = Math.min(searchResult.results.length, 5);
      for (let i = 0; i < maxTries; i++) {
        const candidate = searchResult.results[i];
        const label = await this.getDrugLabel(candidate.setId, options);
        const sections = label.sections || {};

        // Count how many key sections have content
        const sectionCount = KEY_SECTIONS.filter(key => sections[key] && sections[key].length > 20).length;

        if (sectionCount > bestSectionCount) {
          bestSectionCount = sectionCount;
          bestLabel = label;
          bestResult = candidate;
        }

        // If we found a label with 3+ key sections, use it
        if (sectionCount >= 3) break;
      }

      if (!bestLabel) {
        bestLabel = await this.getDrugLabel(searchResult.results[0].setId, options);
        bestResult = searchResult.results[0];
      }

      const sections = bestLabel.sections || {};
      const response = {
        drugName,
        labelTitle: bestResult.title,
        setId: bestResult.setId,
        labeler: bestResult.labeler,
        found: true,
        boxedWarning: sections.boxedWarning || null,
        indicationsAndUsage: sections.indicationsAndUsage || null,
        dosageAndAdministration: sections.dosageAndAdministration || null,
        contraindications: sections.contraindications || null,
        warningsAndPrecautions: sections.warningsAndPrecautions || null,
        adverseReactions: sections.adverseReactions || null,
        drugInteractions: sections.drugInteractions || null,
        useInSpecificPopulations: sections.useInSpecificPopulations || null,
        source: 'DailyMed (NLM/FDA)'
      };

      this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      console.error('DailyMed prescribing info error:', error);
      return { drugName, found: false, error: error.message, source: 'DailyMed (NLM/FDA)' };
    }
  }

  /**
   * Get black box warnings and contraindications for a drug
   * @param {string} drugName - Drug name
   * @param {object} options - { userId }
   */
  async getDrugWarnings(drugName, options = {}) {
    await this.initialize();

    const cacheKey = `warnings:${drugName.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const info = await this.getDrugPrescribingInfo(drugName, options);
      if (!info.found) return info;

      const response = {
        drugName,
        labelTitle: info.labelTitle,
        setId: info.setId,
        boxedWarning: info.boxedWarning,
        contraindications: info.contraindications,
        warningsAndPrecautions: info.warningsAndPrecautions,
        hasBoxedWarning: !!info.boxedWarning,
        source: 'DailyMed (NLM/FDA)'
      };

      this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      console.error('DailyMed warnings error:', error);
      return { drugName, error: error.message, source: 'DailyMed (NLM/FDA)' };
    }
  }

  /**
   * Get dosage and administration information
   * @param {string} drugName - Drug name
   * @param {object} options - { userId }
   */
  async getDrugDosage(drugName, options = {}) {
    await this.initialize();

    const cacheKey = `dosage:${drugName.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const info = await this.getDrugPrescribingInfo(drugName, options);
      if (!info.found) return info;

      const response = {
        drugName,
        labelTitle: info.labelTitle,
        setId: info.setId,
        dosageAndAdministration: info.dosageAndAdministration,
        indicationsAndUsage: info.indicationsAndUsage,
        source: 'DailyMed (NLM/FDA)'
      };

      this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      console.error('DailyMed dosage error:', error);
      return { drugName, error: error.message, source: 'DailyMed (NLM/FDA)' };
    }
  }

  /**
   * Get drug interaction information from the label
   * @param {string} drugName - Drug name
   * @param {object} options - { userId }
   */
  async getDrugInteractionsLabel(drugName, options = {}) {
    await this.initialize();

    const cacheKey = `interactions:${drugName.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const info = await this.getDrugPrescribingInfo(drugName, options);
      if (!info.found) return info;

      const response = {
        drugName,
        labelTitle: info.labelTitle,
        setId: info.setId,
        drugInteractions: info.drugInteractions,
        source: 'DailyMed (NLM/FDA)'
      };

      this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      console.error('DailyMed interactions error:', error);
      return { drugName, error: error.message, source: 'DailyMed (NLM/FDA)' };
    }
  }

  /**
   * Get pregnancy and lactation safety information
   * @param {string} drugName - Drug name
   * @param {object} options - { userId }
   */
  async getDrugPregnancyInfo(drugName, options = {}) {
    await this.initialize();

    const cacheKey = `pregnancy:${drugName.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const info = await this.getDrugPrescribingInfo(drugName, options);
      if (!info.found) return info;

      const response = {
        drugName,
        labelTitle: info.labelTitle,
        setId: info.setId,
        useInSpecificPopulations: info.useInSpecificPopulations,
        source: 'DailyMed (NLM/FDA)'
      };

      this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      console.error('DailyMed pregnancy info error:', error);
      return { drugName, error: error.message, source: 'DailyMed (NLM/FDA)' };
    }
  }

  /**
   * Get drug images (pill/package)
   * @param {string} setId - DailyMed Set ID
   * @param {object} options - { userId }
   */
  async getDrugImages(setId, options = {}) {
    await this.initialize();

    const cacheKey = `images:${setId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await externalApiGateway.makeRequest(
        'dailymed',
        `/spls/${setId}/media.json`,
        {},
        { userId: options.userId }
      );

      const media = result?.data || [];
      const images = media.map(m => ({
        url: m.url,
        name: m.name,
        mimeType: m.mime_type
      }));

      const response = {
        setId,
        images,
        totalImages: images.length,
        source: 'DailyMed (NLM/FDA)'
      };

      this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      console.error('DailyMed images error:', error);
      return { setId, images: [], error: error.message, source: 'DailyMed (NLM/FDA)' };
    }
  }

  /**
   * Look up drug by NDC code via DailyMed
   * @param {string} ndc - National Drug Code
   * @param {object} options - { userId }
   */
  async getDrugByNDCDailyMed(ndc, options = {}) {
    await this.initialize();

    const cacheKey = `ndc:${ndc}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await externalApiGateway.makeRequest(
        'dailymed',
        `/spls.json`,
        { ndc_code: ndc },
        { userId: options.userId }
      );

      const data = result?.data || [];
      if (data.length === 0) {
        return { ndc, found: false, message: `No label found for NDC ${ndc}`, source: 'DailyMed (NLM/FDA)' };
      }

      const item = data[0];
      const response = {
        ndc,
        found: true,
        setId: item.setid,
        title: item.title,
        labeler: item.labeler,
        publishedDate: item.published_date,
        source: 'DailyMed (NLM/FDA)'
      };

      this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      console.error('DailyMed NDC lookup error:', error);
      return { ndc, found: false, error: error.message, source: 'DailyMed (NLM/FDA)' };
    }
  }

  /**
   * Autocomplete drug names
   * @param {string} partialName - Partial drug name
   * @param {object} options - { userId }
   */
  async autocompleteDrugName(partialName, options = {}) {
    await this.initialize();

    const cacheKey = `autocomplete:${partialName.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await externalApiGateway.makeRequest(
        'dailymed',
        '/drugnames.json',
        { drug_name: partialName },
        { userId: options.userId }
      );

      const names = (result?.data || []).map(item => item.drug_name);

      const response = {
        query: partialName,
        suggestions: names,
        totalSuggestions: names.length,
        source: 'DailyMed (NLM/FDA)'
      };

      this.cache.set(cacheKey, response);
      return response;
    } catch (error) {
      console.error('DailyMed autocomplete error:', error);
      return { query: partialName, suggestions: [], error: error.message, source: 'DailyMed (NLM/FDA)' };
    }
  }

  /**
   * Parse SPL XML into structured sections
   * DailyMed returns full labels as HL7 SPL XML only (JSON returns 415)
   * Sections are identified by LOINC codes in <code> elements
   */
  parseSplXml(xml) {
    if (!xml || typeof xml !== 'string') return {};

    const sections = {};

    // LOINC section code → property name mapping
    const sectionMap = {
      '34066-1': 'boxedWarning',
      '34067-9': 'indicationsAndUsage',
      '34068-7': 'dosageAndAdministration',
      '34070-3': 'contraindications',
      '43685-7': 'warningsAndPrecautions',
      '34084-4': 'adverseReactions',
      '34073-7': 'drugInteractions',
      '43684-0': 'useInSpecificPopulations',
      '34089-3': 'clinicalPharmacology',
      '34076-0': 'patientCounselingInformation',
      '42232-9': 'warnings',
      '34071-1': 'warnings',
      '34069-5': 'howSupplied',
      '34083-6': 'overdosage',
      '34090-1': 'clinicalStudies',
      '34088-5': 'description',
      '43678-2': 'dosageFormsAndStrengths',
      '43680-8': 'nonclinicalToxicology'
    };

    // Extract title from the SPL
    const titleMatch = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    if (titleMatch) {
      sections._title = this.cleanHtml(titleMatch[1]);
    }

    // For each section code, find its <text> block in the XML
    for (const [code, name] of Object.entries(sectionMap)) {
      if (sections[name]) continue; // Don't overwrite (e.g., 'warnings' has two codes)

      const codeIdx = xml.indexOf(`code="${code}"`);
      if (codeIdx === -1) continue;

      // Find the <text> block after this code (within the same <section>)
      const textStart = xml.indexOf('<text>', codeIdx);
      if (textStart === -1) continue;

      // Make sure we don't cross into a different section's code
      const nextCodeIdx = xml.indexOf('codeSystem="2.16.840.1.113883.6.1"', codeIdx + 20);
      if (nextCodeIdx !== -1 && textStart > nextCodeIdx) continue;

      const textEnd = xml.indexOf('</text>', textStart);
      if (textEnd === -1) continue;

      const rawHtml = xml.substring(textStart + 6, textEnd);
      const text = this.cleanHtml(rawHtml);
      if (text && text.length > 5) {
        sections[name] = text;
      }
    }

    return sections;
  }

  /**
   * Strip HTML/XML tags and clean up text from label content
   */
  cleanHtml(html) {
    if (!html || typeof html !== 'string') return html;
    return html
      .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
      .replace(/<\/?(p|div|li|tr)[^>]*>/gi, '\n') // Block elements to newlines
      .replace(/<[^>]*>/g, '') // Remove all remaining HTML/XML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/[ \t]+/g, ' ')      // Collapse horizontal whitespace
      .replace(/\n\s*\n/g, '\n')    // Collapse multiple newlines
      .trim();
  }
}

// Singleton
const dailyMedService = new DailyMedService();
module.exports = dailyMedService;
