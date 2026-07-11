/**
 * Manual Address Entry Service
 * Allows manual street entry for cities without data
 */

const serviceAccountManager = require('../../../../../backend/services/serviceAccountManager');

class ManualAddressService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return this;
    }
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('manual-address-service');
      this.initialized = true;
      console.log('✅ Manual Address Service initialized with security token');
    } catch (error) {
      console.error('Failed to initialize Manual Address Service:', error);
      throw error;
    }

    return this;
  }

  /**
   * Check if we have street data for a city
   */
  async hasStreetData(city) {
    if (!this.initialized) {
      await this.initialize();
    }
    // We only have data for these 4 cities
    const citiesWithData = [
      'נס ציונה',
      'תל אביב-יפו', 
      'ירושלים',
      'חיפה'
    ];
    
    return citiesWithData.includes(city);
  }

  /**
   * Get placeholder streets for manual entry
   */
  async getManualEntryPrompt(city) {
    if (!this.initialized) {
      await this.initialize();
    }
    return [
      {
        name: '',
        nameEn: '',
        manual: true,
        placeholder: 'הקלד שם רחוב',
        placeholderEn: 'Type street name',
        message: `אין נתוני רחובות עבור ${city}. הקלד ידנית`,
        messageEn: `No street data for ${city}. Enter manually`
      }
    ];
  }

  /**
   * Validate manually entered street name
   */
  async validateStreetName(streetName) {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!streetName || streetName.trim().length < 2) {
      return {
        valid: false,
        error: 'Street name must be at least 2 characters'
      };
    }
    
    return { valid: true };
  }

  /**
   * Format manual address entry
   */
  async formatManualAddress(city, street, buildingNumber) {
    if (!this.initialized) {
      await this.initialize();
    }
    return {
      city: city,
      street: street,
      buildingNumber: buildingNumber,
      fullAddress: `${street} ${buildingNumber}, ${city}`,
      manual: true,
      postalCode: null, // User must enter manually
      message: 'Please enter postal code manually'
    };
  }

  /**
   * Get postal code entry instructions
   */
  async getPostalCodeInstructions() {
    if (!this.initialized) {
      await this.initialize();
    }
    return {
      he: {
        title: 'הזנת מיקוד',
        instruction: 'הכנס מיקוד בן 7 ספרות',
        link: 'בדוק מיקוד באתר דואר ישראל',
        url: 'https://doar.israelpost.co.il/'
      },
      en: {
        title: 'Postal Code Entry',
        instruction: 'Enter 7-digit postal code',
        link: 'Check postal code on Israel Post website',
        url: 'https://doar.israelpost.co.il/en'
      }
    };
  }
}

// Export singleton instance for backward compatibility
module.exports = new ManualAddressService();