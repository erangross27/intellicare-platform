/**
 * Test patient creation with Israeli address
 */

const axios = require('axios');
const baseURL = 'http://localhost:5000/api';

async function testPatientCreation() {
  console.log('\n=== Testing Patient Creation with Address ===\n');

  try {
    // Create a test patient with Israeli address
    const patientData = {
      nationalId: '123456789',  // Required field
      firstName: 'דוד',
      lastName: 'כהן',
      firstNameEn: 'David',
      lastNameEn: 'Cohen',
      dateOfBirth: '1980-05-15',
      gender: 'male',
      email: 'david.cohen@test.com',
      phone: '+972501234567',
      country: 'IL',
      city: 'ירושלים',
      street: 'הרצל',
      buildingNumber: '10',
      zipCode: '9618801',  // Changed from postalCode to zipCode
      status: 'Active',
      medicalHistory: 'Test patient for address verification',
      healthFund: 'מכבי'
    };

    console.log('Creating patient with Israeli address...');
    console.log(`Address: ${patientData.street} ${patientData.buildingNumber}, ${patientData.city}, Israel`);
    
    // Create patient with practice context
    const createResponse = await axios.post(`${baseURL}/patients`, patientData, {
      headers: {
        'X-Practice-Subdomain': 'demo'  // Use demo practice
      }
    });
    
    if (createResponse.data.success) {
      const patientId = createResponse.data.patient._id;
      console.log(`✅ Patient created successfully with ID: ${patientId}`);
      
      // Fetch the created patient
      const getResponse = await axios.get(`${baseURL}/patients/${patientId}`, {
        headers: {
          'X-Practice-Subdomain': 'demo'
        }
      });
      const patient = getResponse.data.patient;
      
      console.log('\nPatient Details:');
      console.log('----------------');
      console.log(`Name: ${patient.firstName} ${patient.lastName} (${patient.firstNameEn} ${patient.lastNameEn})`);
      console.log(`Date of Birth: ${new Date(patient.dateOfBirth).toLocaleDateString()}`);
      console.log(`Phone: ${patient.phone}`);
      console.log(`Email: ${patient.email}`);
      console.log('\nAddress Information:');
      console.log(`Country: ${patient.country}`);
      console.log(`City: ${patient.city}`);
      console.log(`Street: ${patient.street}`);
      console.log(`Building: ${patient.buildingNumber}`);
      console.log(`Postal Code: ${patient.postalCode}`);
      
      if (patient.idNumber) {
        console.log('\nIsraeli Specific:');
        console.log(`ID Number: ${patient.idNumber}`);
        console.log(`Health Fund: ${patient.healthFund}`);
      }
      
      console.log('\n✅ Patient creation and retrieval successful!');
      
      // Clean up - delete test patient
      await axios.delete(`${baseURL}/patients/${patientId}`, {
        headers: {
          'X-Practice-Subdomain': 'demo'
        }
      });
      console.log('🧹 Test patient deleted');
      
    } else {
      console.error('❌ Failed to create patient:', createResponse.data.message);
    }

  } catch (error) {
    if (error.response?.status === 404) {
      console.error('❌ API endpoint not found. Make sure the server is running on port 5000');
    } else {
      console.error('❌ Test failed:', error.response?.data || error.message);
    }
  }
}

// Run the test
testPatientCreation();