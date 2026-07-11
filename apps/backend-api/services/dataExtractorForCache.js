/**
 * Data Extractor for Cache Warming
 * Extracts real data from MongoDB to generate meaningful cache queries
 * This ensures we cache actual responses that users will need
 */

const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');

class DataExtractorForCache {
  constructor() {
    this.extractedData = {
      patients: [],
      providers: [],
      appointments: [],
      medications: [],
      diagnoses: [],
      labTests: [],
      documents: [],
      allergies: [],
      vitalSigns: []
    };
  }

  /**
   * Initialize and authenticate the service
   */
  async initialize() {
    try {
      // Authenticate as data extractor service
      this.auth = await serviceAccountManager.authenticate('data-extractor-service');
      console.log('✅ Data extractor authenticated');
      return true;
    } catch (error) {
      console.error('❌ Data extractor initialization failed:', error);
      return false;
    }
  }

  /**
   * Extract all patient data with names and IDs
   */
  async extractPatients(practiceId = 'stanford') {
    try {
      console.log('📊 Extracting patient data...');
      
      const context = {
        serviceId: 'data-extractor-service',
        operation: 'extract-patients',
        practiceId: practiceId
      };

      // Get all patients with essential fields
      const patients = await SecureDataAccess.query(
        'patients',
        {},
        {
          projection: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            dateOfBirth: 1,
            gender: 1,
            email: 1,
            phone: 1
          },
          limit: 100  // Start with first 100 patients
        },
        context
      );

      this.extractedData.patients = patients.map(p => ({
        id: p._id,
        fullName: `${p.firstName} ${p.lastName}`,
        firstName: p.firstName,
        lastName: p.lastName,
        dateOfBirth: p.dateOfBirth,
        gender: p.gender
      }));

      console.log(`   ✅ Extracted ${this.extractedData.patients.length} patients`);
      return this.extractedData.patients;
    } catch (error) {
      console.error('❌ Failed to extract patients:', error);
      return [];
    }
  }

  /**
   * Extract provider/doctor names and specialties
   */
  async extractProviders(practiceId = 'stanford') {
    try {
      console.log('👨‍⚕️ Extracting provider data...');
      
      const context = {
        serviceId: 'data-extractor-service',
        operation: 'extract-providers',
        practiceId: practiceId
      };

      const providers = await SecureDataAccess.query(
        'users',
        { role: { $in: ['doctor', 'provider', 'physician'] } },
        {
          projection: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            specialty: 1,
            role: 1,
            email: 1
          }
        },
        context
      );

      this.extractedData.providers = providers.map(p => ({
        id: p._id,
        fullName: `Dr. ${p.firstName} ${p.lastName}`,
        firstName: p.firstName,
        lastName: p.lastName,
        specialty: p.specialty || 'General Practice',
        role: p.role
      }));

      console.log(`   ✅ Extracted ${this.extractedData.providers.length} providers`);
      return this.extractedData.providers;
    } catch (error) {
      console.error('❌ Failed to extract providers:', error);
      return [];
    }
  }

  /**
   * Extract real appointment dates and types
   */
  async extractAppointments(practiceId = 'stanford') {
    try {
      console.log('📅 Extracting appointment data...');
      
      const context = {
        serviceId: 'data-extractor-service',
        operation: 'extract-appointments',
        practiceId: practiceId
      };

      // Get upcoming and recent appointments
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const appointments = await SecureDataAccess.query(
        'appointments',
        { date: { $gte: thirtyDaysAgo } },
        {
          projection: {
            _id: 1,
            patientId: 1,
            providerId: 1,
            date: 1,
            time: 1,
            type: 1,
            reason: 1,
            status: 1
          },
          limit: 200
        },
        context
      );

      this.extractedData.appointments = appointments.map(a => ({
        id: a._id,
        patientId: a.patientId,
        providerId: a.providerId,
        date: a.date,
        time: a.time,
        type: a.type || 'Consultation',
        reason: a.reason,
        status: a.status
      }));

      console.log(`   ✅ Extracted ${this.extractedData.appointments.length} appointments`);
      return this.extractedData.appointments;
    } catch (error) {
      console.error('❌ Failed to extract appointments:', error);
      return [];
    }
  }

  /**
   * Extract medication names and dosages
   */
  async extractMedications(practiceId = 'stanford') {
    try {
      console.log('💊 Extracting medication data...');
      
      const context = {
        serviceId: 'data-extractor-service',
        operation: 'extract-medications',
        practiceId: practiceId
      };

      const medications = await SecureDataAccess.query(
        'medications',
        { status: 'active' },
        {
          projection: {
            _id: 1,
            patientId: 1,
            name: 1,
            dosage: 1,
            frequency: 1,
            startDate: 1,
            prescribedBy: 1
          },
          limit: 500
        },
        context
      );

      // Also get unique medication names
      const uniqueMeds = [...new Set(medications.map(m => m.name))].filter(Boolean);
      
      this.extractedData.medications = {
        all: medications,
        unique: uniqueMeds,
        byPatient: {}
      };

      // Group by patient for easier query generation
      medications.forEach(med => {
        if (!this.extractedData.medications.byPatient[med.patientId]) {
          this.extractedData.medications.byPatient[med.patientId] = [];
        }
        this.extractedData.medications.byPatient[med.patientId].push(med.name);
      });

      console.log(`   ✅ Extracted ${medications.length} medications (${uniqueMeds.length} unique)`);
      return this.extractedData.medications;
    } catch (error) {
      console.error('❌ Failed to extract medications:', error);
      return { all: [], unique: [], byPatient: {} };
    }
  }

  /**
   * Extract diagnoses and conditions
   */
  async extractDiagnoses(practiceId = 'stanford') {
    try {
      console.log('🏥 Extracting diagnosis data...');
      
      const context = {
        serviceId: 'data-extractor-service',
        operation: 'extract-diagnoses',
        practiceId: practiceId
      };

      const diagnoses = await SecureDataAccess.query(
        'diagnoses',
        { status: 'active' },
        {
          projection: {
            _id: 1,
            patientId: 1,
            code: 1,
            description: 1,
            diagnosedDate: 1,
            severity: 1
          },
          limit: 500
        },
        context
      );

      // Get unique conditions
      const uniqueConditions = [...new Set(diagnoses.map(d => d.description))].filter(Boolean);
      
      this.extractedData.diagnoses = {
        all: diagnoses,
        unique: uniqueConditions,
        byPatient: {}
      };

      // Group by patient
      diagnoses.forEach(diag => {
        if (!this.extractedData.diagnoses.byPatient[diag.patientId]) {
          this.extractedData.diagnoses.byPatient[diag.patientId] = [];
        }
        this.extractedData.diagnoses.byPatient[diag.patientId].push(diag.description);
      });

      console.log(`   ✅ Extracted ${diagnoses.length} diagnoses (${uniqueConditions.length} unique)`);
      return this.extractedData.diagnoses;
    } catch (error) {
      console.error('❌ Failed to extract diagnoses:', error);
      return { all: [], unique: [], byPatient: {} };
    }
  }

  /**
   * Extract lab test names and results
   */
  async extractLabTests(practiceId = 'stanford') {
    try {
      console.log('🔬 Extracting lab test data...');
      
      const context = {
        serviceId: 'data-extractor-service',
        operation: 'extract-lab-tests',
        practiceId: practiceId
      };

      const labResults = await SecureDataAccess.query(
        'lab_results',
        {},
        {
          projection: {
            _id: 1,
            patientId: 1,
            testName: 1,
            testType: 1,
            result: 1,
            unit: 1,
            testDate: 1,
            orderedBy: 1
          },
          limit: 500
        },
        context
      );

      // Get unique test types
      const uniqueTests = [...new Set(labResults.map(l => l.testName))].filter(Boolean);
      
      this.extractedData.labTests = {
        all: labResults,
        unique: uniqueTests,
        byPatient: {}
      };

      // Group by patient
      labResults.forEach(lab => {
        if (!this.extractedData.labTests.byPatient[lab.patientId]) {
          this.extractedData.labTests.byPatient[lab.patientId] = [];
        }
        this.extractedData.labTests.byPatient[lab.patientId].push(lab.testName);
      });

      console.log(`   ✅ Extracted ${labResults.length} lab tests (${uniqueTests.length} unique)`);
      return this.extractedData.labTests;
    } catch (error) {
      console.error('❌ Failed to extract lab tests:', error);
      return { all: [], unique: [], byPatient: {} };
    }
  }

  /**
   * Extract all data for a practice
   */
  async extractAllData(practiceId = 'stanford') {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 EXTRACTING REAL DATA FOR CACHE WARMING');
    console.log('='.repeat(60));
    console.log(`Practice: ${practiceId}\n`);

    await this.initialize();

    // Extract all data types in parallel where possible
    await Promise.all([
      this.extractPatients(practiceId),
      this.extractProviders(practiceId),
      this.extractAppointments(practiceId),
      this.extractMedications(practiceId),
      this.extractDiagnoses(practiceId),
      this.extractLabTests(practiceId)
    ]);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 DATA EXTRACTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Patients: ${this.extractedData.patients.length}`);
    console.log(`✅ Providers: ${this.extractedData.providers.length}`);
    console.log(`✅ Appointments: ${this.extractedData.appointments.length}`);
    console.log(`✅ Medications: ${this.extractedData.medications.all.length} (${this.extractedData.medications.unique.length} unique)`);
    console.log(`✅ Diagnoses: ${this.extractedData.diagnoses.all.length} (${this.extractedData.diagnoses.unique.length} unique)`);
    console.log(`✅ Lab Tests: ${this.extractedData.labTests.all.length} (${this.extractedData.labTests.unique.length} unique)`);
    console.log('='.repeat(60) + '\n');

    return this.extractedData;
  }

  /**
   * Get the extracted data
   */
  getData() {
    return this.extractedData;
  }
}

// Create singleton instance
const dataExtractor = new DataExtractorForCache();

module.exports = dataExtractor;