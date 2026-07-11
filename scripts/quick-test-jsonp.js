/**
 * Quick test - JSONP style request from Node.js
 */

const axios = require('axios');

async function testJSONP() {
  console.log('Testing data.gov.il with callback parameter...\n');
  
  try {
    // Try with callback parameter (JSONP style)
    const url = 'https://data.gov.il/api/3/action/datastore_search';
    const params = {
      resource_id: '9ad3862c-8391-4b2f-84a4-2d4c68625f4b',
      limit: 5,
      q: 'נס ציונה',
      callback: 'jQuery1234567890' // Simulate JSONP callback
    };
    
    console.log('Request URL:', url);
    console.log('Params:', params);
    
    const response = await axios.get(url, { 
      params,
      headers: {
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    console.log('Response received!');
    console.log('Status:', response.status);
    console.log('Content type:', response.headers['content-type']);
    
    // JSONP response will be wrapped in callback
    const data = response.data;
    if (typeof data === 'string' && data.startsWith('jQuery')) {
      console.log('Got JSONP response');
      // Extract JSON from JSONP
      const jsonStr = data.substring(data.indexOf('(') + 1, data.lastIndexOf(')'));
      const json = JSON.parse(jsonStr);
      console.log('Total records:', json.result.total);
      console.log('First record:', json.result.records[0]);
    } else {
      console.log('Got regular JSON response');
      console.log('Total records:', data.result?.total);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Headers:', error.response.headers);
    }
  }
}

testJSONP();