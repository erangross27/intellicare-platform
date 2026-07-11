// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class ProviderDirectoryService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.providerCache = new Map();
    this.specialtyMap = new Map();
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate('provider-directory-service');
      
      await this.initializeSpecialtyMappings();
      this.initialized = true;
      
      // Log initialization
      const secureDataAccess = this.getSecureDataAccess();
      await secureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'providerDirectoryService',
        timestamp: new Date()
      }, {
        serviceId: 'provider-directory-service',
        operation: 'initialize',
        practiceId: 'global'
      });
      
      return this;
    } catch (error) {
      throw new Error(`Failed to initialize ProviderDirectoryService: ${error.message}`);
    }
  }

  async initializeSpecialtyMappings() {
    this.specialtyMap.set('cardiology', 'Cardiovascular Disease');
    this.specialtyMap.set('dermatology', 'Dermatology');
    this.specialtyMap.set('family-medicine', 'Family Practice');
    this.specialtyMap.set('internal-medicine', 'Internal Medicine');
  }

  // Helper methods for service access - CRITICAL for provider management operations
  getSecureDataAccess() {
    return getServiceProxy().getService('secureDataAccess');
  }

  getSecureConfigService() {
    return getServiceProxy().getService('secureConfigService');
  }

  async searchProviders(searchParams, context) {
    await this.initialize();
    
    // Simulate provider search results
    const providers = [
      {
        id: 'prov_001',
        name: 'Dr. John Smith',
        specialty: searchParams.specialty || 'Family Medicine',
        location: searchParams.location || 'General Area',
        rating: 4.5,
        acceptingNewPatients: true,
        insuranceNetworks: ['Medicare', 'Medicaid', 'Blue Cross']
      }
    ];

    return {
      success: true,
      providers,
      totalCount: providers.length,
      searchParams
    };
  }

  async getProviderDetails(providerId, context) {
    await this.initialize();
    
    return {
      success: true,
      provider: {
        id: providerId,
        name: 'Dr. Sample Provider',
        specialty: 'Family Medicine',
        boardCertified: true,
        yearsExperience: 15,
        education: 'Medical School',
        hospitalAffiliations: ['General Hospital'],
        officeLocations: [{
          address: '123 Main St',
          city: 'Anytown',
          state: 'ST',
          zip: '12345',
          phone: '555-0123'
        }]
      }
    };
  }

  async verifyInsuranceNetwork(providerId, insurancePlan, context) {
    await this.initialize();
    
    return {
      success: true,
      verified: true,
      networkStatus: 'in-network',
      effectiveDate: new Date(),
      copayAmount: 25
    };
  }
}

// Create and export singleton instance
const providerDirectoryService = new ProviderDirectoryService();

// Register service with proxy manager - CRITICAL for provider management
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('providerDirectoryService', () => providerDirectoryService);
}

module.exports = providerDirectoryService;