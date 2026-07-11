/**
 * Data.gov.il JSONP Service - Modular Version
 * Uses JSONP to bypass CORS/blocking issues
 * Resource: Israeli streets and cities (רחובות בישראל)
 */

const axios = require('axios');
const serviceAccountManager = require('../../../../../backend/services/serviceAccountManager');

class DataGovIlJsonpService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.baseUrl = 'https://data.gov.il/api/3/action/datastore_search';
    this.resourceId = '9ad3862c-8391-4b2f-84a4-2d4c68625f4b';
    
    // Simple in-memory cache with TTL
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize the service with authentication
   */
  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Authenticate with service account manager
      this.serviceToken = await serviceAccountManager.authenticate('datagov-jsonp-service');
      
      this.initialized = true;
      console.log('✅ DataGovIlJsonpService initialized');
    } catch (error) {
      console.error('Failed to initialize DataGovIlJsonpService:', error.message);
      throw error;
    }

    return this;
  }

  /**
   * Make JSONP request to data.gov.il
   */
  async makeRequest(params) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Add callback parameter for JSONP
      const callbackName = `jQuery${Date.now()}${Math.floor(Math.random() * 10000)}`;
      
      const response = await axios.get(this.baseUrl, {
        params: {
          resource_id: this.resourceId,
          callback: callbackName,
          ...params
        },
        headers: {
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      // Parse JSONP response
      if (response.data && typeof response.data === 'string') {
        const jsonStr = response.data.substring(
          response.data.indexOf('(') + 1,
          response.data.lastIndexOf(')')
        );
        return JSON.parse(jsonStr);
      }
      
      return response.data;
    } catch (error) {
      console.error('DataGovIl JSONP request failed:', error.message);
      return null;
    }
  }

  /**
   * Get from cache or fetch
   */
  async getCached(key, fetchFn) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`Cache hit for: ${key}`);
      return cached.data;
    }

    const data = await fetchFn();
    if (data) {
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
    }
    return data;
  }

  /**
   * Search for cities
   */
  async searchCities(query) {
    if (!query || query.length < 1) return [];
    
    const cacheKey = `cities:${query}`;
    
    return this.getCached(cacheKey, async () => {
      console.log(`Searching cities with query: ${query}`);
      
      const response = await this.makeRequest({
        q: query,
        limit: 100
      });

      if (!response || !response.success) {
        return [];
      }

      // Extract unique cities from results
      const citiesMap = new Map();
      
      response.result.records.forEach(record => {
        const cityName = record['שם_ישוב']?.trim();
        const cityCode = record['סמל_ישוב'];
        
        if (cityName && cityName.toLowerCase().includes(query.toLowerCase())) {
          if (!citiesMap.has(cityName)) {
            citiesMap.set(cityName, {
              name: cityName,
              code: cityCode,
              nameEn: this.translateCityName(cityName) // Add English translation if needed
            });
          }
        }
      });

      const cities = Array.from(citiesMap.values()).slice(0, 10);
      console.log(`Found ${cities.length} unique cities for query: ${query}`);
      
      return cities;
    });
  }

  /**
   * Get streets for a city
   */
  async getStreets(cityName, query = '') {
    if (!cityName) return [];
    
    const cacheKey = `streets:${cityName}:${query}`;
    
    return this.getCached(cacheKey, async () => {
      console.log(`Getting streets for ${cityName} with query: ${query}`);
      
      // Build search query
      const searchQuery = query 
        ? `${cityName} ${query}`
        : cityName;
      
      const response = await this.makeRequest({
        q: searchQuery,
        limit: 200
      });

      if (!response || !response.success) {
        return [];
      }

      // Filter and extract streets for this specific city
      const streetsMap = new Map();
      
      response.result.records.forEach(record => {
        const recordCity = record['שם_ישוב']?.trim();
        const streetName = record['שם_רחוב']?.trim();
        const streetCode = record['סמל_רחוב'];
        
        // Make sure it's the right city and not a generic entry
        if (recordCity === cityName && 
            streetName && 
            streetName !== cityName && // Exclude city name as street
            streetCode !== 9000) { // Exclude generic code
          
          // Filter by query if provided
          if (!query || streetName.includes(query)) {
            if (!streetsMap.has(streetName)) {
              streetsMap.set(streetName, {
                name: streetName,
                code: streetCode,
                nameEn: this.translateStreetName(streetName)
              });
            }
          }
        }
      });

      const streets = Array.from(streetsMap.values()).slice(0, 20);
      console.log(`Found ${streets.length} streets for ${cityName}`);
      
      return streets;
    });
  }

  /**
   * Check if we have street data for a city
   */
  async hasStreetData(cityName) {
    const streets = await this.getStreets(cityName);
    return streets.length > 0;
  }

  /**
   * Translate city name to English (basic mapping)
   */
  translateCityName(hebrewName) {
    const translations = {
      'ירושלים': 'Jerusalem',
      'תל אביב-יפו': 'Tel Aviv-Yafo',
      'חיפה': 'Haifa',
      'נס ציונה': 'Nes Ziona',
      'ראשון לציון': 'Rishon LeZion',
      'פתח תקווה': 'Petah Tikva',
      'אשדוד': 'Ashdod',
      'נתניה': 'Netanya',
      'באר שבע': 'Beer Sheva',
      'בני ברק': 'Bnei Brak',
      'רמת גן': 'Ramat Gan',
      'אשקלון': 'Ashkelon',
      'רחובות': 'Rehovot',
      'בת ים': 'Bat Yam',
      'חולון': 'Holon'
    };
    
    return translations[hebrewName] || '';
  }

  /**
   * Translate street name to English (basic patterns)
   */
  translateStreetName(hebrewName) {
    // Common street name translations
    const translations = {
      'הרצל': 'Herzl',
      'ויצמן': 'Weizmann',
      'בן גוריון': 'Ben Gurion',
      'רוטשילד': 'Rothschild',
      'דיזנגוף': 'Dizengoff',
      'אלנבי': 'Allenby',
      'יפו': 'Jaffa',
      'המלך ג׳ורג׳': 'King George',
      'בן יהודה': 'Ben Yehuda',
      'דוד לנדאו': 'David Landau'
    };
    
    return translations[hebrewName] || '';
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('✅ DataGovIl JSONP cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

module.exports = DataGovIlJsonpService;