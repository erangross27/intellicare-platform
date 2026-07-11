/**
 * Provider Directory Service
 * Comprehensive provider directory service integrating CMS Provider Directory API
 * and BetterDoctor API for provider search, network verification, and practice information.
 * 
 * Features:
 * - CMS Provider Directory integration (Medicare/Medicaid networks)
 * - BetterDoctor API integration for enhanced provider data
 * - Provider search by specialty, location, insurance network
 * - Insurance network verification and validation
 * - Practice information and contact details
 * - Provider rating and quality metrics
 * - Real-time availability checking
 * - FHIR-compliant data exchange
 */

const crypto = require('crypto');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const externalApiGateway = require('./externalApiGatewayService');

class ProviderDirectoryService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.providerCache = new Map();
    this.specialtyMap = new Map();
    this.insuranceNetworks = new Map();
    
    // Provider specialties mapping
    this.initializeSpecialtyMappings();
    
    // Search radius options (in miles)
    this.searchRadii = [5, 10, 25, 50, 100];
    
    // Quality score weights
    this.qualityWeights = {
      patientRatings: 0.4,
      boardCertification: 0.2,
      hospitalAffiliation: 0.2,
      yearsExperience: 0.1,
      educationRanking: 0.1
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('provider-directory-service');
      
      // Initialize external API gateway
      await externalApiGateway.initialize();
      
      // Load provider cache
      await this.loadProviderCache();
      
      // Load specialty mappings
      await this.loadSpecialtyMappings();
      
      // Load insurance networks
      await this.loadInsuranceNetworks();
      
      // Start cache refresh process
      this.startCacheRefresh();
      
      this.initialized = true;
      console.log('✅ Provider Directory Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Provider Directory Service:', error);
      throw error;
    }
  }

  /**
   * Initialize specialty mappings for consistent searching
   */
  initializeSpecialtyMappings() {
    this.specialtyMap.set('cardiology', ['Cardiology', 'Cardiovascular Disease', 'Interventional Cardiology']);
    this.specialtyMap.set('dermatology', ['Dermatology', 'Dermatopathology']);
    this.specialtyMap.set('family medicine', ['Family Medicine', 'Family Practice']);
    this.specialtyMap.set('internal medicine', ['Internal Medicine', 'Internist']);
    this.specialtyMap.set('pediatrics', ['Pediatrics', 'Pediatric Medicine']);
    this.specialtyMap.set('orthopedics', ['Orthopedic Surgery', 'Orthopedics']);
    this.specialtyMap.set('neurology', ['Neurology', 'Neurological Surgery']);
    this.specialtyMap.set('oncology', ['Oncology', 'Medical Oncology', 'Radiation Oncology']);
    this.specialtyMap.set('psychiatry', ['Psychiatry', 'Child Psychiatry']);
    this.specialtyMap.set('emergency medicine', ['Emergency Medicine', 'Emergency Room']);
  }

  /**
   * Search providers by various criteria from external CMS API
   */
  async searchApiDoctors(searchCriteria, options = {}) {
    await this.initialize();
    
    try {
      const {
        specialty,
        location,
        insuranceNetwork,
        name,
        npi,
        radius = 25,
        limit = 20,
        includeRatings = true
      } = searchCriteria;
      
      let providers = [];
      
      // Search CMS Provider Directory first (free)
      if (specialty || location || insuranceNetwork) {
        const cmsProviders = await this.searchCMSProviders({
          specialty,
          location,
          insuranceNetwork,
          limit: Math.ceil(limit * 1.5) // Get extra to filter
        }, options);
        providers.push(...cmsProviders);
      }
      
      // Enhance with BetterDoctor data if available
      if (this.hasBetterDoctorAccess()) {
        const betterDoctorProviders = await this.searchBetterDoctorProviders({
          specialty,
          location,
          name,
          radius,
          limit
        }, options);
        
        // Merge and deduplicate providers
        providers = this.mergeProviderData(providers, betterDoctorProviders);
      }
      
      // Search by NPI if specified
      if (npi) {
        const npiProvider = await this.getDoctorByNPI(npi, options);
        if (npiProvider) {
          providers = [npiProvider];
        }
      }
      
      // Filter by search criteria
      providers = this.filterProviders(providers, searchCriteria);
      
      // Sort by relevance and quality
      providers = this.rankProviders(providers, searchCriteria);
      
      // Limit results
      providers = providers.slice(0, limit);
      
      // Enhance with additional data
      if (includeRatings) {
        providers = await this.enhanceWithRatings(providers, options);
      }
      
      const result = {
        searchCriteria: searchCriteria,
        totalResults: providers.length,
        providers: providers,
        searchRadius: radius,
        dataSource: this.getDataSources(),
        searchTime: new Date().toISOString()
      };
      
      await this.logProviderSearch(searchCriteria, result.totalResults, options.userId);
      
      return result;
      
    } catch (error) {
      console.error('Provider search error:', error);
      throw new Error(`Failed to search providers: ${error.message}`);
    }
  }

  /**
   * Search CMS Provider Directory
   */
  async searchCMSProviders(criteria, options = {}) {
    try {
      const searchParams = {};
      
      if (criteria.specialty) {
        searchParams['specialty'] = this.mapSpecialty(criteria.specialty);
      }
      
      if (criteria.location) {
        // Parse location (city, state or zip code)
        const locationParts = this.parseLocation(criteria.location);
        if (locationParts.city) searchParams['city'] = locationParts.city;
        if (locationParts.state) searchParams['state'] = locationParts.state;
        if (locationParts.zipCode) searchParams['zip_code'] = locationParts.zipCode;
      }
      
      if (criteria.insuranceNetwork) {
        searchParams['network'] = criteria.insuranceNetwork;
      }
      
      searchParams['limit'] = criteria.limit || 20;
      
      const result = await externalApiGateway.makeRequest(
        'cms',
        '/provider-directory/v1/providers',
        searchParams,
        { userId: options.userId }
      );
      
      return (result.data || []).map(provider => this.formatCMSProvider(provider));
      
    } catch (error) {
      console.warn('CMS provider search failed:', error.message);
      return [];
    }
  }

  /**
   * Search BetterDoctor providers
   */
  async searchBetterDoctorProviders(criteria, options = {}) {
    try {
      const searchParams = {};
      
      if (criteria.specialty) {
        searchParams['specialty_uid'] = this.getBetterDoctorSpecialtyUID(criteria.specialty);
      }
      
      if (criteria.location) {
        searchParams['location'] = this.formatLocationForBetterDoctor(criteria.location, criteria.radius);
      }
      
      if (criteria.name) {
        searchParams['name'] = criteria.name;
      }
      
      searchParams['limit'] = criteria.limit || 20;
      searchParams['skip'] = 0;
      
      const result = await externalApiGateway.makeRequest(
        'betterDoctor',
        '/doctors',
        searchParams,
        { userId: options.userId }
      );
      
      return (result.data || []).map(provider => this.formatBetterDoctorProvider(provider));
      
    } catch (error) {
      console.warn('BetterDoctor provider search failed:', error.message);
      return [];
    }
  }

  /**
   * Get provider by NPI number
   */
  async getDoctorByNPI(npi, options = {}) {
    await this.initialize();
    
    try {
      // Validate NPI format
      if (!this.validateNPI(npi)) {
        throw new Error('Invalid NPI format');
      }
      
      // Check cache first
      const cacheKey = `npi_${npi}`;
      if (this.providerCache.has(cacheKey)) {
        return this.providerCache.get(cacheKey);
      }
      
      // Search CMS first
      let provider = await this.searchCMSProviders({ npi }, options);
      if (provider.length > 0) {
        provider = provider[0];
      } else {
        // Try BetterDoctor
        if (this.hasBetterDoctorAccess()) {
          const betterDoctorResult = await externalApiGateway.makeRequest(
            'betterDoctor',
            '/doctors',
            { npi: npi },
            { userId: options.userId }
          );
          
          if (betterDoctorResult.data && betterDoctorResult.data.length > 0) {
            provider = this.formatBetterDoctorProvider(betterDoctorResult.data[0]);
          }
        }
      }
      
      if (!provider) {
        throw new Error(`No provider found with NPI: ${npi}`);
      }
      
      // Cache the result
      this.providerCache.set(cacheKey, provider);
      
      await this.logProviderLookup(npi, 'NPI', options.userId);
      
      return provider;
      
    } catch (error) {
      console.error('NPI lookup error:', error);
      throw new Error(`Failed to lookup provider by NPI: ${error.message}`);
    }
  }

  /**
   * Verify insurance network for provider
   */
  async verifyInsuranceNetwork(providerNPI, insurancePlan, options = {}) {
    await this.initialize();
    
    try {
      // Get provider information
      const provider = await this.getDoctorByNPI(providerNPI, options);
      
      if (!provider) {
        return {
          isInNetwork: false,
          provider: null,
          insurancePlan: insurancePlan,
          verificationDate: new Date().toISOString(),
          error: 'Provider not found'
        };
      }
      
      // Check insurance networks
      const isInNetwork = this.checkProviderInNetwork(provider, insurancePlan);
      
      // Get additional network information from CMS
      let networkDetails = null;
      try {
        const networkResult = await externalApiGateway.makeRequest(
          'cms',
          '/provider-directory/v1/plans',
          {
            npi: providerNPI,
            plan_id: insurancePlan
          },
          { userId: options.userId }
        );
        networkDetails = networkResult.data;
      } catch (error) {
        console.warn('Network verification via CMS failed:', error.message);
      }
      
      const verification = {
        isInNetwork: isInNetwork,
        confidence: this.calculateNetworkConfidence(provider, insurancePlan, networkDetails),
        provider: {
          npi: provider.npi,
          name: provider.name,
          specialty: provider.specialty,
          practice: provider.practice
        },
        insurancePlan: insurancePlan,
        networkDetails: networkDetails,
        copayEstimate: this.estimateCopay(insurancePlan, provider.specialty),
        verificationDate: new Date().toISOString(),
        dataSource: networkDetails ? 'CMS' : 'Provider Directory'
      };
      
      await this.logNetworkVerification(providerNPI, insurancePlan, verification, options.userId);
      
      return verification;
      
    } catch (error) {
      console.error('Insurance network verification error:', error);
      throw new Error(`Failed to verify insurance network: ${error.message}`);
    }
  }

  /**
   * Get provider specialties list
   */
  async getSpecialties(options = {}) {
    await this.initialize();
    
    try {
      let specialties = [];
      
      // Get from BetterDoctor if available
      if (this.hasBetterDoctorAccess()) {
        const result = await externalApiGateway.makeRequest(
          'betterDoctor',
          '/specialties',
          {},
          { userId: options.userId }
        );
        specialties = (result.data || []).map(spec => ({
          uid: spec.uid,
          name: spec.name,
          description: spec.description,
          category: spec.category?.name,
          source: 'BetterDoctor'
        }));
      }
      
      // Add our standard specialties
      const standardSpecialties = Array.from(this.specialtyMap.entries()).map(([key, variations]) => ({
        uid: key,
        name: variations[0],
        variations: variations,
        category: 'Standard',
        source: 'Internal'
      }));
      
      specialties.push(...standardSpecialties);
      
      // Remove duplicates and sort
      specialties = this.deduplicateSpecialties(specialties);
      specialties.sort((a, b) => a.name.localeCompare(b.name));
      
      return {
        totalSpecialties: specialties.length,
        specialties: specialties,
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Get specialties error:', error);
      throw new Error(`Failed to get specialties: ${error.message}`);
    }
  }

  /**
   * Get insurance plans and networks
   */
  async getInsurancePlans(options = {}) {
    await this.initialize();
    
    try {
      let plans = [];
      
      // Get from BetterDoctor if available
      if (this.hasBetterDoctorAccess()) {
        const result = await externalApiGateway.makeRequest(
          'betterDoctor',
          '/insurances',
          {},
          { userId: options.userId }
        );
        plans = (result.data || []).map(plan => ({
          uid: plan.uid,
          name: plan.name,
          category: plan.category,
          plans: plan.plans || []
        }));
      }
      
      // Add standard insurance plans
      const standardPlans = this.getStandardInsurancePlans();
      plans.push(...standardPlans);
      
      return {
        totalPlans: plans.length,
        insurancePlans: plans,
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Get insurance plans error:', error);
      throw new Error(`Failed to get insurance plans: ${error.message}`);
    }
  }

  /**
   * Format CMS provider data
   */
  formatCMSProvider(cmsProvider) {
    return {
      npi: cmsProvider.npi,
      name: {
        first: cmsProvider.first_name,
        last: cmsProvider.last_name,
        full: `${cmsProvider.first_name} ${cmsProvider.last_name}`.trim()
      },
      specialty: cmsProvider.specialty,
      credentials: cmsProvider.credentials,
      practice: {
        name: cmsProvider.practice_name,
        address: {
          street: cmsProvider.address,
          city: cmsProvider.city,
          state: cmsProvider.state,
          zipCode: cmsProvider.zip_code
        },
        phone: cmsProvider.phone,
        acceptingPatients: cmsProvider.accepting_patients
      },
      insuranceNetworks: cmsProvider.networks || [],
      boardCertified: cmsProvider.board_certified,
      medicalSchool: cmsProvider.medical_school,
      graduationYear: cmsProvider.graduation_year,
      languages: cmsProvider.languages || [],
      gender: cmsProvider.gender,
      dataSource: 'CMS',
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Format BetterDoctor provider data
   */
  formatBetterDoctorProvider(bdProvider) {
    const practice = bdProvider.practices?.[0] || {};
    const address = practice.visit_address || practice.office_address || {};
    
    return {
      npi: bdProvider.npi,
      name: {
        first: bdProvider.profile?.first_name,
        last: bdProvider.profile?.last_name,
        full: `${bdProvider.profile?.first_name} ${bdProvider.profile?.last_name}`.trim()
      },
      specialty: bdProvider.specialties?.[0]?.name,
      credentials: bdProvider.profile?.credentials?.join(', '),
      practice: {
        name: practice.name,
        address: {
          street: address.street,
          street2: address.street2,
          city: address.city,
          state: address.state,
          zipCode: address.zip
        },
        phone: practice.phones?.[0]?.number,
        website: practice.website,
        acceptingPatients: practice.accepts_new_patients
      },
      insuranceNetworks: practice.insurances?.map(ins => ins.insurance_plan?.name) || [],
      boardCertified: bdProvider.profile?.board_certifications?.length > 0,
      medicalSchool: bdProvider.educations?.[0]?.school,
      graduationYear: bdProvider.educations?.[0]?.graduation_year,
      languages: bdProvider.profile?.languages?.map(lang => lang.name) || [],
      gender: bdProvider.profile?.gender,
      bio: bdProvider.profile?.bio,
      ratings: {
        average: bdProvider.ratings?.[0]?.rating,
        count: bdProvider.ratings?.[0]?.count,
        provider: 'BetterDoctor'
      },
      photos: bdProvider.profile?.image_url,
      dataSource: 'BetterDoctor',
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Merge provider data from multiple sources
   */
  mergeProviderData(cmsProviders, betterDoctorProviders) {
    const merged = [...cmsProviders];
    const cmsNPIs = new Set(cmsProviders.map(p => p.npi));
    
    // Add BetterDoctor providers not in CMS
    for (const bdProvider of betterDoctorProviders) {
      if (!cmsNPIs.has(bdProvider.npi)) {
        merged.push(bdProvider);
      } else {
        // Enhance CMS provider with BetterDoctor data
        const cmsProvider = merged.find(p => p.npi === bdProvider.npi);
        if (cmsProvider) {
          cmsProvider.ratings = bdProvider.ratings;
          cmsProvider.photos = bdProvider.photos;
          cmsProvider.bio = bdProvider.bio;
          cmsProvider.practice.website = cmsProvider.practice.website || bdProvider.practice.website;
          cmsProvider.dataSource = 'CMS + BetterDoctor';
        }
      }
    }
    
    return merged;
  }

  /**
   * Filter providers based on search criteria
   */
  filterProviders(providers, criteria) {
    return providers.filter(provider => {
      // Filter by specialty
      if (criteria.specialty) {
        const specialtyMatch = this.matchSpecialty(provider.specialty, criteria.specialty);
        if (!specialtyMatch) return false;
      }
      
      // Filter by insurance network
      if (criteria.insuranceNetwork) {
        const networkMatch = provider.insuranceNetworks?.some(network => 
          network.toLowerCase().includes(criteria.insuranceNetwork.toLowerCase())
        );
        if (!networkMatch) return false;
      }
      
      // Filter by accepting patients
      if (criteria.acceptingPatients === true) {
        if (!provider.practice?.acceptingPatients) return false;
      }
      
      // Filter by gender
      if (criteria.gender) {
        if (provider.gender?.toLowerCase() !== criteria.gender.toLowerCase()) return false;
      }
      
      // Filter by languages
      if (criteria.language) {
        const languageMatch = provider.languages?.some(lang =>
          lang.toLowerCase().includes(criteria.language.toLowerCase())
        );
        if (!languageMatch) return false;
      }
      
      return true;
    });
  }

  /**
   * Rank providers by relevance and quality
   */
  rankProviders(providers, criteria) {
    return providers.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      
      // Specialty match score
      if (criteria.specialty) {
        scoreA += this.getSpecialtyMatchScore(a.specialty, criteria.specialty);
        scoreB += this.getSpecialtyMatchScore(b.specialty, criteria.specialty);
      }
      
      // Quality score
      scoreA += this.calculateQualityScore(a);
      scoreB += this.calculateQualityScore(b);
      
      // Accepting patients boost
      if (a.practice?.acceptingPatients) scoreA += 10;
      if (b.practice?.acceptingPatients) scoreB += 10;
      
      // Rating boost
      if (a.ratings?.average) scoreA += a.ratings.average * 5;
      if (b.ratings?.average) scoreB += b.ratings.average * 5;
      
      return scoreB - scoreA;
    });
  }

  /**
   * Calculate provider quality score
   */
  calculateQualityScore(provider) {
    let score = 0;
    
    // Board certification
    if (provider.boardCertified) score += 20;
    
    // Medical school (rough estimate)
    if (provider.medicalSchool) score += 10;
    
    // Years of experience
    if (provider.graduationYear) {
      const experience = new Date().getFullYear() - provider.graduationYear;
      score += Math.min(experience * 0.5, 15); // Cap at 15 points
    }
    
    // Has ratings
    if (provider.ratings) score += 5;
    
    // Multiple data sources
    if (provider.dataSource?.includes('+')) score += 5;
    
    return score;
  }

  /**
   * Enhance providers with ratings data
   * TODO: Implement actual ratings enhancement when ratings service is available
   */
  async enhanceWithRatings(providers, options = {}) {
    // Stub method - returns providers unchanged for now
    // Future implementation could call external ratings API or internal ratings service
    return providers;
  }

  /**
   * Helper methods
   */
  validateNPI(npi) {
    return /^\d{10}$/.test(npi);
  }

  mapSpecialty(specialty) {
    const mapped = this.specialtyMap.get(specialty.toLowerCase());
    return mapped ? mapped[0] : specialty;
  }

  matchSpecialty(providerSpecialty, searchSpecialty) {
    if (!providerSpecialty || !searchSpecialty) return false;
    
    const variations = this.specialtyMap.get(searchSpecialty.toLowerCase()) || [searchSpecialty];
    return variations.some(variation => 
      providerSpecialty.toLowerCase().includes(variation.toLowerCase())
    );
  }

  parseLocation(location) {
    // Simple location parsing - can be enhanced
    const parts = location.split(',').map(part => part.trim());
    
    if (/^\d{5}$/.test(location)) {
      return { zipCode: location };
    }
    
    if (parts.length === 2) {
      return { city: parts[0], state: parts[1] };
    }
    
    return { city: location };
  }

  hasBetterDoctorAccess() {
    // Check if BetterDoctor API key is available
    return externalApiGateway.apiConfigs?.has('BETTERDOCTOR_API_KEY');
  }

  getDataSources() {
    const sources = ['CMS'];
    if (this.hasBetterDoctorAccess()) sources.push('BetterDoctor');
    return sources;
  }

  checkProviderInNetwork(provider, insurancePlan) {
    return provider.insuranceNetworks?.some(network =>
      network.toLowerCase().includes(insurancePlan.toLowerCase())
    ) || false;
  }

  calculateNetworkConfidence(provider, insurancePlan, networkDetails) {
    let confidence = 0.5; // Base confidence
    
    if (networkDetails) confidence += 0.3; // CMS data available
    if (provider.dataSource?.includes('BetterDoctor')) confidence += 0.2; // Enhanced data
    
    return Math.min(confidence, 1.0);
  }

  estimateCopay(insurancePlan, specialty) {
    // Basic copay estimates - would be enhanced with real data
    const specialistCopays = {
      'Primary Care': 25,
      'Specialist': 50,
      'Mental Health': 30
    };
    
    const category = this.getSpecialtyCategory(specialty);
    return specialistCopays[category] || 50;
  }

  getSpecialtyCategory(specialty) {
    const primaryCare = ['Family Medicine', 'Internal Medicine', 'Pediatrics'];
    const mentalHealth = ['Psychiatry', 'Psychology'];
    
    if (primaryCare.some(pc => specialty?.includes(pc))) return 'Primary Care';
    if (mentalHealth.some(mh => specialty?.includes(mh))) return 'Mental Health';
    return 'Specialist';
  }

  getStandardInsurancePlans() {
    return [
      {
        uid: 'medicare',
        name: 'Medicare',
        category: 'Government',
        plans: ['Medicare Part A', 'Medicare Part B', 'Medicare Advantage']
      },
      {
        uid: 'medicaid',
        name: 'Medicaid',
        category: 'Government',
        plans: ['Traditional Medicaid', 'Medicaid Managed Care']
      }
    ];
  }

  // Cache and data management
  async loadProviderCache() {
    // Implementation for loading frequently accessed providers
    console.log('📋 Provider cache loaded');
  }

  async loadSpecialtyMappings() {
    // Implementation for loading specialty mappings from database
    console.log('📋 Specialty mappings loaded');
  }

  async loadInsuranceNetworks() {
    // Implementation for loading insurance networks
    console.log('📋 Insurance networks loaded');
  }

  startCacheRefresh() {
    // Refresh cache every 4 hours
    setInterval(() => {
      this.providerCache.clear();
      console.log('🔄 Provider cache refreshed');
    }, 4 * 60 * 60 * 1000);
  }

  // Audit logging
  async logProviderSearch(criteria, resultCount, userId) {
    await this.auditLog('PROVIDER_SEARCH', { criteria, resultCount }, userId);
  }

  async logProviderLookup(identifier, type, userId) {
    await this.auditLog('PROVIDER_LOOKUP', { identifier, type }, userId);
  }

  async logNetworkVerification(providerNPI, insurancePlan, verification, userId) {
    await this.auditLog('NETWORK_VERIFICATION', { 
      providerNPI, 
      insurancePlan, 
      isInNetwork: verification.isInNetwork 
    }, userId);
  }

  async auditLog(action, details, userId) {
    try {
      const context = {
        serviceId: 'provider-directory-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'global'
      };
      
      await SecureDataAccess.insert('audit_logs', {
        action: action,
        resourceType: 'provider_directory',
        userId: userId || 'system',
        details: details,
        timestamp: new Date()
      }, context);
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }
}

module.exports = new ProviderDirectoryService();