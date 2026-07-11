// Clinical Research Service
// Migrated to DDD NX architecture - Clinical Care Context - Research Feature
// Comprehensive clinical research service integrating NIH APIs, ClinicalTrials.gov,
// PubMed, NCBI Datasets, and genomics research databases

const crypto = require('crypto');

// Service proxy for lazy loading (prevents circular dependencies)
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

/**
 * Clinical Research Service
 * Integrates with multiple research databases and APIs for evidence-based medicine
 */
class ClinicalResearchService {
  constructor() {
    this.serviceId = 'clinical-research-service';
    this.serviceToken = null;
    this.initialized = false;
    this.researchCache = new Map();
    this.trialMatchingCache = new Map();
    this.literatureAlerts = new Map();
    
    // Clinical trial phases
    this.trialPhases = {
      'EARLY_PHASE1': { name: 'Early Phase 1', description: 'First-in-human studies' },
      'PHASE1': { name: 'Phase 1', description: 'Safety and dosage studies' },
      'PHASE1_PHASE2': { name: 'Phase 1/2', description: 'Combined safety and efficacy' },
      'PHASE2': { name: 'Phase 2', description: 'Efficacy studies' },
      'PHASE3': { name: 'Phase 3', description: 'Large-scale effectiveness studies' },
      'PHASE4': { name: 'Phase 4', description: 'Post-market surveillance' }
    };
    
    // Study types
    this.studyTypes = {
      'INTERVENTIONAL': 'Clinical trials testing treatments',
      'OBSERVATIONAL': 'Studies observing health outcomes',
      'EXPANDED_ACCESS': 'Compassionate use programs'
    };
    
    // Evidence levels for literature analysis
    this.evidenceLevels = {
      'SYSTEMATIC_REVIEW': { level: 1, weight: 1.0, description: 'Systematic review/meta-analysis' },
      'RCT': { level: 2, weight: 0.9, description: 'Randomized controlled trial' },
      'COHORT_STUDY': { level: 3, weight: 0.7, description: 'Cohort study' },
      'CASE_CONTROL': { level: 4, weight: 0.6, description: 'Case-control study' },
      'CASE_SERIES': { level: 5, weight: 0.4, description: 'Case series' },
      'EXPERT_OPINION': { level: 6, weight: 0.2, description: 'Expert opinion' }
    };
    
    // Genomics databases and data types
    this.genomicsResources = {
      'dbSNP': {
        name: 'Single Nucleotide Polymorphism Database',
        description: 'Genetic variation data including SNPs and small indels',
        baseUrl: 'https://api.ncbi.nlm.nih.gov/variation/v0'
      },
      'ClinVar': {
        name: 'Clinical Significance of Variants',
        description: 'Clinical interpretation of genetic variants',
        baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
      },
      'GTEx': {
        name: 'Genotype-Tissue Expression',
        description: 'Gene expression across human tissues',
        baseUrl: 'https://gtexportal.org/rest/v1'
      },
      'TCGA': {
        name: 'The Cancer Genome Atlas',
        description: 'Cancer genomics data',
        baseUrl: 'https://api.gdc.cancer.gov'
      },
      'PharmGKB': {
        name: 'Pharmacogenomics Knowledge Base',
        description: 'Drug-gene interaction data',
        baseUrl: 'https://api.pharmgkb.org'
      }
    };
    
    // Common variant effect classifications
    this.variantEffects = {
      'pathogenic': { severity: 'high', clinical_significance: 'Disease-causing' },
      'likely_pathogenic': { severity: 'medium-high', clinical_significance: 'Probably disease-causing' },
      'uncertain_significance': { severity: 'medium', clinical_significance: 'Unknown clinical impact' },
      'likely_benign': { severity: 'low', clinical_significance: 'Probably not disease-causing' },
      'benign': { severity: 'none', clinical_significance: 'Not disease-causing' }
    };
    
    // Pharmacogenomic categories
    this.pgxCategories = {
      'metabolism': 'Drug metabolism and clearance',
      'efficacy': 'Drug response and effectiveness', 
      'toxicity': 'Adverse drug reactions',
      'dosing': 'Drug dosing recommendations',
      'contraindication': 'Drug contraindications based on genetics'
    };
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Authenticate service with serviceAccountManager
      const serviceAccountManager = this.getServiceAccountManager();
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Initialize external API gateway
      const externalApiGateway = this.getExternalApiGateway();
      await externalApiGateway.initialize();
      
      // Load research cache
      await this.loadResearchCache();
      
      // Start literature monitoring
      this.startLiteratureMonitoring();
      
      // Initialize trial matching algorithms
      await this.initializeTrialMatching();
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize',
        practiceId: 'global'
      };
      
      const secureDataAccess = this.getSecureDataAccess();
      await secureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'clinicalResearchService',
        timestamp: new Date()
      }, context);
      
      console.log('✅ Clinical Research Service initialized');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize Clinical Research Service:', error);
      throw error;
    }
  }

  // Helper methods for service access - CRITICAL for clinical research operations
  getSecureDataAccess() {
    return getServiceProxy().getService('secureDataAccess');
  }

  getServiceAccountManager() {
    return getServiceProxy().getService('serviceAccountManager');
  }

  getExternalApiGateway() {
    return getServiceProxy().getService('externalApiGatewayService');
  }

  async loadResearchCache() {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'load-research-cache',
        practiceId: 'global'
      };

      const secureDataAccess = this.getSecureDataAccess();
      const cachedData = await secureDataAccess.query(
        'research_cache',
        { active: true },
        { limit: 1000 },
        context
      );

      cachedData.forEach(item => {
        this.researchCache.set(item.key, {
          data: item.data,
          timestamp: item.timestamp,
          expiry: item.expiry
        });
      });
    } catch (error) {
      console.error('Failed to load research cache:', error);
    }
  }

  startLiteratureMonitoring() {
    // Check for literature alerts every hour
    setInterval(async () => {
      try {
        await this.processLiteratureAlerts();
      } catch (error) {
        console.error('Literature monitoring error:', error);
      }
    }, 3600000); // 1 hour
  }

  async initializeTrialMatching() {
    // Initialize trial matching algorithms and load reference data
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize-trial-matching',
        practiceId: 'global'
      };

      const secureDataAccess = this.getSecureDataAccess();
      const existingMatches = await secureDataAccess.query(
        'trial_matches',
        { active: true },
        { limit: 500 },
        context
      );

      existingMatches.forEach(match => {
        this.trialMatchingCache.set(match.patientId, {
          trials: match.trials,
          lastUpdated: match.lastUpdated,
          nextUpdate: match.nextUpdate
        });
      });
    } catch (error) {
      console.error('Failed to initialize trial matching:', error);
    }
  }

  /**
   * Search clinical trials for patient matching
   */
  async searchClinicalTrials(searchCriteria, practiceContext = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      const {
        condition,
        intervention,
        location,
        phase,
        recruitmentStatus = 'RECRUITING',
        studyType,
        ageRange,
        gender,
        limit = 20
      } = searchCriteria;
      
      // Build search query
      const query = this.buildTrialSearchQuery({
        condition,
        intervention,
        phase,
        recruitmentStatus,
        studyType
      });
      
      const searchParams = {
        'query.cond': condition,
        'query.intr': intervention,
        'query.locn': location,
        'filter.overallStatus': recruitmentStatus,
        'filter.phases': phase,
        'filter.studyType': studyType,
        'countTotal': true,
        'pageSize': limit,
        'format': 'json'
      };
      
      // Remove undefined parameters
      Object.keys(searchParams).forEach(key => {
        if (searchParams[key] === undefined) {
          delete searchParams[key];
        }
      });
      
      const externalApiGateway = this.getExternalApiGateway();
      const result = await externalApiGateway.makeRequest(
        'clinicalTrials',
        '/studies',
        searchParams,
        { userId: practiceContext.userId }
      );
      
      const trials = (result.studies || []).map(study => this.formatClinicalTrial(study));
      
      // Filter by additional criteria
      const filteredTrials = this.filterTrialsByCriteria(trials, {
        ageRange,
        gender,
        location
      });
      
      // Rank trials by relevance
      const rankedTrials = this.rankTrialsByRelevance(filteredTrials, searchCriteria);
      
      const response = {
        searchCriteria: searchCriteria,
        totalTrials: result.totalCount || filteredTrials.length,
        matchedTrials: rankedTrials.length,
        trials: rankedTrials,
        searchQuery: query,
        lastUpdated: new Date().toISOString()
      };
      
      await this.logTrialSearch(searchCriteria, response.matchedTrials, practiceContext.userId);
      
      return response;
      
    } catch (error) {
      console.error('Clinical trial search error:', error);
      throw new Error(`Failed to search clinical trials: ${error.message}`);
    }
  }

  buildTrialSearchQuery(criteria) {
    let query = '';
    if (criteria.condition) query += criteria.condition;
    if (criteria.intervention) query += ` AND ${criteria.intervention}`;
    if (criteria.phase) query += ` AND ${criteria.phase}`;
    return query;
  }

  filterTrialsByCriteria(trials, criteria) {
    return trials.filter(trial => {
      // Age range filtering
      if (criteria.ageRange && !this.matchesAgeRange(criteria.ageRange, trial.eligibility.minAge, trial.eligibility.maxAge)) {
        return false;
      }
      
      // Gender filtering
      if (criteria.gender && trial.eligibility.gender !== 'ALL' && 
          trial.eligibility.gender?.toLowerCase() !== criteria.gender.toLowerCase()) {
        return false;
      }
      
      return true;
    });
  }

  rankTrialsByRelevance(trials, searchCriteria) {
    return trials.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      
      // Score based on condition match
      if (a.conditions?.some(c => c.toLowerCase().includes(searchCriteria.condition?.toLowerCase() || ''))) {
        scoreA += 3;
      }
      if (b.conditions?.some(c => c.toLowerCase().includes(searchCriteria.condition?.toLowerCase() || ''))) {
        scoreB += 3;
      }
      
      // Score based on phase preference (Phase 3 trials often preferred)
      if (a.phase === 'PHASE3') scoreA += 2;
      if (b.phase === 'PHASE3') scoreB += 2;
      
      // Score based on enrollment status
      if (a.status === 'RECRUITING') scoreA += 1;
      if (b.status === 'RECRUITING') scoreB += 1;
      
      return scoreB - scoreA;
    });
  }

  /**
   * Advanced patient-trial matching using AI-inspired algorithms
   */
  async matchPatientToTrials(patientProfile, practiceContext = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      // Extract matching criteria from patient profile
      const matchingCriteria = this.extractMatchingCriteria(patientProfile);
      
      // Search for relevant trials
      const trialResults = await this.searchClinicalTrials({
        condition: matchingCriteria.primaryCondition,
        intervention: matchingCriteria.preferredIntervention,
        location: matchingCriteria.location,
        ageRange: matchingCriteria.ageRange,
        gender: matchingCriteria.gender,
        limit: 50
      }, practiceContext);
      
      // Advanced matching algorithm
      const matches = [];
      for (const trial of trialResults.trials) {
        const matchScore = await this.calculateTrialMatchScore(patientProfile, trial);
        if (matchScore.totalScore >= 0.6) { // 60% match threshold
          matches.push({
            trial: trial,
            matchScore: matchScore,
            eligibilityAssessment: await this.assessEligibility(patientProfile, trial),
            recommendations: this.generateTrialRecommendations(matchScore, trial)
          });
        }
      }
      
      // Sort by match score
      matches.sort((a, b) => b.matchScore.totalScore - a.matchScore.totalScore);
      
      const result = {
        patient: {
          id: patientProfile.id,
          primaryCondition: matchingCriteria.primaryCondition,
          age: matchingCriteria.age,
          gender: matchingCriteria.gender
        },
        totalTrialsSearched: trialResults.totalTrials,
        eligibleTrials: matches.length,
        topMatches: matches.slice(0, 10),
        matchingSummary: this.generateMatchingSummary(matches),
        processingTime: new Date().toISOString()
      };
      
      await this.logPatientTrialMatching(patientProfile.id, result, practiceContext.userId);
      
      return result;
      
    } catch (error) {
      console.error('Patient-trial matching error:', error);
      throw new Error(`Failed to match patient to trials: ${error.message}`);
    }
  }

  extractMatchingCriteria(patientProfile) {
    return {
      primaryCondition: patientProfile.diagnosis || patientProfile.condition,
      age: patientProfile.age,
      gender: patientProfile.gender,
      location: patientProfile.location || patientProfile.address,
      preferredIntervention: patientProfile.preferredTreatment,
      ageRange: `${patientProfile.age - 5}-${patientProfile.age + 5}`
    };
  }

  async calculateTrialMatchScore(patientProfile, trial) {
    const scores = {
      conditionMatch: 0,
      demographicMatch: 0,
      locationMatch: 0,
      eligibilityMatch: 0,
      interventionMatch: 0
    };
    
    // Condition matching
    if (trial.conditions?.some(condition => 
      patientProfile.primaryCondition?.toLowerCase().includes(condition.toLowerCase())
    )) {
      scores.conditionMatch = 1.0;
    }
    
    // Demographic matching
    if (this.matchesAgeRange(patientProfile.age, trial.eligibility.minAge, trial.eligibility.maxAge)) {
      scores.demographicMatch += 0.5;
    }
    
    if (trial.eligibility.gender === 'ALL' || 
        trial.eligibility.gender?.toLowerCase() === patientProfile.gender?.toLowerCase()) {
      scores.demographicMatch += 0.5;
    }
    
    // Location matching (if provided)
    if (patientProfile.location && trial.locations?.length) {
      const locationMatch = trial.locations.some(loc => 
        this.isWithinReasonableDistance(patientProfile.location, loc)
      );
      scores.locationMatch = locationMatch ? 1.0 : 0.3; // Partial score for remote participation
    } else {
      scores.locationMatch = 0.5; // Neutral if no location data
    }
    
    // Basic eligibility assessment
    scores.eligibilityMatch = 0.7; // Default assumption - would need detailed eligibility checking
    
    // Intervention relevance
    if (patientProfile.preferredTreatments && trial.interventions?.length) {
      const interventionMatch = trial.interventions.some(intervention =>
        patientProfile.preferredTreatments.some(pref =>
          intervention.name?.toLowerCase().includes(pref.toLowerCase())
        )
      );
      scores.interventionMatch = interventionMatch ? 1.0 : 0.5;
    } else {
      scores.interventionMatch = 0.6;
    }
    
    // Calculate weighted total score
    const weights = {
      conditionMatch: 0.4,
      demographicMatch: 0.2,
      locationMatch: 0.15,
      eligibilityMatch: 0.15,
      interventionMatch: 0.1
    };
    
    const totalScore = Object.keys(scores).reduce((total, key) => {
      return total + (scores[key] * weights[key]);
    }, 0);
    
    return {
      totalScore: totalScore,
      componentScores: scores,
      confidence: this.calculateMatchConfidence(scores),
      explanation: this.generateMatchExplanation(scores, weights)
    };
  }

  calculateMatchConfidence(scores) {
    const scoreValues = Object.values(scores);
    const averageScore = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
    const variance = scoreValues.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) / scoreValues.length;
    return Math.max(0, 1 - variance); // Higher confidence with lower variance
  }

  generateMatchExplanation(scores, weights) {
    const explanations = [];
    Object.keys(scores).forEach(key => {
      if (scores[key] > 0.7) {
        explanations.push(`Strong ${key.replace('Match', '')} alignment`);
      } else if (scores[key] < 0.3) {
        explanations.push(`Weak ${key.replace('Match', '')} alignment`);
      }
    });
    return explanations.join(', ');
  }

  async assessEligibility(patientProfile, trial) {
    // Basic eligibility assessment
    return {
      eligible: true, // Simplified - would need detailed criteria checking
      concerns: [],
      recommendations: ['Contact study coordinator for detailed screening']
    };
  }

  generateTrialRecommendations(matchScore, trial) {
    const recommendations = [];
    
    if (matchScore.totalScore > 0.8) {
      recommendations.push('Excellent match - recommend immediate contact');
    } else if (matchScore.totalScore > 0.6) {
      recommendations.push('Good match - worth discussing with patient');
    }
    
    if (trial.phase === 'PHASE3') {
      recommendations.push('Late-stage trial with established safety profile');
    }
    
    return recommendations;
  }

  generateMatchingSummary(matches) {
    return {
      totalMatches: matches.length,
      averageMatchScore: matches.length > 0 ? 
        matches.reduce((sum, m) => sum + m.matchScore.totalScore, 0) / matches.length : 0,
      highConfidenceMatches: matches.filter(m => m.matchScore.totalScore > 0.8).length,
      phaseDistribution: this.calculatePhaseDistribution(matches)
    };
  }

  calculatePhaseDistribution(matches) {
    const distribution = {};
    matches.forEach(match => {
      const phase = match.trial.phase || 'Unknown';
      distribution[phase] = (distribution[phase] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Search medical literature using PubMed
   */
  async searchMedicalLiterature(query, practiceContext = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      const {
        publishedAfter,
        studyTypes = [],
        language = 'eng',
        limit = 20,
        includeAbstracts = true
      } = practiceContext;
      
      // Build PubMed search parameters
      const searchParams = {
        db: 'pubmed',
        term: this.buildPubMedQuery(query, {
          publishedAfter,
          studyTypes,
          language
        }),
        retmax: limit,
        retmode: 'json',
        sort: 'relevance'
      };
      
      // Search PubMed
      const externalApiGateway = this.getExternalApiGateway();
      const searchResult = await externalApiGateway.makeRequest(
        'pubmed',
        '/esearch.fcgi',
        searchParams,
        { userId: practiceContext.userId }
      );
      
      if (!searchResult.esearchresult?.idlist?.length) {
        return {
          query: query,
          totalResults: 0,
          articles: [],
          searchTime: new Date().toISOString()
        };
      }
      
      const pmids = searchResult.esearchresult.idlist;
      
      // Get article details
      const articles = await this.getArticleDetails(pmids, includeAbstracts, practiceContext);
      
      // Analyze evidence levels
      const articlesWithEvidence = articles.map(article => ({
        ...article,
        evidenceLevel: this.analyzeEvidenceLevel(article),
        clinicalRelevance: this.assessClinicalRelevance(article, query)
      }));
      
      // Sort by evidence level and relevance
      articlesWithEvidence.sort((a, b) => {
        const aScore = a.evidenceLevel.weight + a.clinicalRelevance.score;
        const bScore = b.evidenceLevel.weight + b.clinicalRelevance.score;
        return bScore - aScore;
      });
      
      const result = {
        query: query,
        totalResults: parseInt(searchResult.esearchresult.count),
        articlesReturned: articlesWithEvidence.length,
        articles: articlesWithEvidence,
        evidenceSummary: this.summarizeEvidence(articlesWithEvidence),
        searchTime: new Date().toISOString()
      };
      
      await this.logLiteratureSearch(query, result.totalResults, practiceContext.userId);
      
      return result;
      
    } catch (error) {
      console.error('Medical literature search error:', error);
      throw new Error(`Failed to search medical literature: ${error.message}`);
    }
  }

  buildPubMedQuery(baseQuery, filters = {}) {
    let query = baseQuery;
    
    if (filters.publishedAfter) {
      query += ` AND ("${filters.publishedAfter}"[Date - Publication] : "3000"[Date - Publication])`;
    }
    
    if (filters.studyTypes?.length) {
      const studyTypeQuery = filters.studyTypes.map(type => `"${type}"[Publication Type]`).join(' OR ');
      query += ` AND (${studyTypeQuery})`;
    }
    
    if (filters.language) {
      query += ` AND ${filters.language}[Language]`;
    }
    
    return query;
  }

  async getArticleDetails(pmids, includeAbstracts = true, practiceContext = {}) {
    try {
      const fetchParams = {
        db: 'pubmed',
        id: pmids.join(','),
        retmode: 'json',
        rettype: includeAbstracts ? 'abstract' : 'summary'
      };
      
      const externalApiGateway = this.getExternalApiGateway();
      const result = await externalApiGateway.makeRequest(
        'pubmed',
        '/efetch.fcgi',
        fetchParams,
        { userId: practiceContext.userId }
      );
      
      // Process PubMed XML/JSON response - simplified for demo
      return pmids.map(pmid => ({
        pmid: pmid,
        title: `Article ${pmid}`, // Would parse actual XML response
        authors: [],
        journal: '',
        publicationDate: '',
        abstract: includeAbstracts ? `Abstract for ${pmid}` : null,
        doi: '',
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
      }));
      
    } catch (error) {
      console.warn('Failed to fetch article details:', error.message);
      return pmids.map(pmid => ({ pmid, title: `Article ${pmid}`, error: 'Details unavailable' }));
    }
  }

  analyzeEvidenceLevel(article) {
    // Simple heuristic-based classification
    const title = article.title?.toLowerCase() || '';
    const abstract = article.abstract?.toLowerCase() || '';
    
    if (title.includes('systematic review') || title.includes('meta-analysis')) {
      return this.evidenceLevels.SYSTEMATIC_REVIEW;
    }
    
    if (title.includes('randomized') || abstract.includes('randomized controlled')) {
      return this.evidenceLevels.RCT;
    }
    
    if (title.includes('cohort') || abstract.includes('cohort study')) {
      return this.evidenceLevels.COHORT_STUDY;
    }
    
    if (title.includes('case-control') || abstract.includes('case-control')) {
      return this.evidenceLevels.CASE_CONTROL;
    }
    
    if (title.includes('case series') || title.includes('case report')) {
      return this.evidenceLevels.CASE_SERIES;
    }
    
    return this.evidenceLevels.EXPERT_OPINION;
  }

  assessClinicalRelevance(article, query) {
    const title = article.title?.toLowerCase() || '';
    const queryTerms = query.toLowerCase().split(' ');
    
    let score = 0;
    queryTerms.forEach(term => {
      if (title.includes(term)) score += 0.1;
    });
    
    return { score: Math.min(score, 1.0) };
  }

  summarizeEvidence(articles) {
    const summary = {
      systematicReviews: 0,
      rcts: 0,
      observationalStudies: 0,
      otherStudies: 0
    };

    articles.forEach(article => {
      switch (article.evidenceLevel.level) {
        case 1:
          summary.systematicReviews++;
          break;
        case 2:
          summary.rcts++;
          break;
        case 3:
        case 4:
          summary.observationalStudies++;
          break;
        default:
          summary.otherStudies++;
      }
    });

    return summary;
  }

  /**
   * Search NIH projects and funding information
   */
  async searchNIHProjects(searchCriteria, practiceContext = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      const {
        keywords,
        fiscalYear,
        agency = 'NIH',
        awardType,
        institutionName,
        limit = 20
      } = searchCriteria;
      
      const searchParams = {
        criteria: {
          advanced_text_search: keywords ? {
            operator: 'or',
            search_field: 'all',
            search_text: keywords
          } : undefined,
          fiscal_years: fiscalYear ? [fiscalYear] : undefined,
          agencies: [agency],
          award_types: awardType ? [awardType] : undefined,
          institutions: institutionName ? [{
            name: institutionName
          }] : undefined
        },
        offset: 0,
        limit: limit,
        sort_field: 'project_start_date',
        sort_order: 'desc'
      };
      
      const externalApiGateway = this.getExternalApiGateway();
      const result = await externalApiGateway.makeRequest(
        'nihReporter',
        '/projects/search',
        searchParams,
        { 
          userId: practiceContext.userId,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      const projects = (result.results || []).map(project => this.formatNIHProject(project));
      
      const response = {
        searchCriteria: searchCriteria,
        totalProjects: result.meta?.total || projects.length,
        projects: projects,
        fundingSummary: this.calculateFundingSummary(projects),
        searchTime: new Date().toISOString()
      };
      
      await this.logNIHSearch(searchCriteria, response.totalProjects, practiceContext.userId);
      
      return response;
      
    } catch (error) {
      console.error('NIH project search error:', error);
      throw new Error(`Failed to search NIH projects: ${error.message}`);
    }
  }

  formatNIHProject(project) {
    return {
      projectNumber: project.project_num,
      title: project.project_title,
      abstract: project.project_detail?.abstract_text,
      principalInvestigator: project.principal_investigators?.[0] ? {
        name: `${project.principal_investigators[0].first_name} ${project.principal_investigators[0].last_name}`,
        title: project.principal_investigators[0].title
      } : null,
      institution: project.organization?.org_name,
      agency: project.agency_code,
      awardType: project.subproject_id ? 'Subproject' : 'Main Project',
      fiscalYear: project.fiscal_year,
      totalCost: project.award_amount,
      startDate: project.project_start_date,
      endDate: project.project_end_date,
      studySection: project.study_section,
      programOfficer: project.program_officer_name,
      keywords: project.project_terms || []
    };
  }

  calculateFundingSummary(projects) {
    const summary = {
      totalProjects: projects.length,
      totalFunding: projects.reduce((sum, p) => sum + (p.totalCost || 0), 0),
      averageFunding: 0,
      fundingByYear: {}
    };

    if (projects.length > 0) {
      summary.averageFunding = summary.totalFunding / projects.length;
    }

    projects.forEach(project => {
      const year = project.fiscalYear;
      if (year) {
        summary.fundingByYear[year] = (summary.fundingByYear[year] || 0) + (project.totalCost || 0);
      }
    });

    return summary;
  }

  /**
   * Format clinical trial data
   */
  formatClinicalTrial(study) {
    const identification = study.protocolSection?.identificationModule || {};
    const description = study.protocolSection?.descriptionModule || {};
    const design = study.protocolSection?.designModule || {};
    const eligibility = study.protocolSection?.eligibilityModule || {};
    const contacts = study.protocolSection?.contactsLocationsModule || {};
    
    return {
      nctId: identification.nctId,
      title: identification.officialTitle || identification.briefTitle,
      briefSummary: description.briefSummary,
      detailedDescription: description.detailedDescription,
      phase: design.phases?.[0] || 'N/A',
      studyType: design.studyType,
      primaryPurpose: design.designInfo?.primaryPurpose,
      interventions: design.interventions?.map(int => ({
        type: int.type,
        name: int.name,
        description: int.description
      })) || [],
      conditions: identification.conditions || [],
      eligibility: {
        criteria: eligibility.eligibilityCriteria,
        minAge: eligibility.minimumAge,
        maxAge: eligibility.maximumAge,
        gender: eligibility.sex,
        healthyVolunteers: eligibility.healthyVolunteers
      },
      status: study.protocolSection?.statusModule?.overallStatus,
      startDate: study.protocolSection?.statusModule?.startDateStruct?.date,
      completionDate: study.protocolSection?.statusModule?.completionDateStruct?.date,
      enrollmentCount: study.protocolSection?.statusModule?.enrollmentInfo?.count,
      locations: contacts.locations?.map(loc => ({
        facility: loc.facility,
        city: loc.city,
        state: loc.state,
        country: loc.country,
        zipCode: loc.zip,
        status: loc.status
      })) || [],
      sponsor: identification.organization?.fullName,
      lastUpdated: study.protocolSection?.statusModule?.lastUpdateSubmitDate
    };
  }

  // Utility methods
  matchesAgeRange(patientAge, minAge, maxAge) {
    if (!patientAge) return true; // Neutral if no age data
    
    const minAgeNum = this.parseAge(minAge);
    const maxAgeNum = this.parseAge(maxAge);
    
    if (minAgeNum && patientAge < minAgeNum) return false;
    if (maxAgeNum && patientAge > maxAgeNum) return false;
    
    return true;
  }

  parseAge(ageString) {
    if (!ageString) return null;
    const match = ageString.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  isWithinReasonableDistance(patientLocation, trialLocation) {
    // Simplified distance check - would implement proper geolocation
    if (!patientLocation || !trialLocation) return false;
    
    const patientState = patientLocation.state?.toLowerCase();
    const trialState = trialLocation.state?.toLowerCase();
    
    return patientState === trialState;
  }

  /**
   * Process active literature alerts
   */
  async processLiteratureAlerts() {
    for (const [alertId, alert] of this.literatureAlerts.entries()) {
      if (alert.active && new Date() >= alert.nextSearch) {
        try {
          await this.runLiteratureAlert(alert);
        } catch (error) {
          console.error(`Literature alert ${alertId} failed:`, error);
        }
      }
    }
  }

  async runLiteratureAlert(alert) {
    // Implementation would check for new literature matching alert criteria
    alert.lastSearch = new Date();
    alert.nextSearch = this.calculateNextSearchDate(alert.frequency);
  }

  calculateNextSearchDate(frequency) {
    const now = new Date();
    switch (frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Default to weekly
    }
  }

  // Audit logging methods
  async logTrialSearch(criteria, resultCount, userId) {
    await this.auditLog('CLINICAL_TRIAL_SEARCH', { criteria, resultCount }, userId);
  }

  async logPatientTrialMatching(patientId, result, userId) {
    await this.auditLog('PATIENT_TRIAL_MATCHING', { 
      patientId, 
      eligibleTrials: result.eligibleTrials 
    }, userId);
  }

  async logLiteratureSearch(query, resultCount, userId) {
    await this.auditLog('LITERATURE_SEARCH', { query, resultCount }, userId);
  }

  async logNIHSearch(criteria, resultCount, userId) {
    await this.auditLog('NIH_PROJECT_SEARCH', { criteria, resultCount }, userId);
  }

  async auditLog(action, details, userId) {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'audit-log',
        practiceId: 'global'
      };
      
      const secureDataAccess = this.getSecureDataAccess();
      await secureDataAccess.create('audit_logs', {
        action: action,
        resourceType: 'clinical_research',
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
      researchCacheSize: this.researchCache.size,
      trialMatchingCacheSize: this.trialMatchingCache.size,
      activeLiteratureAlerts: this.literatureAlerts.size,
      genomicsResourcesAvailable: Object.keys(this.genomicsResources).length
    };
  }
}

// Create and export singleton
const clinicalResearchService = new ClinicalResearchService();

// Register with ServiceProxy for lazy loading
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('clinicalResearchService', () => {
    return module.exports;
  });
}

module.exports = clinicalResearchService;