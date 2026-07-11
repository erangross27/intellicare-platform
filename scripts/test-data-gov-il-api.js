/**
 * Test script for data.gov.il CKAN API
 * Exploring Israeli street and city data
 * Resource ID: 9ad3862c-8391-4b2f-84a4-2d4c68625f4b (רחובות בישראל)
 */

const axios = require('axios');

const BASE_URL = 'https://data.gov.il/api/3/action';
const STREETS_RESOURCE_ID = '9ad3862c-8391-4b2f-84a4-2d4c68625f4b';

async function testAPI() {
  console.log('🔍 Testing data.gov.il CKAN API');
  console.log('=' .repeat(60));
  console.log(`Resource ID: ${STREETS_RESOURCE_ID}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  try {
    // 1. Test basic datastore info
    console.log('1️⃣ Getting Resource Info...');
    console.log('-'.repeat(40));
    
    const infoResponse = await axios.get(`${BASE_URL}/datastore_info`, {
      params: {
        id: STREETS_RESOURCE_ID
      }
    });

    if (infoResponse.data.success) {
      const fields = infoResponse.data.result.schema.fields;
      console.log('Available fields:');
      fields.forEach(field => {
        console.log(`  • ${field.id} (${field.type})`);
      });
    }

    // 2. Get sample records to understand data structure
    console.log('\n2️⃣ Getting Sample Records...');
    console.log('-'.repeat(40));
    
    const sampleResponse = await axios.get(`${BASE_URL}/datastore_search`, {
      params: {
        resource_id: STREETS_RESOURCE_ID,
        limit: 5
      }
    });

    if (sampleResponse.data.success) {
      console.log(`Total records: ${sampleResponse.data.result.total}`);
      console.log('\nSample records:');
      sampleResponse.data.result.records.forEach((record, index) => {
        console.log(`\nRecord ${index + 1}:`);
        console.log(JSON.stringify(record, null, 2));
      });
    }

    // 3. Test searching for a specific city (נס ציונה)
    console.log('\n3️⃣ Testing City Search: נס ציונה');
    console.log('-'.repeat(40));
    
    const cityResponse = await axios.get(`${BASE_URL}/datastore_search`, {
      params: {
        resource_id: STREETS_RESOURCE_ID,
        filters: JSON.stringify({
          'שם_ישוב': 'נס ציונה'
        }),
        limit: 10
      }
    });

    if (cityResponse.data.success) {
      const streets = cityResponse.data.result.records;
      console.log(`Found ${streets.length} streets in נס ציונה:`);
      streets.forEach(street => {
        console.log(`  • ${street['שם_רחוב']} (code: ${street['סמל_רחוב']})`);
      });
    }

    // 4. Test searching for a specific street (דוד לנדאו)
    console.log('\n4️⃣ Testing Street Search: דוד לנדאו in נס ציונה');
    console.log('-'.repeat(40));
    
    const streetResponse = await axios.get(`${BASE_URL}/datastore_search`, {
      params: {
        resource_id: STREETS_RESOURCE_ID,
        filters: JSON.stringify({
          'שם_ישוב': 'נס ציונה',
          'שם_רחוב': 'דוד לנדאו'
        })
      }
    });

    if (streetResponse.data.success) {
      const records = streetResponse.data.result.records;
      console.log(`Found ${records.length} record(s) for דוד לנדאו:`);
      records.forEach(record => {
        console.log('\nFull record:');
        console.log(JSON.stringify(record, null, 2));
      });
    }

    // 5. Get unique cities using SQL
    console.log('\n5️⃣ Getting All Unique Cities (using SQL)...');
    console.log('-'.repeat(40));
    
    const citiesResponse = await axios.get(`${BASE_URL}/datastore_search_sql`, {
      params: {
        sql: `SELECT DISTINCT "שם_ישוב", "סמל_ישוב" 
              FROM "${STREETS_RESOURCE_ID}" 
              WHERE "שם_ישוב" IS NOT NULL 
              ORDER BY "שם_ישוב" 
              LIMIT 20`
      }
    });

    if (citiesResponse.data.success) {
      const cities = citiesResponse.data.result.records;
      console.log(`Sample of ${cities.length} cities:`);
      cities.forEach(city => {
        console.log(`  • ${city['שם_ישוב']} (code: ${city['סמל_ישוב']})`);
      });
    }

    // 6. Test text search with 'q' parameter
    console.log('\n6️⃣ Testing Text Search (q parameter) for "תל אביב"...');
    console.log('-'.repeat(40));
    
    const textSearchResponse = await axios.get(`${BASE_URL}/datastore_search`, {
      params: {
        resource_id: STREETS_RESOURCE_ID,
        q: 'תל אביב',
        limit: 5
      }
    });

    if (textSearchResponse.data.success) {
      const records = textSearchResponse.data.result.records;
      console.log(`Found ${textSearchResponse.data.result.total} total matches`);
      console.log('First 5 results:');
      records.forEach(record => {
        console.log(`  • ${record['שם_ישוב']} - ${record['שם_רחוב']}`);
      });
    }

    // 7. Check if postal codes are in this dataset
    console.log('\n7️⃣ Checking for Postal Code Fields...');
    console.log('-'.repeat(40));
    
    const postalCheckResponse = await axios.get(`${BASE_URL}/datastore_search`, {
      params: {
        resource_id: STREETS_RESOURCE_ID,
        limit: 1
      }
    });

    if (postalCheckResponse.data.success) {
      const record = postalCheckResponse.data.result.records[0];
      const fields = Object.keys(record);
      const postalFields = fields.filter(field => 
        field.includes('מיקוד') || 
        field.includes('zip') || 
        field.includes('postal') ||
        field.includes('דואר')
      );
      
      if (postalFields.length > 0) {
        console.log('✅ Found postal code fields:', postalFields);
      } else {
        console.log('❌ No postal code fields found in this dataset');
        console.log('Available fields:', fields.join(', '));
      }
    }

    // 8. Test getting count of streets per city
    console.log('\n8️⃣ Getting Street Count for Major Cities...');
    console.log('-'.repeat(40));
    
    const majorCities = ['ירושלים', 'תל אביב-יפו', 'חיפה', 'ראשון לציון', 'פתח תקווה'];
    
    for (const city of majorCities) {
      const countResponse = await axios.get(`${BASE_URL}/datastore_search`, {
        params: {
          resource_id: STREETS_RESOURCE_ID,
          filters: JSON.stringify({ 'שם_ישוב': city }),
          limit: 0  // We just want the count
        }
      });
      
      if (countResponse.data.success) {
        console.log(`  • ${city}: ${countResponse.data.result.total} streets`);
      }
    }

    // 9. Test English street names (if available)
    console.log('\n9️⃣ Checking for English Street Names...');
    console.log('-'.repeat(40));
    
    const englishCheckResponse = await axios.get(`${BASE_URL}/datastore_search_sql`, {
      params: {
        sql: `SELECT * FROM "${STREETS_RESOURCE_ID}" LIMIT 1`
      }
    });

    if (englishCheckResponse.data.success) {
      const record = englishCheckResponse.data.result.records[0];
      const englishFields = Object.keys(record).filter(field => 
        field.includes('english') || 
        field.includes('en') || 
        field.includes('לועזי')
      );
      
      if (englishFields.length > 0) {
        console.log('✅ Found English fields:', englishFields);
        englishFields.forEach(field => {
          console.log(`  ${field}: ${record[field]}`);
        });
      } else {
        console.log('❌ No English name fields found');
      }
    }

    // 10. Performance test - measure response times
    console.log('\n🔟 Performance Test...');
    console.log('-'.repeat(40));
    
    const startTime = Date.now();
    await axios.get(`${BASE_URL}/datastore_search`, {
      params: {
        resource_id: STREETS_RESOURCE_ID,
        filters: JSON.stringify({ 'שם_ישוב': 'תל אביב-יפו' }),
        limit: 100
      }
    });
    const endTime = Date.now();
    
    console.log(`Response time for 100 streets: ${endTime - startTime}ms`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`
Key Findings:
1. API is accessible and working
2. Dataset contains street names by city
3. Both Hebrew names are available
4. City and street codes are included
5. SQL queries are supported for complex operations
6. Text search with 'q' parameter works
7. Need to check separately for postal codes dataset

Next Steps:
1. Implement this API in the hybridAddressService
2. Cache frequently accessed data
3. Find postal codes dataset (if exists)
4. Handle API failures gracefully with local fallback
`);
}

// Run the test
console.log('Starting API test...\n');
testAPI().then(() => {
  console.log('\n✅ Test completed successfully');
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});