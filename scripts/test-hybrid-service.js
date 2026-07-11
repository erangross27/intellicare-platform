/**
 * Test script for hybrid address service with JSONP
 */

const hybridAddressService = require('../backend/services/hybridAddressService');

async function testService() {
  console.log('\n=== Testing Hybrid Address Service with data.gov.il JSONP ===\n');

  // Test 1: Search cities
  console.log('1. Testing city search:');
  console.log('-----------------------');
  
  const cityQueries = ['ירו', 'תל', 'חי'];
  
  for (const query of cityQueries) {
    console.log(`\nSearching for cities with: "${query}"`);
    const cities = await hybridAddressService.searchCities(query);
    console.log(`Found ${cities.length} cities:`);
    cities.slice(0, 3).forEach(city => {
      console.log(`  - ${city.name} ${city.nameEn ? `(${city.nameEn})` : ''}`);
    });
  }

  // Test 2: Search streets
  console.log('\n2. Testing street search:');
  console.log('-------------------------');
  
  const streetTests = [
    { city: 'ירושלים', query: 'הרצל' },
    { city: 'תל אביב-יפו', query: 'דיז' },
    { city: 'חיפה', query: 'הנ' }
  ];
  
  for (const test of streetTests) {
    console.log(`\nSearching streets in ${test.city} with query: "${test.query}"`);
    const streets = await hybridAddressService.searchStreets(test.city, test.query);
    console.log(`Found ${streets.length} streets:`);
    streets.slice(0, 3).forEach(street => {
      console.log(`  - ${street.name} ${street.nameEn ? `(${street.nameEn})` : ''}`);
    });
  }

  // Test 3: Service status
  console.log('\n3. Service Status:');
  console.log('------------------');
  const status = hybridAddressService.getStatus();
  console.log('Status:', JSON.stringify(status, null, 2));

  console.log('\n=== Test completed ===\n');
}

// Run the test
testService().catch(console.error);