const SecureDataAccess = require('../../../backend/services/secureDataAccess');
/**
 * NIH RePORTER API Service
 * Integrates with NIH Research Portfolio Online Reporting Tools (RePORTER) API
 * Provides access to NIH research grants, funding data, publications, and project information
 * 
 * APIs Used:
 * - NIH RePORTER Search API: Research project search and details
 * - NIH RePORTER Publications API: Grant-associated publications
 * - NIH ExPORTER Historical Data: Legacy grant data
 * - NIH iCite API: Publication impact metrics
 * - ORCID API: Principal investigator information
 */

const axios = require('axios');
const productionKMS = require('../../../backend/services/productionKMS');
const SecureConfigService = require('../../../backend/services/secureConfigService');
const serviceAccountManager = require('../../../backend/services/serviceAccountManager');
const AuditLog = require('../../../backend/models/AuditLog');

class NIHReporterService {
  constructor() {
    this.initialized = false;
    this.serviceToken = null;
    this.apiKey = null; // NIH APIs are generally public but rate-limited
    this.baseUrls = {
      reporter: 'https://api.reporter.nih.gov/v2',
      icite: 'https://icite.od.nih.gov/api',
      orcid: 'https://pub.orcid.org/v3.0'
    };
    
    // NIH Institutes and Centers (IC) codes
    this.nihInstitutes = {
      'CA': 'National Cancer Institute',
      'AI': 'National Institute of Allergy and Infectious Diseases', 
      'AR': 'National Institute of Arthritis and Musculoskeletal Diseases',
      'AG': 'National Institute on Aging',
      'AA': 'National Institute on Alcohol Abuse and Alcoholism',
      'AT': 'National Center for Complementary and Integrative Health',
      'DA': 'National Institute on Drug Abuse',
      'DC': 'National Institute on Deafness and Communication Disorders',
      'DE': 'National Institute of Dental and Craniofacial Research',
      'DK': 'National Institute of Diabetes and Digestive and Kidney Diseases',
      'ES': 'National Institute of Environmental Health Sciences',
      'EY': 'National Eye Institute',
      'GM': 'National Institute of General Medical Sciences',
      'HD': 'National Institute of Child Health and Human Development',
      'HG': 'National Human Genome Research Institute',
      'HL': 'National Heart, Lung, and Blood Institute',
      'LM': 'National Library of Medicine',
      'MD': 'National Institute on Minority Health and Health Disparities',
      'MH': 'National Institute of Mental Health',
      'NR': 'National Institute of Nursing Research',
      'NS': 'National Institute of Neurological Disorders and Stroke',
      'TR': 'National Center for Advancing Translational Sciences',
      'TW': 'Fogarty International Center'
    };
    
    // Grant activity codes and their descriptions
    this.activityCodes = {
      'R01': 'Research Project Grant - Individual Investigator',
      'R03': 'Small Grant Program',
      'R15': 'Academic Research Enhancement Award',
      'R21': 'Exploratory/Developmental Research Grant',
      'R34': 'Clinical Trial Planning Grant',
      'U01': 'Research Project Cooperative Agreement',
      'U19': 'Research Program Cooperative Agreement',
      'P01': 'Research Program Project',
      'P30': 'Center Core Grant',
      'P50': 'Specialized Center',
      'T32': 'Institutional National Research Service Award',
      'F30': 'Individual Predoctoral NRSA for MD/PhD',
      'F31': 'Individual Predoctoral NRSA',
      'F32': 'Individual Postdoctoral NRSA',
      'K01': 'Mentored Research Scientist Development Award',
      'K08': 'Mentored Clinical Scientist Research Career Development Award',
      'K23': 'Mentored Patient-Oriented Research Career Development Award',
      'K99': 'Pathway to Independence Award (Postdoctoral Phase)',
      'R00': 'Pathway to Independence Award (Independent Phase)'
    };
    
    // Research focus areas
    this.researchAreas = {
      'basic': 'Basic Research',
      'clinical': 'Clinical Research',
      'translational': 'Translational Research',
      'population': 'Population Health Research',
      'health_services': 'Health Services Research',
      'training': 'Training and Career Development',
      'infrastructure': 'Research Infrastructure'
    };
    
    // Study types and methodologies
    this.studyTypes = {
      'human_subjects': 'Human Subjects Research',
      'animal_models': 'Animal Model Studies',
      'cell_culture': 'Cell Culture Studies',
      'computational': 'Computational/Bioinformatics',
      'epidemiological': 'Epidemiological Studies',
      'meta_analysis': 'Meta-Analysis/Systematic Review'
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('nih-reporter-service');
      
      // Get API key from KMS if available (NIH APIs are mostly public)
      try {
        this.apiKey = await productionKMS.getInternalKey('NIH_REPORTER_API_KEY');
      } catch (error) {
        console.log('NIH RePORTER API key not found - using public access');
      }
      
      this.initialized = true;
      console.log('NIH RePORTER Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NIH RePORTER Service:', error);
      throw new Error('Service initialization failed');
    }
  }

  /**
   * Search NIH research projects with comprehensive filtering
   * @param {Object} searchCriteria - Search parameters
   * @param {string} searchCriteria.text - Free text search
   * @param {Array} searchCriteria.agencies - NIH institutes (e.g., ['NIMH', 'NCI'])
   * @param {Array} searchCriteria.fiscalYears - Fiscal years to search
   * @param {Array} searchCriteria.activityCodes - Grant activity codes
   * @param {string} searchCriteria.principalInvestigator - PI name
   * @param {string} searchCriteria.organization - Institution name
   * @param {number} searchCriteria.minAwardAmount - Minimum award amount
   * @param {number} searchCriteria.maxAwardAmount - Maximum award amount
   * @param {Object} options - Additional options
   * @returns {Object} Research project data
   */
  async searchResearchProjects(searchCriteria, options = {}) {
    await this.initialize();
    
    try {
      const {
        text,
        agencies = [],
        fiscalYears = [],
        activityCodes = [],
        principalInvestigator,
        organization,
        minAwardAmount,
        maxAwardAmount,
        includeAbstracts = true,
        includePublications = false,
        limit = 50,
        offset = 0
      } = searchCriteria;
      
      // Build advanced search criteria
      const searchPayload = {
        criteria: {},
        include_fields: [
          'ApplId', 'SubprojectId', 'FiscalYear', 'Organization', 'AwardType',
          'ActivityCode', 'AwardAmount', 'IsActive', 'ProjectTitle', 'ContactPiName',
          'AllText', 'TermsOfAward', 'ProjectStartDate', 'ProjectEndDate', 'AgencyCode'
        ],
        offset: offset,
        limit: limit
      };
      
      // Add text search if provided
      if (text) {
        searchPayload.criteria.advanced_text_search = {
          operator: 'and',
          search_field: 'projecttitle,terms,abstracttext',
          search_text: text
        };
      }
      
      // Add fiscal year filter
      if (fiscalYears.length > 0) {
        searchPayload.criteria.fiscal_years = fiscalYears;
      } else {
        // Default to last 5 years if no specific years requested
        const currentYear = new Date().getFullYear();
        searchPayload.criteria.fiscal_years = [
          currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4
        ];
      }
      
      // Add agency filter
      if (agencies.length > 0) {
        searchPayload.criteria.agencies = agencies;
      }
      
      // Add activity codes filter
      if (activityCodes.length > 0) {
        searchPayload.criteria.award_types = activityCodes;
      }
      
      // Add PI name filter
      if (principalInvestigator) {
        searchPayload.criteria.pi_names = [{
          any_name: principalInvestigator
        }];
      }
      
      // Add organization filter
      if (organization) {
        searchPayload.criteria.institutions = [{
          name: organization
        }];
      }
      
      // Add funding amount filters
      if (minAwardAmount || maxAwardAmount) {
        searchPayload.criteria.award_amount_range = {
          min_amount: minAwardAmount || 0,
          max_amount: maxAwardAmount || 10000000
        };
      }
      
      // Include abstracts if requested
      if (includeAbstracts) {
        searchPayload.include_fields.push('AbstractText');
      }
      
      const response = await axios.post(
        `${this.baseUrls.reporter}/projects/search`,
        searchPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'IntelliCare/1.0 NIH Reporter Service'
          }
        }
      );
      
      const projects = response.data.results || [];
      
      // Enrich project data
      const enrichedProjects = await Promise.all(
        projects.map(project => this.enrichProjectData(project, {
          includePublications,
          includeImpactMetrics: options.includeImpactMetrics
        }))
      );
      
      // Calculate summary statistics
      const summary = this.calculateProjectSummary(enrichedProjects);
      
      const result = {
        searchCriteria: searchCriteria,
        totalProjects: response.data.meta?.total || enrichedProjects.length,
        returnedProjects: enrichedProjects.length,
        projects: enrichedProjects,
        summary: summary,
        fundingAnalysis: this.analyzeFundingTrends(enrichedProjects),
        researchAreas: this.categorizeResearchAreas(enrichedProjects),
        searchTime: new Date().toISOString()
      };
      
      await this.logProjectSearch(searchCriteria, result.totalProjects, options.userId);
      
      return result;
      
    } catch (error) {
      console.error('NIH project search failed:', error);
      return {
        success: false,
        error: 'Failed to search NIH projects',
        details: error.message
      };
    }
  }

  /**
   * Get detailed information for a specific NIH project
   * @param {string} projectNumber - NIH project number (e.g., '1R01CA123456-01A1')
   * @param {Object} options - Additional options
   * @returns {Object} Detailed project information
   */
  async getProjectDetails(projectNumber, options = {}) {
    await this.initialize();
    
    try {
      const {
        includePublications = true,
        includePatents = true,
        includeCollaborators = true,
        includeImpactMetrics = true
      } = options;
      
      // Get basic project information
      const projectResponse = await axios.get(
        `${this.baseUrls.reporter}/projects/${projectNumber}`,
        {
          headers: { 'User-Agent': 'IntelliCare/1.0 NIH Reporter Service' }
        }
      );
      
      const project = projectResponse.data;
      if (!project) {
        throw new Error('Project not found');
      }
      
      // Enrich with additional data
      const enrichedProject = await this.enrichProjectData(project, {
        includePublications,
        includePatents,
        includeCollaborators,
        includeImpactMetrics
      });
      
      // Get related projects (same PI or similar research area)
      const relatedProjects = await this.findRelatedProjects(project, {
        maxResults: 10
      });
      
      // Get funding history for this project
      const fundingHistory = await this.getProjectFundingHistory(projectNumber);
      
      const result = {
        project: enrichedProject,
        fundingHistory: fundingHistory,
        relatedProjects: relatedProjects,
        researchImpact: await this.assessResearchImpact(enrichedProject),
        collaborationNetwork: await this.analyzeCollaborationNetwork(enrichedProject),
        timeline: this.createProjectTimeline(enrichedProject),
        lastUpdated: new Date().toISOString()
      };
      
      await this.logProjectDetails(projectNumber, result, options.userId);
      
      return result;
      
    } catch (error) {
      console.error('Project details retrieval failed:', error);
      return {
        success: false,
        error: 'Failed to get project details',
        details: error.message
      };
    }
  }

  /**
   * Get publications associated with NIH grants
   * @param {Object} searchCriteria - Publication search criteria
   * @param {string} searchCriteria.grantNumber - Specific grant number
   * @param {string} searchCriteria.piName - Principal investigator name
   * @param {Array} searchCriteria.fiscalYears - Fiscal years
   * @param {Object} options - Additional options
   * @returns {Object} Grant-associated publications
   */
  async getGrantPublications(searchCriteria, options = {}) {
    await this.initialize();
    
    try {
      const {
        grantNumber,
        piName,
        fiscalYears = [],
        includeMetrics = true,
        limit = 100
      } = searchCriteria;
      
      let endpoint = `${this.baseUrls.reporter}/publications/search`;
      let searchPayload = {
        criteria: {},
        limit: limit,
        offset: options.offset || 0
      };
      
      // Build search criteria
      if (grantNumber) {
        searchPayload.criteria.core_project_nums = [grantNumber];
      }
      
      if (piName) {
        searchPayload.criteria.pi_names = [{
          any_name: piName
        }];
      }
      
      if (fiscalYears.length > 0) {
        searchPayload.criteria.fiscal_years = fiscalYears;
      }
      
      const response = await axios.post(endpoint, searchPayload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IntelliCare/1.0 NIH Reporter Service'
        }
      });
      
      const publications = response.data.results || [];
      
      // Enrich publications with impact metrics
      let enrichedPublications = publications;
      if (includeMetrics && publications.length > 0) {
        enrichedPublications = await this.enrichPublicationsWithMetrics(publications);
      }
      
      // Analyze publication trends
      const publicationAnalysis = this.analyzePublicationTrends(enrichedPublications);
      
      const result = {
        searchCriteria: searchCriteria,
        totalPublications: response.data.meta?.total || enrichedPublications.length,
        publications: enrichedPublications,
        analysis: publicationAnalysis,
        impactSummary: this.calculateImpactSummary(enrichedPublications),
        collaborationAnalysis: this.analyzePublicationCollaborations(enrichedPublications),
        searchTime: new Date().toISOString()
      };
      
      await this.logPublicationSearch(searchCriteria, result.totalPublications, options.userId);
      
      return result;
      
    } catch (error) {
      console.error('Grant publications search failed:', error);
      return {
        success: false,
        error: 'Failed to search grant publications',
        details: error.message
      };
    }
  }

  /**
   * Analyze research funding trends across NIH institutes
   * @param {Object} analysisParams - Analysis parameters
   * @param {Array} analysisParams.institutes - NIH institutes to analyze
   * @param {Array} analysisParams.fiscalYears - Years to analyze
   * @param {Array} analysisParams.researchAreas - Research areas to focus on
   * @param {Object} options - Additional options
   * @returns {Object} Funding trends analysis
   */
  async analyzeFundingTrends(analysisParams, options = {}) {
    await this.initialize();
    
    try {
      const {
        institutes = [],
        fiscalYears = [],
        researchAreas = [],
        activityCodes = [],
        includeSmallGrants = true
      } = analysisParams;
      
      // Get funding data for analysis
      const fundingData = await this.getFundingTrendsData({
        institutes,
        fiscalYears,
        researchAreas,
        activityCodes,
        includeSmallGrants
      });
      
      // Perform trend analysis
      const trendAnalysis = {
        yearOverYear: this.calculateYearOverYearTrends(fundingData),
        instituteComparison: this.compareInstitutesFunding(fundingData),
        researchAreaTrends: this.analyzeResearchAreaFunding(fundingData),
        grantSizeDistribution: this.analyzeGrantSizeDistribution(fundingData),
        successRates: this.calculateApplicationSuccessRates(fundingData),
        emergingAreas: this.identifyEmergingResearchAreas(fundingData)
      };
      
      // Generate predictions and insights
      const insights = this.generateFundingInsights(trendAnalysis);
      
      const result = {
        analysisParams: analysisParams,
        fundingTrends: trendAnalysis,
        insights: insights,
        recommendations: this.generateFundingRecommendations(trendAnalysis),
        dataRange: this.calculateDataRange(fundingData),
        lastUpdated: new Date().toISOString()
      };
      
      await this.logFundingAnalysis(analysisParams, result, options.userId);
      
      return result;
      
    } catch (error) {
      console.error('Funding trends analysis failed:', error);
      return {
        success: false,
        error: 'Failed to analyze funding trends',
        details: error.message
      };
    }
  }

  /**
   * Find research collaborators and networks
   * @param {Object} searchCriteria - Collaboration search parameters
   * @param {string} searchCriteria.piName - Principal investigator name
   * @param {string} searchCriteria.institution - Institution name
   * @param {string} searchCriteria.researchArea - Research area/keywords
   * @param {Object} options - Additional options
   * @returns {Object} Collaboration network data
   */
  async findCollaborationNetworks(searchCriteria, options = {}) {
    await this.initialize();
    
    try {
      const {
        piName,
        institution,
        researchArea,
        includeInternational = true,
        networkDepth = 2,
        minCollaborations = 3
      } = searchCriteria;
      
      // Get collaboration data
      const collaborationData = await this.getCollaborationData(searchCriteria);
      
      // Build network graph
      const networkGraph = this.buildCollaborationNetwork(collaborationData, {
        networkDepth,
        minCollaborations
      });
      
      // Analyze network properties
      const networkAnalysis = this.analyzeNetworkProperties(networkGraph);
      
      // Identify key collaborators and hubs
      const keyCollaborators = this.identifyKeyCollaborators(networkGraph);
      
      // Find collaboration opportunities
      const opportunities = this.findCollaborationOpportunities(networkGraph, searchCriteria);
      
      const result = {
        searchCriteria: searchCriteria,
        collaborationNetwork: networkGraph,
        networkAnalysis: networkAnalysis,
        keyCollaborators: keyCollaborators,
        opportunities: opportunities,
        internationalCollaborations: this.analyzeInternationalCollaborations(networkGraph),
        disciplinaryDiversity: this.analyzeDisciplinaryDiversity(networkGraph),
        lastUpdated: new Date().toISOString()
      };
      
      await this.logCollaborationAnalysis(searchCriteria, result, options.userId);
      
      return result;
      
    } catch (error) {
      console.error('Collaboration network analysis failed:', error);
      return {
        success: false,
        error: 'Failed to analyze collaboration networks',
        details: error.message
      };
    }
  }

  // Helper methods for data processing and analysis

  async enrichProjectData(project, options = {}) {
    const enriched = { ...project };
    
    // Add institute name
    const agencyCode = project.agency_code || project.AgencyCode;
    if (agencyCode) {
      enriched.instituteName = this.nihInstitutes[agencyCode] || `NIH ${agencyCode}`;
    }
    
    // Add activity code description
    const activityCode = project.activity_code || project.ActivityCode;
    if (activityCode) {
      enriched.activityDescription = this.activityCodes[activityCode] || activityCode;
    }
    
    // Format funding amount
    if (project.award_amount || project.AwardAmount) {
      const amount = project.award_amount || project.AwardAmount;
      enriched.formattedAwardAmount = this.formatCurrency(amount);
    }
    
    // Add publications if requested
    if (options.includePublications) {
      try {
        enriched.publications = await this.getProjectPublications(
          project.core_project_num || project.ProjectNumber
        );
      } catch (error) {
        console.warn('Failed to get project publications:', error.message);
      }
    }
    
    // Add impact metrics if requested
    if (options.includeImpactMetrics) {
      enriched.impactMetrics = await this.calculateProjectImpact(project);
    }
    
    return enriched;
  }

  calculateProjectSummary(projects) {
    if (!projects.length) return {};
    
    const totalFunding = projects.reduce((sum, p) => {
      const amount = p.award_amount || p.AwardAmount || 0;
      return sum + (typeof amount === 'number' ? amount : 0);
    }, 0);
    
    const institutes = [...new Set(projects.map(p => p.agency_code || p.AgencyCode))];
    const activityCodes = [...new Set(projects.map(p => p.activity_code || p.ActivityCode))];
    
    return {
      totalProjects: projects.length,
      totalFunding: this.formatCurrency(totalFunding),
      avgAwardAmount: this.formatCurrency(totalFunding / projects.length),
      institutes: institutes.length,
      activityTypes: activityCodes.length,
      activeProjects: projects.filter(p => p.is_active || p.IsActive).length
    };
  }

  analyzeFundingTrends(projects) {
    const trendsByYear = {};
    
    projects.forEach(project => {
      const year = project.fiscal_year || project.FiscalYear;
      if (year) {
        if (!trendsByYear[year]) {
          trendsByYear[year] = {
            count: 0,
            totalFunding: 0,
            avgAmount: 0
          };
        }
        
        trendsByYear[year].count++;
        const amount = project.award_amount || project.AwardAmount || 0;
        trendsByYear[year].totalFunding += amount;
      }
    });
    
    // Calculate averages
    Object.keys(trendsByYear).forEach(year => {
      const yearData = trendsByYear[year];
      yearData.avgAmount = yearData.totalFunding / yearData.count;
    });
    
    return trendsByYear;
  }

  categorizeResearchAreas(projects) {
    // Simplified research area categorization based on project titles and terms
    const areas = {};
    
    projects.forEach(project => {
      const title = (project.project_title || project.ProjectTitle || '').toLowerCase();
      const terms = (project.project_terms || project.Terms || '').toLowerCase();
      const text = `${title} ${terms}`;
      
      // Basic categorization logic
      if (text.includes('cancer') || text.includes('oncolog')) {
        areas.cancer = (areas.cancer || 0) + 1;
      }
      if (text.includes('brain') || text.includes('neuro')) {
        areas.neuroscience = (areas.neuroscience || 0) + 1;
      }
      if (text.includes('heart') || text.includes('cardio')) {
        areas.cardiovascular = (areas.cardiovascular || 0) + 1;
      }
      if (text.includes('mental') || text.includes('psychiatr')) {
        areas.mentalHealth = (areas.mentalHealth || 0) + 1;
      }
      if (text.includes('infect') || text.includes('pathogen')) {
        areas.infectiousDisease = (areas.infectiousDisease || 0) + 1;
      }
    });
    
    return areas;
  }

  formatCurrency(amount) {
    if (typeof amount !== 'number') return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  // Additional helper methods (stubs for full implementation)
  async findRelatedProjects(project, options) { return []; }
  async getProjectFundingHistory(projectNumber) { return []; }
  async assessResearchImpact(project) { return {}; }
  async analyzeCollaborationNetwork(project) { return {}; }
  createProjectTimeline(project) { return []; }
  async enrichPublicationsWithMetrics(publications) { return publications; }
  analyzePublicationTrends(publications) { return {}; }
  calculateImpactSummary(publications) { return {}; }
  analyzePublicationCollaborations(publications) { return {}; }
  async getFundingTrendsData(params) { return []; }
  calculateYearOverYearTrends(data) { return {}; }
  compareInstitutesFunding(data) { return {}; }
  analyzeResearchAreaFunding(data) { return {}; }
  analyzeGrantSizeDistribution(data) { return {}; }
  calculateApplicationSuccessRates(data) { return {}; }
  identifyEmergingResearchAreas(data) { return []; }
  generateFundingInsights(analysis) { return []; }
  generateFundingRecommendations(analysis) { return []; }
  calculateDataRange(data) { return {}; }
  async getCollaborationData(criteria) { return []; }
  buildCollaborationNetwork(data, options) { return {}; }
  analyzeNetworkProperties(network) { return {}; }
  identifyKeyCollaborators(network) { return []; }
  findCollaborationOpportunities(network, criteria) { return []; }
  analyzeInternationalCollaborations(network) { return {}; }
  analyzeDisciplinaryDiversity(network) { return {}; }
  async getProjectPublications(projectNumber) { return []; }
  async calculateProjectImpact(project) { return {}; }

  // Audit logging methods
  async logProjectSearch(criteria, resultCount, userId) {
    await this.auditLog('NIH_PROJECT_SEARCH', { criteria, resultCount }, userId);
  }

  async logProjectDetails(projectNumber, result, userId) {
    await this.auditLog('NIH_PROJECT_DETAILS', { projectNumber, hasPublications: !!result.project.publications }, userId);
  }

  async logPublicationSearch(criteria, resultCount, userId) {
    await this.auditLog('NIH_PUBLICATION_SEARCH', { criteria, resultCount }, userId);
  }

  async logFundingAnalysis(params, result, userId) {
    await this.auditLog('NIH_FUNDING_ANALYSIS', { params, trendsAnalyzed: Object.keys(result.fundingTrends).length }, userId);
  }

  async logCollaborationAnalysis(criteria, result, userId) {
    await this.auditLog('NIH_COLLABORATION_ANALYSIS', { criteria, networkSize: result.networkAnalysis.nodeCount }, userId);
  }

  async auditLog(action, details, userId) {
    try {
      await AuditLog.create({
        action: action,
        resourceType: 'nih_research',
        userId: userId || 'system',
        details: details,
        timestamp: new Date(),
        serviceId: 'nih-reporter-service'
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }
}

module.exports = new NIHReporterService();
