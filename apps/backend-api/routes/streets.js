/**
 * Streets API Routes
 * Provides city and street data using Google Places API
 */

const express = require('express');
const router = express.Router();
const addressLookupService = require('../services/addressLookupService');

/**
 * Get supported countries
 * Returns a static list since we're using Google Places API globally
 */
router.get('/countries', async (req, res) => {
  try {
    // Static list of supported countries
    const countries = [
      {
        name: 'Israel',
        nameLocal: 'ישראל',
        code: 'IL',
        postalCodeFormat: 'NNNNNNN',
        language: 'he'
      },
      {
        name: 'United States',
        nameLocal: 'United States',
        code: 'US',
        postalCodeFormat: 'NNNNN',
        language: 'en'
      }
    ];

    res.json({
      success: true,
      data: {
        countries,
        total: countries.length
      }
    });

  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get cities by country
 * This endpoint is deprecated - use /api/address/cities for real-time city search
 */
router.get('/cities', async (req, res) => {
  // Return empty - cities should be fetched from Google Places API
  res.json({
    success: true,
    data: {
      cities: [],
      total: 0,
      message: 'Use /api/address/cities endpoint for real-time city search'
    }
  });
});

/**
 * Search streets in a city
 * Uses Google Places API for real-time data
 */
router.get('/search', async (req, res) => {
  try {
    const { city, q: query } = req.query;

    if (!city || !query) {
      return res.status(400).json({
        success: false,
        error: 'City and query are required'
      });
    }

    // Use Google Places API through our service
    const addresses = await addressLookupService.getStreetAddresses(query, city);

    // Format response for compatibility
    const streets = addresses.map(addr => ({
      name: query,
      nameLocal: query,
      buildingNumber: addr.buildingNumber,
      postalCode: addr.postalCode
    }));

    res.json({
      success: true,
      data: {
        streets,
        total: streets.length
      }
    });

  } catch (error) {
    console.error('Error searching streets:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get all streets by city
 * Returns empty since we use real-time search
 */
router.get('/by-city', async (req, res) => {
  const { city } = req.query;
  
  // We don't pre-load streets anymore, use search instead
  res.json({
    success: true,
    data: {
      streets: [],
      total: 0,
      message: 'Use the search endpoint with a street name for real-time results'
    }
  });
});

module.exports = router;