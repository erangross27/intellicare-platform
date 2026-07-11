/**
 * Smart Location Service
 * Provides intelligent business lookup and location detection
 * Makes practice creation magical by auto-detecting everything from just a business name
 */

const axios = require('axios');
const productionKMS = require('../../../../backend/services/productionKMS');
const serviceAccountManager = require('../../../../backend/services/serviceAccountManager');

class SmartLocationService {
  constructor() {
    this.apiKey = null; // Will be loaded from KMS
    // Using new Places API v1 endpoints
    this.placesSearchUrl = 'https://places.googleapis.com/v1/places:searchText';
    this.placeDetailsUrl = 'https://places.googleapis.com/v1/places';
    this.geocodeUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    this.initialized = false;
    this.serviceToken = null;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('smartLocationService');
      
      await productionKMS.initialize();
      this.apiKey = await productionKMS.getInternalKey('GOOGLE_API_KEY');
      
      if (!this.apiKey) {
        console.error('❌ [Smart Location] Google Maps API key not found in KMS');
        throw new Error('Google Maps API key not configured');
      }
      
      console.log('✅ [Smart Location] API key loaded from KMS');
      this.initialized = true;
    } catch (error) {
      console.error('❌ [Smart Location] Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Get service context for database operations
   */
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'smartLocationService',
      operation: 'database-access',
      practiceId: practiceId
    };
  }

  /**
   * Search for a medical business/practice by name
   */
  async searchMedicalBusiness(businessName, region = null) {
    if (!this.initialized) await this.initialize();
    
    try {
      console.log(`🔍 [Smart Location] Searching for business: "${businessName}"`);
      
      // Detect if the query is in Hebrew
      const isHebrew = /[\u0590-\u05FF]/.test(businessName);
      const languageCode = isHebrew ? 'he' : 'en';
      
      // Don't add extra keywords if it already contains medical terms
      const medicalTermsEn = /medical|practice|hospital|center|health/i;
      const medicalTermsHe = /רפואי|מרפאה|בית חולים|מרכז|בריאות/;
      const hasMedicalTerm = isHebrew ? medicalTermsHe.test(businessName) : medicalTermsEn.test(businessName);
      
      // Add appropriate medical keywords based on language
      let searchQuery = businessName;
      if (!hasMedicalTerm) {
        searchQuery = isHebrew 
          ? `${businessName} בית חולים מרפאה מרכז רפואי`
          : `${businessName} medical practice hospital`;
      }
      
      // Google Places API (New) - Text Search
      const response = await axios.post(this.placesSearchUrl, {
        textQuery: searchQuery,
        languageCode: languageCode,
        maxResultCount: 1,
        // Add region bias for Israel if Hebrew detected
        ...(isHebrew && { regionCode: 'IL' })
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location'
        }
      });

      if (response.data.places && response.data.places.length > 0) {
        const place = response.data.places[0];
        console.log(`✅ [Smart Location] Found: "${place.displayName.text}" at ${place.formattedAddress}`);
        
        return {
          success: true,
          placeId: place.id,
          name: place.displayName?.text || businessName,
          address: place.formattedAddress
        };
      }

      console.log(`⚠️ [Smart Location] No business found for: "${businessName}"`);
      return { success: false };
    } catch (error) {
      console.error('❌ [Smart Location] Search error:', error.response?.data || error.message);
      return { success: false };
    }
  }

  /**
   * Get complete business details
   */
  async getBusinessDetails(placeId, preferHebrew = false) {
    if (!this.initialized) await this.initialize();
    
    try {
      console.log(`📍 [Smart Location] Getting full details for place ID: ${placeId}`);
      
      // Google Places API (New) - get place details
      // The API supports language preferences through Accept-Language header
      const response = await axios.get(`${this.placeDetailsUrl}/${placeId}`, {
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,addressComponents,nationalPhoneNumber,internationalPhoneNumber,websiteUri,types,location,regularOpeningHours,currentOpeningHours',
          // Request Hebrew language for display names if preferred
          ...(preferHebrew && { 'Accept-Language': 'he-IL' })
        }
      });

      if (response.data) {
        const place = response.data;
        const components = place.addressComponents || [];
        
        let streetNumber = '', streetName = '', city = '', state = '', stateCode = '';
        let zipCode = '', country = '', countryCode = '';
        
        for (const comp of components) {
          const types = comp.types || [];
          if (types.includes('street_number')) streetNumber = comp.longText || comp.shortText;
          if (types.includes('route')) streetName = comp.longText || comp.shortText;
          if (types.includes('locality')) city = comp.longText || comp.shortText;
          if (types.includes('administrative_area_level_1')) {
            state = comp.longText || comp.shortText;
            stateCode = comp.shortText || state;
          }
          if (types.includes('postal_code')) zipCode = comp.longText || comp.shortText;
          if (types.includes('country')) {
            country = comp.longText || comp.shortText;
            countryCode = comp.shortText || country;
          }
        }
        
        const streetAddress = `${streetNumber} ${streetName}`.trim();
        
        // Extract opening hours if available
        let openingHours = null;
        if (place.regularOpeningHours) {
          openingHours = {
            weekdayDescriptions: place.regularOpeningHours.weekdayDescriptions || [],
            periods: place.regularOpeningHours.periods || [],
            openNow: place.currentOpeningHours?.openNow || false
          };
          console.log('📅 [Smart Location] Opening hours found:', openingHours.weekdayDescriptions);
        }

        return {
          success: true,
          name: place.displayName?.text || placeId,
          address: place.formattedAddress,
          streetAddress,
          city,
          state,
          stateCode,
          zipCode,
          country,
          countryCode,
          phone: place.nationalPhoneNumber || place.internationalPhoneNumber,
          website: place.websiteUri,
          openingHours,
          isUSA: countryCode === 'US',
          isIsrael: countryCode === 'IL',
          isMedical: place.types?.some(t => 
            ['hospital', 'doctor', 'health', 'practice', 'medical_center'].includes(t)
          )
        };
      }

      return { success: false };
    } catch (error) {
      console.error('❌ [Smart Location] Details error:', error.message);
      return { success: false };
    }
  }

  /**
   * Smart lookup - tries business search first, falls back to city
   */
  async smartLookup(input) {
    if (!this.initialized) await this.initialize();
    
    // Detect if input is in Hebrew
    const isHebrew = /[\u0590-\u05FF]/.test(input);
    
    // First try as business name
    const businessSearch = await this.searchMedicalBusiness(input);
    
    if (businessSearch.success) {
      const details = await this.getBusinessDetails(businessSearch.placeId, isHebrew);
      if (details.success) {
        console.log(`🎯 [Smart Location] Found complete business info!`);
        console.log(`  Name: ${details.name}`);
        console.log(`  Address: ${details.address}`);
        console.log(`  City: ${details.city}, ${details.stateCode}`);
        console.log(`  Phone: ${details.phone || 'Not available'}`);
        console.log(`  Website: ${details.website || 'Not available'}`);
        
        return {
          type: 'business',
          success: true,
          ...details
        };
      }
    }

    // Fallback to city lookup
    console.log(`🔄 [Smart Location] Trying as city name...`);
    
    try {
      const response = await axios.get(this.geocodeUrl, {
        params: { 
          address: input, 
          key: this.apiKey,
          // Add language and region for better Hebrew/Israeli results
          ...(isHebrew && { 
            language: 'he',
            region: 'il' 
          })
        }
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        const components = result.address_components;
        
        let city = '', state = '', stateCode = '', country = '', countryCode = '';
        
        for (const comp of components) {
          if (comp.types.includes('locality')) city = comp.long_name;
          if (comp.types.includes('administrative_area_level_1')) {
            state = comp.long_name;
            stateCode = comp.short_name;
          }
          if (comp.types.includes('country')) {
            country = comp.long_name;
            countryCode = comp.short_name;
          }
        }

        console.log(`✅ [Smart Location] Found city: ${city}, ${stateCode}`);
        
        return {
          type: 'city',
          success: true,
          city,
          state,
          stateCode,
          country,
          countryCode,
          isUSA: countryCode === 'US',
          isIsrael: countryCode === 'IL'
        };
      }
    } catch (error) {
      console.error('❌ [Smart Location] City lookup error:', error.message);
    }

    return { success: false };
  }
}

module.exports = new SmartLocationService();