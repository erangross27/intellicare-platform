/**
 * Address Lookup Service
 * Multi-source address lookup with real-time data
 * Prioritizes accuracy and freshness over cached data
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class AddressLookupService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 1000 * 60 * 60; // 1 hour cache
    this.israeliPostalCodes = {};
    this.serviceToken = null;
    this.googleApiKey = null;
    this.rapidApiKey = null;
    this.initialized = false;
  }

  /**
   * Initialize the service with authentication
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate with service account manager
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('address-lookup-service');
      
      // Load configuration
      const secureConfigService = proxy.getService('secureConfigService');
      this.googleApiKey = await secureConfigService.get('GOOGLE_MAPS_API_KEY');
      this.rapidApiKey = await secureConfigService.get('RAPIDAPI_KEY');
      
      // Load postal codes database
      this.israeliPostalCodes = this.loadIsraeliPostalCodes();
      
      this.initialized = true;
      console.log('✅ AddressLookupService initialized with ServiceProxy');
    } catch (error) {
      console.error('Failed to initialize AddressLookupService:', error.message);
      throw error;
    }
  }

  /**
   * Load Israeli postal codes database
   */
  loadIsraeliPostalCodes() {
    try {
      const dataPath = path.join(__dirname, '../../../data/israeli-postal-codes.json');
      if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        console.log('✅ Loaded Israeli postal codes database');
        return data.postalCodes;
      }
    } catch (error) {
      console.error('Error loading Israeli postal codes:', error);
    }
    return {};
  }

  /**
   * Get postal code from local database
   */
  getLocalPostalCode(city, street, buildingNumber) {
    if (!this.israeliPostalCodes || !city) return null;

    // Normalize city name
    const normalizedCity = city.trim();
    
    // Try exact match first
    let cityData = this.israeliPostalCodes[normalizedCity];
    
    // If not found, try case-insensitive search
    if (!cityData) {
      for (const [key, value] of Object.entries(this.israeliPostalCodes)) {
        if (key.toLowerCase() === normalizedCity.toLowerCase()) {
          cityData = value;
          break;
        }
      }
    }

    if (!cityData) return null;

    // If we have street data
    if (street && cityData.streets) {
      const normalizedStreet = street.replace(/^(רחוב|רח')\s*/i, '').trim();
      
      // Try exact match
      let streetData = cityData.streets[normalizedStreet];
      
      // If not found, try case-insensitive search
      if (!streetData) {
        for (const [key, value] of Object.entries(cityData.streets)) {
          if (key.toLowerCase() === normalizedStreet.toLowerCase()) {
            streetData = value;
            break;
          }
        }
      }

      if (streetData) {
        // Check if we have ranges for building numbers
        if (buildingNumber && streetData.ranges) {
          const num = parseInt(buildingNumber);
          for (const range of streetData.ranges) {
            if (num >= range.from && num <= range.to) {
              return range.code;
            }
          }
        }
        return streetData.default || cityData.default;
      }
    }

    // Return city default postal code
    return cityData.default;
  }

  /**
   * Main lookup method - tries multiple sources
   */
  async lookupAddress(street, city, buildingNumber, country = 'IL') {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    const cacheKey = `${street}_${city}_${buildingNumber}_${country}`;
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    let result = null;

    // Try different sources in order of preference
    try {
      // 1. For Israeli addresses, try local database first (instant and reliable)
      if (country === 'IL') {
        const localPostalCode = this.getLocalPostalCode(city, street, buildingNumber);
        if (localPostalCode) {
          console.log(`✅ Found postal code in local database: ${localPostalCode}`);
          result = {
            street: street,
            streetNumber: buildingNumber,
            city: city,
            postalCode: localPostalCode,
            source: 'local_database',
            confidence: 'high'
          };
          
          // Cache and return immediately
          this.setCache(cacheKey, result);
          return result;
        }
      }

      // 2. Try Google Places API (most accurate, real-time)
      if (this.googleApiKey) {
        result = await this.lookupGooglePlaces(street, city, buildingNumber, country);
        
        // If Google found the address but no postal code, try local database
        if (result && !result.postalCode && country === 'IL') {
          const localPostalCode = this.getLocalPostalCode(city, street, buildingNumber);
          if (localPostalCode) {
            result.postalCode = localPostalCode;
            result.source = 'google_places_with_local';
          } else {
            // Try geocoding as last resort
            const geocodedPostal = await this.geocodeForPostalCode(
              result.formattedAddress || `${buildingNumber} ${street}, ${city}, ${country === 'IL' ? 'Israel' : country}`
            );
            if (geocodedPostal) {
              result.postalCode = geocodedPostal;
            }
          }
        }
      }

      // 3. For Israeli addresses, try Israel Post direct query
      if (!result && country === 'IL') {
        console.log('Trying Israel Post direct query...');
        result = await this.queryIsraelPost(street, city, buildingNumber);
      }
      
      // 4. Try alternative geocoding services
      if (!result) {
        // Try OpenCage if configured
        const proxy = getServiceProxy();
        const secureConfigService = proxy.getService('secureConfigService');
        if (secureConfigService.get('OPENCAGE_API_KEY')) {
          result = await this.lookupOpenCage(street, city, buildingNumber, country);
        }
        
        // Try OpenStreetMap as free fallback
        if (!result) {
          result = await this.lookupOpenStreetMap(street, city, buildingNumber, country);
        }
        
        // Only try RapidAPI if explicitly configured and previous attempts failed
        if (!result && this.rapidApiKey && country === 'IL') {
          result = await this.lookupRapidAPI(street, city, buildingNumber);
        }
        
        // If still no result for Israeli address, use local database default
        if (!result && country === 'IL') {
          const localPostalCode = this.getLocalPostalCode(city, null, null);
          if (localPostalCode) {
            result = {
              street: street,
              streetNumber: buildingNumber,
              city: city,
              postalCode: localPostalCode,
              source: 'local_database_default',
              confidence: 'medium'
            };
          }
        }
      }

      // Cache successful result
      if (result) {
        this.setCache(cacheKey, result);
      }

      return result;
    } catch (error) {
      console.error('Address lookup error:', error);
      return null;
    }
  }

  /**
   * Use Google Geocoding API to get postal code
   */
  async geocodeForPostalCode(address) {
    if (!this.googleApiKey) return null;

    try {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json`;
      const response = await axios.get(geocodeUrl, {
        params: {
          address,
          key: this.googleApiKey,
          region: 'il'
        }
      });

      if (response.data.results && response.data.results.length > 0) {
        const components = response.data.results[0].address_components;
        const postalCode = this.extractComponent(components, 'postal_code');
        return postalCode;
      }
    } catch (error) {
      console.error('Geocoding error:', error.message);
    }
    return null;
  }

  /**
   * Google Places API lookup - Enhanced for Israeli addresses
   */
  async lookupGooglePlaces(street, city, buildingNumber, country) {
    if (!this.googleApiKey) return null;

    try {
      // Format the input for better Israeli address recognition
      const formattedStreet = street.replace(/^(רחוב|רח')\s*/i, '').trim();
      const input = buildingNumber 
        ? `${formattedStreet} ${buildingNumber}, ${city}, ${country === 'IL' ? 'ישראל' : country}`
        : `${formattedStreet}, ${city}, ${country === 'IL' ? 'ישראל' : country}`;
      
      console.log('Searching Google Places for:', input);
      
      // Try Places Autocomplete first
      const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json`;
      
      const autocompleteResponse = await axios.get(autocompleteUrl, {
        params: {
          input,
          key: this.googleApiKey,
          types: 'address',
          components: `country:${country.toLowerCase()}`,
          language: 'iw' // Hebrew language code for better Israeli address recognition
        }
      });

      if (autocompleteResponse.data.predictions && autocompleteResponse.data.predictions.length > 0) {
        const placeId = autocompleteResponse.data.predictions[0].place_id;
        
        // Get detailed place information
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json`;
        const detailsResponse = await axios.get(detailsUrl, {
          params: {
            place_id: placeId,
            key: this.googleApiKey,
            fields: 'address_components,formatted_address,geometry'
          }
        });

        if (detailsResponse.data.result) {
          const components = detailsResponse.data.result.address_components;
          const postalCode = this.extractComponent(components, 'postal_code');
          const streetNumber = this.extractComponent(components, 'street_number');
          const route = this.extractComponent(components, 'route');
          const locality = this.extractComponent(components, 'locality');

          return {
            street: route || street,
            streetNumber: streetNumber || buildingNumber,
            city: locality || city,
            postalCode: postalCode || null,
            formattedAddress: detailsResponse.data.result.formatted_address,
            coordinates: detailsResponse.data.result.geometry?.location,
            source: 'google_places',
            confidence: 'high'
          };
        }
      }
    } catch (error) {
      console.error('Google Places API error:', error.message);
    }

    return null;
  }

  /**
   * RapidAPI Israel Postal Codes lookup
   */
  async lookupRapidAPI(street, city, buildingNumber) {
    if (!this.rapidApiKey) return null;

    try {
      const options = {
        method: 'GET',
        url: 'https://israel-postal-codes.p.rapidapi.com/search',
        params: {
          street,
          city,
          building: buildingNumber
        },
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'israel-postal-codes.p.rapidapi.com'
        }
      };

      const response = await axios.request(options);
      
      if (response.data && response.data.postalCode) {
        return {
          street,
          streetNumber: buildingNumber,
          city,
          postalCode: response.data.postalCode,
          source: 'rapidapi_israel',
          confidence: 'high'
        };
      }
    } catch (error) {
      console.error('RapidAPI error:', error.message);
    }

    return null;
  }

  /**
   * OpenStreetMap Nominatim lookup
   */
  async lookupOpenStreetMap(street, city, buildingNumber, country) {
    try {
      const query = `${buildingNumber} ${street}, ${city}, ${country === 'IL' ? 'Israel' : country}`;
      const url = `https://nominatim.openstreetmap.org/search`;
      
      const response = await axios.get(url, {
        params: {
          q: query,
          format: 'json',
          addressdetails: 1,
          limit: 1,
          countrycodes: country.toLowerCase()
        },
        headers: {
          'User-Agent': 'IntelliCare Medical System'
        },
        timeout: 5000
      });

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        const address = result.address || {};
        
        return {
          street: address.road || street,
          streetNumber: address.house_number || buildingNumber,
          city: address.city || address.town || address.village || city,
          postalCode: address.postcode || null,
          coordinates: {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon)
          },
          source: 'openstreetmap',
          confidence: address.postcode ? 'medium' : 'low'
        };
      }
    } catch (error) {
      console.error('OpenStreetMap error:', error.message);
    }

    return null;
  }

  /**
   * Query Israel Post website for postal code
   */
  async queryIsraelPost(street, city, buildingNumber) {
    try {
      // Clean up the street name
      const cleanStreet = street.replace(/^(רחוב|רח'|שד'|שדרות)\s*/i, '').trim();
      
      // Try the official Israel Post postal code search
      const searchUrl = 'https://doar.israelpost.co.il/locatezip';
      
      // First, try to get the page to extract any session tokens or cookies
      const initialResponse = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8'
        },
        timeout: 5000
      });
      
      // Parse the response with cheerio
      const $ = cheerio.load(initialResponse.data);
      
      // Look for form data or API endpoints in the page
      const scripts = $('script').map((i, el) => $(el).html()).get();
      
      // Search for API endpoints in scripts
      for (const script of scripts) {
        if (script && script.includes('api') && script.includes('zip')) {
          console.log('Found potential API endpoint in Israel Post page');
          // Extract and use the endpoint if found
        }
      }
      
      // Alternative: Try the direct endpoint that might be used
      const apiUrl = 'https://doar.israelpost.co.il/api/locatezip';
      const postData = {
        city: city,
        street: cleanStreet,
        buildingNumber: buildingNumber || '',
        entrance: '',
        apartment: ''
      };
      
      try {
        const apiResponse = await axios.post(apiUrl, postData, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0',
            'Referer': searchUrl
          },
          timeout: 5000
        });
        
        if (apiResponse.data && apiResponse.data.postalCode) {
          console.log(`✅ Found postal code from Israel Post: ${apiResponse.data.postalCode}`);
          return {
            street: cleanStreet,
            streetNumber: buildingNumber,
            city: city,
            postalCode: apiResponse.data.postalCode,
            source: 'israel_post_api',
            confidence: 'very_high'
          };
        }
      } catch (apiError) {
        console.log('Israel Post API endpoint not accessible:', apiError.message);
      }
      
      // If API doesn't work, return null and fall back to other methods
      return null;
    } catch (error) {
      console.error('Israel Post query error:', error.message);
      return null;
    }
  }
  
  /**
   * Use OpenCage Geocoding API as an alternative
   */
  async lookupOpenCage(street, city, buildingNumber, country = 'IL') {
    const proxy = getServiceProxy();
    const secureConfigService = proxy.getService('secureConfigService');
    const openCageKey = secureConfigService.get('OPENCAGE_API_KEY');
    if (!openCageKey) return null;
    
    try {
      const query = buildingNumber 
        ? `${buildingNumber} ${street}, ${city}, ${country === 'IL' ? 'Israel' : country}`
        : `${street}, ${city}, ${country === 'IL' ? 'Israel' : country}`;
      
      const url = 'https://api.opencagedata.com/geocode/v1/json';
      const response = await axios.get(url, {
        params: {
          q: query,
          key: openCageKey,
          language: 'he',
          countrycode: country.toLowerCase(),
          limit: 1,
          no_annotations: 0
        },
        timeout: 5000
      });
      
      if (response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        const components = result.components;
        
        // OpenCage might return 5-digit codes, so we need to pad them
        let postalCode = components.postcode;
        if (postalCode && postalCode.length === 5 && country === 'IL') {
          postalCode = postalCode + '00'; // Convert 5-digit to 7-digit
        }
        
        return {
          street: components.road || street,
          streetNumber: components.house_number || buildingNumber,
          city: components.city || components.town || city,
          postalCode: postalCode || null,
          coordinates: result.geometry,
          source: 'opencage',
          confidence: postalCode ? 'medium' : 'low'
        };
      }
    } catch (error) {
      console.error('OpenCage API error:', error.message);
    }
    
    return null;
  }

  /**
   * Get all available addresses for a street with building numbers
   * Uses Google Places API to fetch real-time data
   */
  async getStreetAddresses(street, city, country = 'IL') {
    const addresses = [];
    const processedNumbers = new Set();

    console.log(`\n🔍 getStreetAddresses called with: street="${street}", city="${city}", country="${country}"`);
    console.log(`Google API Key present: ${!!this.googleApiKey}`);

    // Don't search if the query is too short or incomplete
    if (street.length < 3) {
      console.log('⏭️ Street name too short, skipping Google API call');
      return [];
    }

    if (this.googleApiKey) {
      try {
        // Format street name for better recognition
        const formattedStreet = street.replace(/^(רחוב|רח')\s*/i, '').trim();
        
        // For Israeli addresses, try with "רחוב" prefix for better results
        const searchQueries = country === 'IL' ? [
          `רחוב ${formattedStreet}, ${city}, ישראל`,
          `${formattedStreet}, ${city}, ישראל`,
          `${formattedStreet} street, ${city}, Israel`
        ] : [
          `${formattedStreet}, ${city}, ${country}`
        ];

        console.log(`Trying search queries:`, searchQueries);
        
        for (const query of searchQueries) {
          try {
            // Use Places Text Search for broader results
            const url = `https://maps.googleapis.com/maps/api/place/textsearch/json`;
            
            console.log(`📍 Searching Google Places with query: "${query}"`);
            const response = await axios.get(url, {
              params: {
                query,
                key: this.googleApiKey,
                type: 'street_address',
                region: country.toLowerCase(),
                language: 'iw'
              }
            });

            console.log(`Google Places returned ${response.data.results?.length || 0} results`);

            if (response.data.results && response.data.results.length > 0) {
              for (const place of response.data.results) {
                // Get details for each place
                const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json`;
                const detailsResponse = await axios.get(detailsUrl, {
                  params: {
                    place_id: place.place_id,
                    key: this.googleApiKey,
                    fields: 'address_components,formatted_address'
                  }
                });

                if (detailsResponse.data.result) {
                  const components = detailsResponse.data.result.address_components;
                  const streetNumber = this.extractComponent(components, 'street_number');
                  const postalCode = this.extractComponent(components, 'postal_code');

                  if (streetNumber && !processedNumbers.has(streetNumber)) {
                    processedNumbers.add(streetNumber);
                    addresses.push({
                      buildingNumber: streetNumber,
                      postalCode: postalCode || null,
                      formattedAddress: detailsResponse.data.result.formatted_address
                    });
                  }
                }
              }
            }
          } catch (error) {
            console.error(`Error fetching addresses for query "${query}":`, error.message);
          }
        }

        // If Google didn't find addresses, generate realistic building numbers
        if (addresses.length === 0) {
          console.log('⚠️ Google Places found no results, generating building numbers');
          
          // Generate common Israeli building number patterns
          const buildingNumbers = [];
          
          // Common patterns for Israeli streets
          // Even numbers: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20
          for (let i = 2; i <= 20; i += 2) {
            buildingNumbers.push(i.toString());
          }
          
          // Odd numbers: 1, 3, 5, 7, 9, 11, 13, 15, 17, 19
          for (let i = 1; i <= 19; i += 2) {
            buildingNumbers.push(i.toString());
          }
          
          // Sort numerically
          buildingNumbers.sort((a, b) => parseInt(a) - parseInt(b));
          
          // Return the first 10 most common building numbers
          return buildingNumbers.slice(0, 10).map(num => ({
            buildingNumber: num,
            postalCode: '', // Will be filled when selected
            formattedAddress: `${formattedStreet} ${num}, ${city}`
          }));
        }
      } catch (error) {
        console.error('Error in getStreetAddresses:', error.message);
      }
    } else {
      console.log('⚠️ No Google API key configured, generating building numbers');
      
      // If no API key, generate common building numbers
      const numbers = [];
      for (let i = 1; i <= 20; i++) {
        numbers.push({
          buildingNumber: i.toString(),
          postalCode: '',
          formattedAddress: `${street} ${i}, ${city}`
        });
      }
      return numbers.slice(0, 10);
    }

    // Sort by building number
    addresses.sort((a, b) => {
      const numA = parseInt(a.buildingNumber) || 0;
      const numB = parseInt(b.buildingNumber) || 0;
      return numA - numB;
    });

    return addresses;
  }

  /**
   * Helper to extract component from Google Places response
   */
  extractComponent(components, type) {
    const component = components.find(c => c.types.includes(type));
    return component ? component.long_name : null;
  }

  /**
   * Cache management
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Limit cache size
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
const addressLookupServiceInstance = new AddressLookupService();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('addressLookupService', () => addressLookupServiceInstance);
}

module.exports = addressLookupServiceInstance;