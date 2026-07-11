/**
 * Simple test for data.gov.il API
 * Testing with minimal requests and browser-like headers
 */

const axios = require('axios');

async function testSimpleAPI() {
  console.log('Testing data.gov.il API with browser headers...\n');
  
  // Use browser-like headers to avoid 403
  const config = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Referer': 'https://data.gov.il/',
      'Origin': 'https://data.gov.il'
    }
  };

  try {
    // Try a simple search first
    console.log('1. Testing basic search for נס ציונה streets...');
    const url = 'https://data.gov.il/api/3/action/datastore_search';
    
    const response = await axios.get(url, {
      ...config,
      params: {
        resource_id: '9ad3862c-8391-4b2f-84a4-2d4c68625f4b',
        q: 'נס ציונה',
        limit: 5
      }
    });

    if (response.data && response.data.success) {
      console.log('✅ API responded successfully!');
      console.log(`Total records found: ${response.data.result.total}`);
      console.log('\nFirst few records:');
      
      response.data.result.records.forEach((record, i) => {
        console.log(`\n${i + 1}. City: ${record['שם_ישוב']}, Street: ${record['שם_רחוב']}`);
        // Check what fields are available
        if (i === 0) {
          console.log('   Available fields:', Object.keys(record).join(', '));
        }
      });
    }

  } catch (error) {
    if (error.response && error.response.status === 403) {
      console.log('❌ Still getting 403 error. The API might be blocking automated requests.');
      console.log('\nTrying alternative approach - direct browser fetch...');
      
      // Try with fetch if available (Node 18+)
      if (typeof fetch !== 'undefined') {
        try {
          const fetchResponse = await fetch(
            'https://data.gov.il/api/3/action/datastore_search?' + 
            'resource_id=9ad3862c-8391-4b2f-84a4-2d4c68625f4b&q=נס ציונה&limit=5',
            {
              headers: {
                'Accept': 'application/json'
              }
            }
          );
          const data = await fetchResponse.json();
          console.log('Fetch result:', data);
        } catch (fetchError) {
          console.log('Fetch also failed:', fetchError.message);
        }
      }
      
      console.log('\n📝 Note: The API appears to be blocking automated requests.');
      console.log('This might require:');
      console.log('1. Using a proxy or VPN');
      console.log('2. Running from a different IP');
      console.log('3. Using the API from client-side (browser) instead');
      console.log('4. Getting an API key if available');
      
    } else {
      console.error('Error:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
      }
    }
  }
}

// Alternative: Try downloading the dataset directly
async function tryDirectDownload() {
  console.log('\n2. Trying to get dataset metadata...');
  
  try {
    // Try to get package/dataset info
    const packageUrl = 'https://data.gov.il/api/3/action/package_show';
    const response = await axios.get(packageUrl, {
      params: {
        id: 'israeli-streets-and-cities'  // Guessing the package name
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log('Package info:', response.data);
    
  } catch (error) {
    console.log('Could not get package info:', error.message);
    
    // Try getting resource directly
    console.log('\n3. Trying to get resource metadata...');
    try {
      const resourceUrl = 'https://data.gov.il/api/3/action/resource_show';
      const response = await axios.get(resourceUrl, {
        params: {
          id: '9ad3862c-8391-4b2f-84a4-2d4c68625f4b'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      console.log('Resource info:', response.data);
      
      if (response.data.result && response.data.result.url) {
        console.log('Download URL:', response.data.result.url);
      }
      
    } catch (resourceError) {
      console.log('Could not get resource info:', resourceError.message);
    }
  }
}

// Run tests
async function runAllTests() {
  await testSimpleAPI();
  await tryDirectDownload();
  
  console.log('\n' + '='.repeat(60));
  console.log('CONCLUSION:');
  console.log('If the API is blocking us, we have these options:');
  console.log('1. Use the API from frontend (browser) to avoid CORS/blocking');
  console.log('2. Download the full dataset and import it locally');
  console.log('3. Use manual entry for now (current solution)');
  console.log('4. Find an alternative API or data source');
}

runAllTests().catch(console.error);