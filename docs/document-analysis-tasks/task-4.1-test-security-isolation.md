# Task 4.1: Test Security Isolation

## 🛡️ **SECURITY TESTING TASK**
**Phase:** 4 (Testing & Validation)  
**Time Estimate:** 25 minutes  
**Risk Level:** LOW  
**Priority:** HIGH  

## 🎯 **Objective**
Create comprehensive security test suite to validate multi-tenancy isolation, access controls, and document security measures.

## 🗺️ **Test Coverage Areas**
- Multi-tenant data isolation
- Document access control validation
- Authentication and authorization
- File upload security
- Audit trail verification
- Data encryption validation
- API endpoint security

## 📁 **Files to Create**
- `backend/tests/security/documentSecurity.test.js`
- `backend/tests/security/multiTenancy.test.js`
- `backend/tests/security/accessControl.test.js`
- `backend/tests/security/fileUpload.test.js`
- `backend/tests/helpers/securityTestHelper.js`

## 🔧 **Implementation**

### **Step 1: Create Security Test Helper**
```javascript
// backend/tests/helpers/securityTestHelper.js
const request = require('supertest');
const app = require('../../server');
const User = require('../../models/User');
const Practice = require('../../models/Practice');
const Document = require('../../models/Document');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

class SecurityTestHelper {
  static async createTestClinics() {
    // Create two separate practices for isolation testing
    const clinicA = await Practice.create({
      name: 'Test Practice A',
      subdomain: 'test-practice-a',
      country: 'IL',
      settings: {
        language: 'he',
        timezone: 'Asia/Jerusalem'
      }
    });
    
    const clinicB = await Practice.create({
      name: 'Test Practice B', 
      subdomain: 'test-practice-b',
      country: 'US',
      settings: {
        language: 'en',
        timezone: 'America/New_York'
      }
    });
    
    return { clinicA, clinicB };
  }
  
  static async createTestUsers(clinicA, clinicB) {
    // Create users for each practice with different roles
    const userA1 = await User.create({
      email: 'doctor.a@test.com',
      name: 'Dr. A',
      role: 'doctor',
      practiceId: clinicA._id,
      isActive: true
    });
    
    const userA2 = await User.create({
      email: 'nurse.a@test.com', 
      name: 'Nurse A',
      role: 'nurse',
      practiceId: clinicA._id,
      isActive: true
    });
    
    const userB1 = await User.create({
      email: 'doctor.b@test.com',
      name: 'Dr. B', 
      role: 'doctor',
      practiceId: clinicB._id,
      isActive: true
    });
    
    const adminUser = await User.create({
      email: 'admin@test.com',
      name: 'System Admin',
      role: 'admin',
      practiceId: clinicA._id,
      isActive: true
    });
    
    return { userA1, userA2, userB1, adminUser };
  }
  
  static async createTestDocuments(clinicA, clinicB, patientA, patientB) {
    const documentA = await Document.create({
      fileName: 'patient-a-lab-results.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      patientId: patientA._id,
      practiceId: clinicA._id,
      category: 'lab_results',
      isEncrypted: true,
      uploadedBy: 'user-a-id'
    });
    
    const documentB = await Document.create({
      fileName: 'patient-b-prescription.pdf',
      mimeType: 'application/pdf', 
      size: 2048,
      patientId: patientB._id,
      practiceId: clinicB._id,
      category: 'prescription',
      isEncrypted: true,
      uploadedBy: 'user-b-id'
    });
    
    return { documentA, documentB };
  }
  
  static generateAuthToken(user, practice) {
    return jwt.sign(
      {
        userId: user._id,
        practiceId: practice._id,
        role: user.role,
        subdomain: practice.subdomain
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }
  
  static async makeAuthenticatedRequest(method, endpoint, token, data = null) {
    const req = request(app)[method](endpoint)
      .set('Authorization', `Bearer ${token}`);
      
    if (data && (method === 'post' || method === 'put' || method === 'patch')) {
      req.send(data);
    }
    
    return await req;
  }
  
  static async uploadTestFile(endpoint, token, fileName = 'test.pdf', mimeType = 'application/pdf') {
    const fileBuffer = Buffer.from('Mock PDF content');
    
    return await request(app)
      .post(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .attach('document', fileBuffer, fileName)
      .field('mimeType', mimeType);
  }
  
  static async cleanupTestData() {
    // Clean up test data
    await Promise.all([
      User.deleteMany({ email: { $regex: '@test\.com$' } }),
      Practice.deleteMany({ subdomain: { $regex: '^test-practice-' } }),
      Document.deleteMany({ fileName: { $regex: '^test-' } })
    ]);
  }
}

module.exports = SecurityTestHelper;
```

### **Step 2: Multi-Tenancy Tests**
```javascript
// backend/tests/security/multiTenancy.test.js
const SecurityTestHelper = require('../helpers/securityTestHelper');
const Document = require('../../models/Document');
const Patient = require('../../models/Patient');

describe('Multi-Tenancy Security', () => {
  let clinicA, clinicB;
  let userA, userB;
  let tokenA, tokenB;
  let documentA, documentB;
  
  beforeAll(async () => {
    // Setup test environment
    const practices = await SecurityTestHelper.createTestClinics();
    clinicA = practices.clinicA;
    clinicB = practices.clinicB;
    
    const users = await SecurityTestHelper.createTestUsers(clinicA, clinicB);
    userA = users.userA1;
    userB = users.userB1;
    
    tokenA = SecurityTestHelper.generateAuthToken(userA, clinicA);
    tokenB = SecurityTestHelper.generateAuthToken(userB, clinicB);
    
    // Create test patients and documents
    const patientA = await Patient.create({ name: 'Patient A', practiceId: clinicA._id });
    const patientB = await Patient.create({ name: 'Patient B', practiceId: clinicB._id });
    
    const docs = await SecurityTestHelper.createTestDocuments(
      clinicA, clinicB, patientA, patientB
    );
    documentA = docs.documentA;
    documentB = docs.documentB;
  });
  
  afterAll(async () => {
    await SecurityTestHelper.cleanupTestData();
  });
  
  describe('Document Access Isolation', () => {
    test('should not allow cross-practice document access', async () => {
      // User from Practice A tries to access document from Practice B
      const response = await SecurityTestHelper.makeAuthenticatedRequest(
        'get',
        `/api/documents/${documentB._id}`,
        tokenA
      );
      
      expect(response.status).toBe(404); // Should not find document
      expect(response.body.success).toBe(false);
    });
    
    test('should allow access to own practice documents', async () => {
      const response = await SecurityTestHelper.makeAuthenticatedRequest(
        'get', 
        `/api/documents/${documentA._id}`,
        tokenA
      );
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.document._id).toBe(documentA._id.toString());
    });
    
    test('should not list documents from other practices', async () => {
      const response = await SecurityTestHelper.makeAuthenticatedRequest(
        'get',
        '/api/documents',
        tokenA
      );
      
      expect(response.status).toBe(200);
      const documents = response.body.documents || [];
      
      // Should only see documents from own practice
      documents.forEach(doc => {
        expect(doc.practiceId).toBe(clinicA._id.toString());
      });
    });
  });
  
  describe('Patient Data Isolation', () => {
    test('should not access patients from other practices', async () => {
      // Try to list all patients - should only see own practice's
      const response = await SecurityTestHelper.makeAuthenticatedRequest(
        'get',
        '/api/patients',
        tokenA
      );
      
      expect(response.status).toBe(200);
      const patients = response.body.patients || [];
      
      patients.forEach(patient => {
        expect(patient.practiceId).toBe(clinicA._id.toString());
      });
    });
    
    test('should not create patients in other practices', async () => {
      const patientData = {
        name: 'Test Patient',
        email: 'test@example.com',
        practiceId: clinicB._id // Try to create in wrong practice
      };
      
      const response = await SecurityTestHelper.makeAuthenticatedRequest(
        'post',
        '/api/patients',
        tokenA,
        patientData
      );
      
      // Should either reject or force correct practice ID
      if (response.status === 201) {
        expect(response.body.patient.practiceId).toBe(clinicA._id.toString());
      } else {
        expect(response.status).toBe(403);
      }
    });
  });
  
  describe('Database Model Isolation', () => {
    test('should use practice-specific models', async () => {
      // This test verifies that the practice context middleware is working
      const response = await SecurityTestHelper.makeAuthenticatedRequest(
        'get',
        '/api/debug/practice-context',
        tokenA
      );
      
      expect(response.body.practiceId).toBe(clinicA._id.toString());
      expect(response.body.subdomain).toBe('test-practice-a');
      expect(response.body.hasModels).toBe(true);
    });
  });
  
  describe('Session Isolation', () => {
    test('should maintain separate sessions per practice', async () => {
      // Start chat session in Practice A
      const sessionIdA = 'test-session-a';
      const chatResponseA = await SecurityTestHelper.makeAuthenticatedRequest(
        'post',
        '/api/agent/chat',
        tokenA,
        { message: 'Hello from Practice A', sessionId: sessionIdA }
      );
      
      // Start chat session in Practice B with same session ID
      const sessionIdB = 'test-session-a'; // Same ID but different practice
      const chatResponseB = await SecurityTestHelper.makeAuthenticatedRequest(
        'post',
        '/api/agent/chat', 
        tokenB,
        { message: 'Hello from Practice B', sessionId: sessionIdB }
      );
      
      // Both should succeed but be separate sessions
      expect(chatResponseA.status).toBe(200);
      expect(chatResponseB.status).toBe(200);
      
      // Sessions should be isolated (different conversation context)
      expect(chatResponseA.body.sessionId).toContain('test-practice-a');
      expect(chatResponseB.body.sessionId).toContain('test-practice-b');
    });
  });
});
```

### **Step 3: Document Access Control Tests**
```javascript
// backend/tests/security/accessControl.test.js
const SecurityTestHelper = require('../helpers/securityTestHelper');
const DocumentPermission = require('../../models/DocumentPermission');

describe('Document Access Control', () => {
  let practice, doctor, nurse, admin;
  let doctorToken, nurseToken, adminToken;
  let testDocument;
  
  beforeAll(async () => {
    const { clinicA } = await SecurityTestHelper.createTestClinics();
    practice = clinicA;
    
    const users = await SecurityTestHelper.createTestUsers(practice, null);
    doctor = users.userA1;
    nurse = users.userA2; 
    admin = users.adminUser;
    
    doctorToken = SecurityTestHelper.generateAuthToken(doctor, practice);
    nurseToken = SecurityTestHelper.generateAuthToken(nurse, practice);
    adminToken = SecurityTestHelper.generateAuthToken(admin, practice);
    
    // Create test document
    const patient = await Patient.create({ name: 'Test Patient', practiceId: practice._id });
    const { documentA } = await SecurityTestHelper.createTestDocuments(
      practice, null, patient, null
    );
    testDocument = documentA;
  });
  
  afterAll(async () => {
    await SecurityTestHelper.cleanupTestData();
  });
  
  describe('Role-Based Access', () => {
    test('doctors should have full document access', async () => {
      const response = await SecurityTestHelper.makeAuthenticatedRequest(
        'get',
        `/api/documents/${testDocument._id}`,
        doctorToken
      );
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    test('nurses should have limited document access', async () => {
      // Nurses can view but may not be able to delete
      const viewResponse = await SecurityTestHelper.makeAuthenticatedRequest(
        'get',
        `/api/documents/${testDocument._id}`,
        nurseToken
      );
      
      expect(viewResponse.status).toBe(200);
      
      const deleteResponse = await SecurityTestHelper.makeAuthenticatedRequest(
        'delete',
        `/api/documents/${testDocument._id}`,
        nurseToken
      );
      
      expect(deleteResponse.status).toBe(403); // Forbidden
    });
    
    test('admin should have full access', async () => {
      const response = await SecurityTestHelper.makeAuthenticatedRequest(
        'delete',
        `/api/documents/${testDocument._id}`,
        adminToken
      );
      
      expect([200, 204]).toContain(response.status);
    });
  });
  
  describe('Permission Management', () => {
    test('should grant specific permissions', async () => {
      // Create specific permission for nurse
      const permission = await DocumentPermission.create({
        documentId: testDocument._id,
        practiceId: practice._id,
        userId: nurse._id,
        patientId: testDocument.patientId,
        permissions: {
          canView: true,
          canDownload: true,
          canModify: false,
          canDelete: false
        },
        grantedBy: admin._id
      });
      
      // Test that permissions are enforced
      const viewResponse = await SecurityTestHelper.makeAuthenticatedRequest(
        'get',
        `/api/documents/${testDocument._id}`,
        nurseToken
      );
      
      expect(viewResponse.status).toBe(200);
      
      const modifyResponse = await SecurityTestHelper.makeAuthenticatedRequest(
        'put',
        `/api/documents/${testDocument._id}`,
        nurseToken,
        { category: 'updated' }
      );
      
      expect(modifyResponse.status).toBe(403);
    });
    
    test('should enforce time-based permissions', async () => {
      // Create time-limited permission
      const expiredPermission = await DocumentPermission.create({
        documentId: testDocument._id,
        practiceId: practice._id,
        userId: nurse._id,
        patientId: testDocument.patientId,
        permissions: {
          canView: true
        },
        constraints: {
          timeLimit: {
            startDate: new Date(Date.now() - 3600000), // 1 hour ago
            endDate: new Date(Date.now() - 1800000) // 30 minutes ago (expired)
          }
        },
        grantedBy: admin._id
      });
      
      const response = await SecurityTestHelper.makeAuthenticatedRequest(
        'get',
        `/api/documents/${testDocument._id}`,
        nurseToken
      );
      
      expect(response.status).toBe(403); // Should be denied due to expired permission
    });
  });
  
  describe('Emergency Access', () => {
    test('should grant emergency access with justification', async () => {
      const emergencyResponse = await SecurityTestHelper.makeAuthenticatedRequest(
        'post',
        `/api/documents/${testDocument._id}/emergency-access`,
        nurseToken,
        {
          justification: 'Patient in emergency situation requiring immediate access to medical history for treatment decisions'
        }
      );
      
      expect(emergencyResponse.status).toBe(200);
      expect(emergencyResponse.body.success).toBe(true);
      
      // Should now be able to access the document
      const accessResponse = await SecurityTestHelper.makeAuthenticatedRequest(
        'get',
        `/api/documents/${testDocument._id}`,
        nurseToken
      );
      
      expect(accessResponse.status).toBe(200);
    });
    
    test('should reject emergency access without proper justification', async () => {
      const response = await SecurityTestHelper.makeAuthenticatedRequest(
        'post',
        `/api/documents/${testDocument._id}/emergency-access`,
        nurseToken,
        { justification: 'Need access' } // Too short
      );
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
```

### **Step 4: File Upload Security Tests**
```javascript
// backend/tests/security/fileUpload.test.js
const SecurityTestHelper = require('../helpers/securityTestHelper');

describe('File Upload Security', () => {
  let practice, user, token;
  let patientId;
  
  beforeAll(async () => {
    const { clinicA } = await SecurityTestHelper.createTestClinics();
    practice = clinicA;
    
    const { userA1 } = await SecurityTestHelper.createTestUsers(practice, null);
    user = userA1;
    token = SecurityTestHelper.generateAuthToken(user, practice);
    
    // Create test patient
    const patient = await Patient.create({ name: 'Test Patient', practiceId: practice._id });
    patientId = patient._id;
  });
  
  afterAll(async () => {
    await SecurityTestHelper.cleanupTestData();
  });
  
  describe('File Type Validation', () => {
    test('should accept valid medical document types', async () => {
      const response = await SecurityTestHelper.uploadTestFile(
        `/api/documents/upload/${patientId}`,
        token,
        'test-lab-results.pdf',
        'application/pdf'
      );
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    test('should reject executable files', async () => {
      const executableBuffer = Buffer.from('MZ\x00\x00'); // Executable header
      
      const response = await request(app)
        .post(`/api/documents/upload/${patientId}`)
        .set('Authorization', `Bearer ${token}`)
        .attach('document', executableBuffer, 'malware.exe');
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.validation.issues.errors).toContain(
        expect.stringContaining('Dangerous file extension')
      );
    });
    
    test('should reject files with suspicious content', async () => {
      const maliciousBuffer = Buffer.from('<script>alert("xss")</script>');
      
      const response = await request(app)
        .post(`/api/documents/upload/${patientId}`)
        .set('Authorization', `Bearer ${token}`)
        .attach('document', maliciousBuffer, 'suspicious.txt');
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    test('should enforce file size limits', async () => {
      const largeBuffer = Buffer.alloc(200 * 1024 * 1024); // 200MB
      
      const response = await request(app)
        .post(`/api/documents/upload/${patientId}`)
        .set('Authorization', `Bearer ${token}`)
        .attach('document', largeBuffer, 'huge-file.pdf');
      
      expect(response.status).toBe(400);
      expect(response.body.validation.issues.errors).toContain(
        expect.stringContaining('File too large')
      );
    });
  });
  
  describe('Upload Authentication', () => {
    test('should reject uploads without authentication', async () => {
      const response = await SecurityTestHelper.uploadTestFile(
        `/api/documents/upload/${patientId}`,
        'invalid-token'
      );
      
      expect(response.status).toBe(401);
    });
    
    test('should reject uploads to wrong patient', async () => {
      // Create patient in different practice
      const otherClinic = await Practice.create({
        name: 'Other Practice',
        subdomain: 'other-practice'
      });
      
      const otherPatient = await Patient.create({
        name: 'Other Patient',
        practiceId: otherClinic._id
      });
      
      const response = await SecurityTestHelper.uploadTestFile(
        `/api/documents/upload/${otherPatient._id}`,
        token
      );
      
      expect(response.status).toBe(403);
    });
  });
});
```

### **Step 5: Test Runner Script**
```javascript
// backend/scripts/run-security-tests.js
const { execSync } = require('child_process');
const path = require('path');

// Security test configuration
const securityTests = [
  'tests/security/multiTenancy.test.js',
  'tests/security/accessControl.test.js', 
  'tests/security/fileUpload.test.js'
];

console.log('🛡️ Running Security Test Suite...');
console.log('=' .repeat(50));

// Set test environment
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI;

let allTestsPassed = true;
const results = [];

for (const testFile of securityTests) {
  console.log(`\n📄 Running ${testFile}...`);
  
  try {
    const output = execSync(`npm test -- ${testFile}`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    console.log('✅ PASSED');
    results.push({ test: testFile, status: 'PASSED' });
  } catch (error) {
    console.log('❌ FAILED');
    console.log(error.stdout);
    results.push({ test: testFile, status: 'FAILED', error: error.message });
    allTestsPassed = false;
  }
}

// Summary
console.log('\n' + '=' .repeat(50));
console.log('📊 SECURITY TEST SUMMARY');
console.log('=' .repeat(50));

results.forEach(result => {
  const status = result.status === 'PASSED' ? '✅' : '❌';
  console.log(`${status} ${result.test}`);
});

const passed = results.filter(r => r.status === 'PASSED').length;
const total = results.length;

console.log(`\n📊 Results: ${passed}/${total} tests passed`);

if (!allTestsPassed) {
  console.log('\n🚨 SECURITY VULNERABILITIES DETECTED!');
  console.log('Please fix the failing tests before deploying.');
  process.exit(1);
} else {
  console.log('\n✅ All security tests passed!');
  process.exit(0);
}
```

## 🧪 **Running the Tests**
```bash
# Run all security tests
npm run test:security

# Run specific test file
npm test tests/security/multiTenancy.test.js

# Run with coverage
npm test -- --coverage tests/security/
```

## ✅ **Success Criteria**
- [ ] Multi-tenant isolation verified
- [ ] Access control properly enforced
- [ ] File upload security validated
- [ ] Cross-practice access blocked
- [ ] Emergency access working
- [ ] All security tests passing

## 🔄 **Next Task**
Proceed to: **Task 4.2:** Test OCR Accuracy

## 📝 **Security Testing Notes**
- Run security tests before every deployment
- Update tests when new security features are added
- Monitor test results in CI/CD pipeline
- Regular security audit with external tools