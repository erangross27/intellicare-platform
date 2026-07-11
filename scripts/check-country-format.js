// Quick script to check how countries are stored
const axios = require('axios');

async function checkCountryFormat() {
  // Create a test patient
  const testData = {
    nationalId: '555555555',
    firstName: 'Test',
    lastName: 'Country',
    name: 'Test Country',
    age: 30,
    dateOfBirth: '1994-01-01',
    email: 'test@country.com',
    phone: '+972501234567',
    country: 'Israel',  // Just the name, no code
    city: 'Jerusalem',
    street: 'Test',
    zipCode: '9618801',
    healthFund: 'מכבי'
  };

  try {
    const response = await axios.post('http://localhost:5000/api/patients', testData, {
      headers: {
        'X-Practice-Subdomain': 'developer',
        'Content-Type': 'application/json'
      }
    });

    console.log('Created patient with country:', response.data.data.country);
    
    // Now fetch it back
    const getResponse = await axios.get(`http://localhost:5000/api/patients/${response.data.data._id}`, {
      headers: {
        'X-Practice-Subdomain': 'developer'
      }
    });
    
    console.log('Retrieved patient country:', getResponse.data.data.country);
    
    // Clean up
    await axios.delete(`http://localhost:5000/api/patients/${response.data.data._id}`, {
      headers: {
        'X-Practice-Subdomain': 'developer',
        'Authorization': 'Bearer dummy' // Will fail but that's ok for test
      }
    }).catch(() => {});
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkCountryFormat();