/**
 * External API Integration Tests
 * Comprehensive integration tests for external healthcare API services
 * Tests real API connections, webhook processing, and error handling.
 * 
 * Test Coverage:
 * - Drug Information Service (OpenFDA)
 * - Provider Directory Service (CMS + BetterDoctor)
 * - Clinical Research Service (NIH + PubMed)
 * - Regulatory Compliance Service (FDA + CMS)
 * - Webhook Management Service
 * - External API Gateway
 */

const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');
const crypto = require('crypto');

// Import services for direct testing
const drugInformationService = require('../../services/drugInformationService');
const providerDirectoryService = require('../../services/providerDirectoryService');
const clinicalResearchService = require('../../services/clinicalResearchService');
const regulatoryComplianceService = require('../../services/regulatoryComplianceService');
const webhookManagementService = require('../../services/webhookManagementService');
const externalApiGateway = require('../../services/externalApiGatewayService');

// Test configuration
const TEST_CONFIG = {
  timeout: 30000, // 30 seconds for API calls
  skipRealAPI: process.env.SKIP_REAL_API_TESTS === 'true',
  testWebhooks: process.env.TEST_WEBHOOKS === 'true'
};

describe('External API Integration Tests', () => {
  let authToken;
  let testClinicId;
  let testUserId;

  beforeAll(async () => {
    // Initialize services
    await drugInformationService.initialize();
    await providerDirectoryService.initialize();
    await clinicalResearchService.initialize();
    await regulatoryComplianceService.initialize();
    await webhookManagementService.initialize();
    
    // Create test user and get auth token
    const authResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword'
      });
    
    authToken = authResponse.body.token;
    testUserId = authResponse.body.user.id;
    testClinicId = authResponse.body.user.practiceId;
  }, TEST_CONFIG.timeout);

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Drug Information Service Tests', () => {
    test('should search drugs via FDA API', async () => {
      if (TEST_CONFIG.skipRealAPI) {
        console.log('Skipping real API test - SKIP_REAL_API_TESTS=true');
        return;
      }

      const response = await request(app)
        .get('/api/external/drugs/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          q: 'aspirin',
          limit: 5
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('drugs');
      expect(Array.isArray(response.body.data.drugs)).toBe(true);
      
      if (response.body.data.drugs.length > 0) {
        const drug = response.body.data.drugs[0];
        expect(drug).toHaveProperty('name');
        expect(drug).toHaveProperty('ndc');
      }
    }, TEST_CONFIG.timeout);

    test('should check drug safety', async () => {
      if (TEST_CONFIG.skipRealAPI) return;

      const response = await request(app)
        .post('/api/external/drugs/safety-check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          drugName: 'acetaminophen'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('safetyProfile');
      expect(response.body.data).toHaveProperty('adverseEvents');
    }, TEST_CONFIG.timeout);

    test('should check drug interactions', async () => {
      if (TEST_CONFIG.skipRealAPI) return;

      const response = await request(app)
        .post('/api/external/drugs/interaction-check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          medications: ['aspirin', 'warfarin']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('interactions');
      expect(Array.isArray(response.body.data.interactions)).toBe(true);
    }, TEST_CONFIG.timeout);

    test('should validate prescription', async () => {
      const response = await request(app)
        .post('/api/external/drugs/validate-prescription')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          drugName: 'amoxicillin',
          dosage: '500mg twice daily',
          existingMedications: ['lisinopril']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isValid');
      expect(response.body.data).toHaveProperty('warnings');
      expect(response.body.data).toHaveProperty('interactions');
    });

    test('should handle invalid drug search', async () => {
      const response = await request(app)
        .get('/api/external/drugs/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          q: 'x' // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Provider Directory Service Tests', () => {
    test('should search healthcare providers', async () => {
      if (TEST_CONFIG.skipRealAPI) return;

      const response = await request(app)
        .get('/api/external/providers/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          specialty: 'cardiology',
          location: 'California',
          limit: 10
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('providers');
      expect(Array.isArray(response.body.data.providers)).toBe(true);
    }, TEST_CONFIG.timeout);

    test('should get provider by NPI', async () => {
      if (TEST_CONFIG.skipRealAPI) return;

      // Use a valid test NPI (this is a public test NPI)
      const testNPI = '1234567890';
      
      const response = await request(app)
        .get(`/api/external/providers/${testNPI}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Expect either 200 (found) or 404 (not found) - both are valid responses
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('npi');
      }
    }, TEST_CONFIG.timeout);

    test('should verify insurance network', async () => {
      const response = await request(app)
        .post('/api/external/providers/verify-network')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          providerNPI: '1234567890',
          insurancePlan: 'Aetna HMO'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isInNetwork');
      expect(response.body.data).toHaveProperty('confidence');
    });

    test('should get medical specialties', async () => {
      const response = await request(app)
        .get('/api/external/providers/specialties')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('specialties');
      expect(Array.isArray(response.body.data.specialties)).toBe(true);
    });

    test('should handle invalid NPI format', async () => {
      const response = await request(app)
        .get('/api/external/providers/invalid-npi')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Clinical Research Service Tests', () => {
    test('should search clinical trials', async () => {
      if (TEST_CONFIG.skipRealAPI) return;

      const response = await request(app)
        .get('/api/external/research/clinical-trials')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          condition: 'diabetes',
          phase: 'PHASE3',
          limit: 5
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('trials');
      expect(Array.isArray(response.body.data.trials)).toBe(true);
    }, TEST_CONFIG.timeout);

    test('should match patient to trials', async () => {
      const response = await request(app)
        .post('/api/external/research/match-patient')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: 'test-patient-123',
          condition: 'hypertension',
          age: 45,
          gender: 'male',
          location: 'California'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('matches');
      expect(Array.isArray(response.body.data.matches)).toBe(true);
    });

    test('should search medical literature', async () => {
      if (TEST_CONFIG.skipRealAPI) return;

      const response = await request(app)
        .get('/api/external/research/literature')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          query: 'covid-19 treatment',
          limit: 5
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('articles');
      expect(Array.isArray(response.body.data.articles)).toBe(true);
    }, TEST_CONFIG.timeout);
  });

  describe('Regulatory Compliance Service Tests', () => {
    test('should get FDA safety alerts', async () => {
      if (TEST_CONFIG.skipRealAPI) return;

      const response = await request(app)
        .get('/api/external/compliance/fda-alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          alertType: 'drug_recalls',
          limit: 10
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('alerts');
      expect(Array.isArray(response.body.data.alerts)).toBe(true);
    }, TEST_CONFIG.timeout);

    test('should generate compliance report', async () => {
      const response = await request(app)
        .post('/api/external/compliance/generate-report')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          organizationId: testClinicId,
          frameworks: ['HIPAA', 'HITECH'],
          includeRecommendations: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('report');
      expect(response.body.data.report).toHaveProperty('score');
      expect(response.body.data.report).toHaveProperty('frameworks');
    });
  });

  describe('External API Gateway Tests', () => {
    test('should get API health status', async () => {
      const response = await request(app)
        .get('/api/external/health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('providers');
    });

    test('should test connection to specific provider', async () => {
      const response = await request(app)
        .post('/api/external/test-connection/fda')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('responseTime');
    });

    test('should clear API cache', async () => {
      const response = await request(app)
        .delete('/api/external/cache')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Webhook Tests', () => {
    const createHMACSignature = (payload, secret) => {
      return crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
    };

    test('should process FDA drug alert webhook', async () => {
      if (!TEST_CONFIG.testWebhooks) {
        console.log('Skipping webhook test - TEST_WEBHOOKS not enabled');
        return;
      }

      const payload = {
        alertType: 'recall',
        drugName: 'Test Drug',
        ndc: '12345678901',
        severity: 'Class II',
        description: 'Test recall alert',
        recallNumber: 'TEST-2025-001'
      };

      const secret = 'test-webhook-secret';
      const signature = createHMACSignature(payload, secret);

      const response = await request(app)
        .post('/api/webhooks/fda/drug-alerts')
        .set('X-Hub-Signature-256', `sha256=${signature}`)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.alertId).toBeDefined();
    });

    test('should reject webhook with invalid signature', async () => {
      const payload = {
        alertType: 'recall',
        drugName: 'Test Drug',
        severity: 'Class II'
      };

      const response = await request(app)
        .post('/api/webhooks/fda/drug-alerts')
        .set('X-Hub-Signature-256', 'sha256=invalid-signature')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.code).toBe('INVALID_SIGNATURE');
    });

    test('should reject webhook without signature', async () => {
      const payload = {
        alertType: 'recall',
        drugName: 'Test Drug'
      };

      const response = await request(app)
        .post('/api/webhooks/fda/drug-alerts')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('MISSING_SIGNATURE');
    });

    test('should get webhook status', async () => {
      const response = await request(app)
        .get('/api/webhooks/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('processingStats');
    });

    test('should get webhook event history', async () => {
      const response = await request(app)
        .get('/api/webhooks/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          limit: 10
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('events');
      expect(Array.isArray(response.body.data.events)).toBe(true);
    });
  });

  describe('Service Integration Tests', () => {
    test('should handle service failures gracefully', async () => {
      // Test circuit breaker behavior
      const response = await request(app)
        .get('/api/external/drugs/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          q: 'test-drug-that-should-fail'
        });

      // Should either succeed or fail gracefully
      expect([200, 500, 503]).toContain(response.status);
      
      if (response.status !== 200) {
        expect(response.body.error).toBeDefined();
      }
    });

    test('should respect rate limits', async () => {
      // Make multiple rapid requests to test rate limiting
      const requests = Array(10).fill().map(() => 
        request(app)
          .get('/api/external/health')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      
      // All should either succeed or be rate limited
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });

    test('should validate authentication for all endpoints', async () => {
      const response = await request(app)
        .get('/api/external/drugs/search')
        .query({ q: 'test' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle malformed JSON in webhook', async () => {
      const response = await request(app)
        .post('/api/webhooks/fda/drug-alerts')
        .set('X-Hub-Signature-256', 'sha256=test')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_JSON');
    });

    test('should validate required parameters', async () => {
      const response = await request(app)
        .post('/api/external/drugs/safety-check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}); // Missing drugName

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.details).toBeDefined();
    });

    test('should handle service unavailable scenarios', async () => {
      // This test simulates service unavailability
      const response = await request(app)
        .post('/api/external/test-connection/nonexistent-provider')
        .set('Authorization', `Bearer ${authToken}`);

      expect([404, 500]).toContain(response.status);
      expect(response.body.error).toBeDefined();
    });
  });
});

// Helper function to run tests conditionally
function describeIf(condition, ...args) {
  return condition ? describe(...args) : describe.skip(...args);
}

// Performance tests (only run if enabled)
describeIf(process.env.RUN_PERFORMANCE_TESTS === 'true', 'Performance Tests', () => {
  test('should complete drug search within acceptable time', async () => {
    const startTime = Date.now();
    
    const response = await request(app)
      .get('/api/external/drugs/search')
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        q: 'aspirin',
        limit: 10
      });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(response.status).toBe(200);
    expect(responseTime).toBeLessThan(5000); // Should complete within 5 seconds
  }, 10000);

  test('should handle concurrent requests', async () => {
    const concurrentRequests = 20;
    const promises = [];

    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        request(app)
          .get('/api/external/health')
          .set('Authorization', `Bearer ${authToken}`)
      );
    }

    const responses = await Promise.all(promises);
    
    // Most should succeed, some might be rate limited
    const successCount = responses.filter(r => r.status === 200).length;
    expect(successCount).toBeGreaterThan(concurrentRequests * 0.5); // At least 50% should succeed
  });
});