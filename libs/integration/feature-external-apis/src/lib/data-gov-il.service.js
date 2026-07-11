/**
 * Israeli Government Open Data Service - Modular Version
 * Uses data.gov.il CKAN API for street and city data
 */

const axios = require('axios');
const serviceAccountManager = require('../../../../../backend/services/serviceAccountManager');

class DataGovIlService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.baseUrl = 'https://data.gov.il/api/3/action';
    
    // Resource IDs for different datasets
    this.resources = {
      streets: '9ad3862c-8391-4b2f-84a4-2d4c68625f4b', // רחובות בישראל
      // We need to find the postal codes resource ID
    };
    
    this.cache = {
      cities: new Map(),
      streets: new Map()
    };
  }

  /**
   * Initialize the service with authentication
   */
  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Authenticate with service account manager
      this.serviceToken = await serviceAccountManager.authenticate('datagov-il-service');
      
      this.initialized = true;
      console.log('✅ DataGovIlService initialized');
    } catch (error) {
      console.error('Failed to initialize DataGovIlService:', error.message);
      throw error;
    }

    return this;
  }

  /**
   * Search for cities
   */
  async searchCities(query) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      if (!query) return [];
      
      const cacheKey = `city:${query}`;
      if (this.cache.cities.has(cacheKey)) {
        return this.cache.cities.get(cacheKey);
      }

      console.log(`Searching cities with query: ${query}`);
      
      const response = await axios.get(`${this.baseUrl}/datastore_search`, {
        params: {
          resource_id: this.resources.streets,
          q: query,
          distinct: true,
          fields: 'שם_ישוב,סמל_ישוב',
          limit: 100
        }
      });

      if (response.data.success) {
        // Get unique cities
        const citiesMap = new Map();
        response.data.result.records.forEach(record => {
          const cityName = record['שם_ישוב']?.trim();
          const cityCode = record['סמל_ישוב'];
          if (cityName && !citiesMap.has(cityName)) {
            citiesMap.set(cityName, {
              name: cityName,
              code: cityCode
            });
          }
        });
        
        const cities = Array.from(citiesMap.values());
        
        // Filter by query
        const filtered = cities.filter(city => 
          city.name.includes(query)
        ).slice(0, 10);
        
        this.cache.cities.set(cacheKey, filtered);
        console.log(`Found ${filtered.length} cities`);
        return filtered;
      }
      
      return [];
    } catch (error) {
      console.error('Error searching cities:', error.message);
      return [];
    }
  }

  /**
   * Get streets for a specific city
   */
  async getStreets(cityName, query = '') {
    try {
      const cacheKey = `streets:${cityName}:${query}`;
      if (this.cache.streets.has(cacheKey)) {
        return this.cache.streets.get(cacheKey);
      }

      console.log(`Getting streets for ${cityName} with query: ${query}`);
      
      // Build the filter
      const filters = {
        'שם_ישוב': cityName
      };
      
      const response = await axios.get(`${this.baseUrl}/datastore_search`, {
        params: {
          resource_id: this.resources.streets,
          filters: JSON.stringify(filters),
          q: query,
          limit: 100
        }
      });

      if (response.data.success) {
        const streets = response.data.result.records.map(record => ({
          name: record['שם_רחוב']?.trim(),
          code: record['סמל_רחוב'],
          cityName: record['שם_ישוב']?.trim(),
          cityCode: record['סמל_ישוב']
        })).filter(street => 
          street.name && 
          street.name !== street.cityName && // Exclude city name as street
          street.code !== 9000 // Exclude generic codes
        );
        
        // Remove duplicates
        const uniqueStreets = Array.from(
          new Map(streets.map(s => [s.name, s])).values()
        );
        
        const result = uniqueStreets.slice(0, 20);
        this.cache.streets.set(cacheKey, result);
        console.log(`Found ${result.length} streets for ${cityName}`);
        return result;
      }
      
      return [];
    } catch (error) {
      console.error(`Error getting streets for ${cityName}:`, error.message);
      return [];
    }
  }

  /**
   * Search all cities (without query)
   */
  async getAllCities() {
    try {
      const response = await axios.get(`${this.baseUrl}/datastore_search_sql`, {
        params: {
          sql: `SELECT DISTINCT "שם_ישוב", "סמל_ישוב" 
                FROM "${this.resources.streets}" 
                WHERE "שם_ישוב" IS NOT NULL 
                ORDER BY "שם_ישוב" 
                LIMIT 1000`
        }
      });

      if (response.data.success) {
        return response.data.result.records.map(record => ({
          name: record['שם_ישוב']?.trim(),
          code: record['סמל_ישוב']
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Error getting all cities:', error.message);
      return [];
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.cities.clear();
    this.cache.streets.clear();
    console.log('✅ Data.gov.il cache cleared');
  }
}

module.exports = DataGovIlService;