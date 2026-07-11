/**
 * Israel Post Official API Service
 * Integrates with the real Israel Post API endpoints
 */

const axios = require('axios');
const serviceAccountManager = require('../../../backend/services/serviceAccountManager');

class IsraelPostApiService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.baseUrl = 'https://apimftprd.israelpost.co.il/mypost-zip';
    
    // These headers match what the Israel Post website uses
    this.headers = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'he,en-US;q=0.9,en;q=0.8',
      'Content-Type': 'application/json',
      'Origin': 'https://doar.israelpost.co.il',
      'Referer': 'https://doar.israelpost.co.il/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    };
    
    // Cache to reduce API calls
    this.cache = {
      cities: null,
      streets: new Map(),
      postalCodes: new Map()
    };
  }

  async initialize() {
    if (this.initialized) {
      return;
    }
    
    this.serviceToken = await serviceAccountManager.authenticate('israel-post-api-service');
    this.initialized = true;
    console.log('✅ Israel Post API Service initialized with security token');
  }

  // Add remaining service methods from original file
  async getCities() {
    if (!this.initialized) await this.initialize();
    // Implementation continues...
  }

  async getStreets(cityId) {
    if (!this.initialized) await this.initialize();
    // Implementation continues...
  }

  async validateAddress(address) {
    if (!this.initialized) await this.initialize();
    // Implementation continues...
  }
}

module.exports = new IsraelPostApiService();