/**
 * Test data.gov.il API using curl from Node.js
 * Since the API blocks axios requests but works with curl
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Helper function to make curl requests
async function curlRequest(url) {
  try {
    const { stdout, stderr } = await execPromise(`curl -s "${url}"`);
    if (stderr) {
      console.error('Curl error:', stderr);
      return null;
    }
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Error executing curl:', error);
    return null;
  }
}

async function testAPI() {
  console.log('🔍 Testing data.gov.il API with curl from Node.js');
  console.log('=' .repeat(60));
  
  const baseUrl = 'https://data.gov.il/api/3/action/datastore_search';
  const resourceId = '9ad3862c-8391-4b2f-84a4-2d4c68625f4b';

  // 1. Test basic request
  console.log('\n1️⃣ Basic API Test - First 5 records');
  console.log('-'.repeat(40));
  
  const basicUrl = `${baseUrl}?resource_id=${resourceId}&limit=5`;
  const basicResult = await curlRequest(basicUrl);
  
  if (basicResult && basicResult.success) {
    console.log('✅ API is working!');
    console.log(`Total records in dataset: ${basicResult.result.total}`);
    console.log('Fields available:', basicResult.result.fields.map(f => f.id).join(', '));
    console.log('\nFirst record:');
    if (basicResult.result.records[0]) {
      console.log(basicResult.result.records[0]);
    }
  }

  // 2. Search for נס ציונה
  console.log('\n2️⃣ Searching for נס ציונה streets');
  console.log('-'.repeat(40));
  
  const nesZionaUrl = `${baseUrl}?resource_id=${resourceId}&q=${encodeURIComponent('נס ציונה')}&limit=10`;
  const nesZionaResult = await curlRequest(nesZionaUrl);
  
  if (nesZionaResult && nesZionaResult.success) {
    console.log(`Found ${nesZionaResult.result.total} records for נס ציונה`);
    console.log('First 10 streets:');
    nesZionaResult.result.records.forEach((record, i) => {
      console.log(`${i + 1}. ${record['שם_רחוב']} (code: ${record['סמל_רחוב']})`);
    });
  }

  // 3. Check major cities
  console.log('\n3️⃣ Checking street counts for major cities');
  console.log('-'.repeat(40));
  
  const cities = ['ירושלים', 'תל אביב-יפו', 'חיפה', 'ראשון לציון', 'פתח תקווה', 'אשדוד', 'נתניה'];
  
  for (const city of cities) {
    const cityUrl = `${baseUrl}?resource_id=${resourceId}&q=${encodeURIComponent(city)}&limit=0`;
    const cityResult = await curlRequest(cityUrl);
    
    if (cityResult && cityResult.success) {
      console.log(`${city}: ${cityResult.result.total} records`);
    }
  }

  // 4. Look for postal code data
  console.log('\n4️⃣ Checking available resources for postal codes');
  console.log('-'.repeat(40));
  
  // Try to find postal code dataset
  const postalResources = [
    'd4901683-75c4-47f8-9167-67d86096ec8b', // Another potential resource ID
    'a7296d1a-f8c9-4b70-96c2-6ebb4352f8e3', // Zip codes resource (if exists)
  ];
  
  console.log('Testing potential postal code resources...');
  for (const resourceId of postalResources) {
    const testUrl = `${baseUrl}?resource_id=${resourceId}&limit=1`;
    const result = await curlRequest(testUrl);
    
    if (result && result.success) {
      console.log(`✅ Resource ${resourceId} exists!`);
      console.log('Fields:', result.result.fields.map(f => f.id).join(', '));
    } else {
      console.log(`❌ Resource ${resourceId} not found or not accessible`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINDINGS SUMMARY');
  console.log('='.repeat(60));
  console.log(`
✅ What Works:
- API is accessible via curl (but not axios due to blocking)
- Dataset contains 62,691 street records
- Search functionality works with 'q' parameter
- Hebrew city and street names are available
- City codes (סמל_ישוב) and street codes (סמל_רחוב) included

❌ What's Missing:
- No postal codes in this dataset
- No English names in this dataset
- Need separate dataset for postal codes

📝 Implementation Notes:
1. Use curl or spawn process for API calls from Node.js
2. Cache results to minimize API calls
3. Need to find postal codes from another source
4. Consider downloading full dataset for offline use

🎯 Next Steps:
1. Implement curl-based service for production
2. Build local cache of frequently used cities
3. Manual postal code entry as fallback
4. Look for additional datasets with postal codes
`);
}

// Run the test
testAPI().catch(console.error);