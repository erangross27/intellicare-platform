/**
 * Test Address API endpoints
 */

const axios = require('axios');
const baseURL = 'http://localhost:5000/api/israeli-address';

async function testAddressAPI() {
  console.log('\n=== Testing Address API Endpoints ===\n');

  try {
    // Test 1: Search cities
    console.log('1. Testing city search:');
    console.log('-----------------------');
    
    const cityResponse = await axios.get(`${baseURL}/cities`, {
      params: { q: 'ירו' }
    });
    
    console.log(`Found ${cityResponse.data.cities.length} cities:`);
    cityResponse.data.cities.slice(0, 3).forEach(city => {
      console.log(`  - ${city.name} ${city.nameEn ? `(${city.nameEn})` : ''}`);
    });
    console.log(`Source: ${cityResponse.data.source}\n`);

    // Test 2: Search streets
    console.log('2. Testing street search:');
    console.log('-------------------------');
    
    const streetResponse = await axios.get(`${baseURL}/streets`, {
      params: { 
        city: 'ירושלים',
        q: 'הרצל'
      }
    });
    
    console.log(`Found ${streetResponse.data.streets.length} streets in ירושלים:`);
    streetResponse.data.streets.slice(0, 3).forEach(street => {
      console.log(`  - ${street.name} ${street.nameEn ? `(${street.nameEn})` : ''}`);
    });
    console.log(`Source: ${streetResponse.data.source}`);
    console.log(`Manual entry: ${streetResponse.data.manualEntry}\n`);

    // Test 3: Get postal code
    console.log('3. Testing postal code lookup:');
    console.log('-------------------------------');
    
    const postalResponse = await axios.get(`${baseURL}/postal-code`, {
      params: {
        city: 'ירושלים',
        street: 'הרצל',
        buildingNumber: '1'
      }
    });
    
    console.log(`Postal code: ${postalResponse.data.postalCode || 'Not found'}`);
    console.log(`Source: ${postalResponse.data.source}`);
    if (postalResponse.data.message) {
      console.log(`Message: ${postalResponse.data.message}`);
    }

    console.log('\n✅ All API endpoints working correctly!\n');

  } catch (error) {
    console.error('❌ API test failed:', error.response?.data || error.message);
  }
}

// Run the test
testAddressAPI();