#!/usr/bin/env node
/**
 * Regenerate All Service Keys Script
 * Uses ProductionKMS to generate new encrypted keys for all services
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Services that need API keys (based on existing key files)
const SERVICES = [
  'ACCESSREQUESTSERVICE',
  'ADMIN_CHECK_SERVICE',
  'ADMIN_INSERT_SERVICE',
  'AGENTCAPABILITYMANAGER',
  'AGENTSERVICECLAUDE',
  'AGENTSERVICECLAUDE2025',
  'AGENTSERVICECLAUDEDYNAMIC',
  'AGENTSERVICECLAUDEPURE',
  'AGENTSERVICECLAUDESELFAWARE',
  'AGENTSERVICECLAUDESMARTSELECTOR',
  'AGENTSERVICECLAUDETWOSTAGE',
  'AGENTSERVICECLAUDEULTIMATE',
  'AGENTSERVICECLAUDEV2',
  'AGENTSERVICEEXTENDED',
  'AGENTSERVICEOAUTH',
  'AGENTSERVICESMART',
  'AGENTSERVICEV3',
  'AGENTSERVICEV4',
  'AGENTSERVICEV4_PHASE1',
  'AGENTSERVICEWRAPPER',
  'AGENT_SERVICE_CLAUDE',
  'AGENT_SERVICE_V4',
  'AGENT_SERVICE_WRAPPER',
  'AISECURITYWRAPPER',
  'ALLERGYCHECKER',
  'APIVERSIONINGSERVICE',
  'API_VERSIONING_SERVICE',
  'APPOINTMENTS_API',
  'AUDITLOG',
  'AUTHAISERVICE',
  'AUTH_AI_SERVICE',
  'AUTOMATION_OPPORTUNITY_SERVICE',
  'BAAMANAGEMENTSERVICE',
  'BACKUPAIPROVIDERSERVICE',
  'BACKUPSERVICE',
  'BACKUP_SERVICE',
  'BATCHPROCESSOR',
  'BATCHRESULTSWORKER',
  'BATCH_RESULTS_WORKER',
  'BILLINGSERVICE',
  'BILLING_SERVICE',
  'BLUE_BUTTON_OAUTH_SERVICE',
  'BOTTLENECK_DETECTOR_SERVICE',
  'BREACHNOTIFICATIONSERVICE',
  'BROAD_SEARCH_SERVICE',
  'BULK_COMMUNICATION_SERVICE',
  'CALENDAR_SYNC_SERVICE',
  'CHALLENGER_SERVICE',
  'CHATSERVICE',
  'CHAT_MESSAGE_MODEL',
  'CHAT_SERVICE',
  'CIRCUITBREAKERSERVICE',
  'CIRCUIT_BREAKER_SERVICE',
  'CLAUDEBATCHSERVICE',
  'CLAUDECACHEMONITOR',
  'CLAUDEMEMORYSERVICE',
  'CLAUDEOAUTHSERVICE',
  'CLAUDE_BATCH_PROCESSOR',
  'CLAUDE_MEMORY_SERVICE',
  'CLINICALDECISIONSUPPORT',
  'CLINICAUTHSERVICE',
  'CLINICCONTEXTMIDDLEWARE',
  'COMMUNICATIONAUDITSERVICE',
  'COMMUNICATIONAUDIT',
  'COMMUNICATION_AUDIT_SERVICE',
  'COMPLIANCEREPORTINGSERVICE',
  'COMPLIANCESCORECARD',
  'CONSENTMANAGEMENTSERVICE',
  'CONVERSATIONALANALYTICSSERVICE',
  'COSTREPORTINGFUNCTIONS',
  'COSTTRACKINGSERVICE',
  'COST_TRACKING_SERVICE_DB',
  'DATABASECONNECTIONPROVIDER',
  'DATABASEFACTORY',
  'DATABASESECURITYINTERCEPTOR',
  'DATAGOVILJSONPSERVICE',
  'DATARETENTIONSERVICE',
  'DATARETENTION',
  'DATA_SEARCH_SERVICE',
  'DBOPTIMIZATIONSERVICE',
  'DBOPTIMIZATION',
  'DIAGNOSTICSERVICENEW',
  'DISASTERRECOVERYSERVICE',
  'DISASTER_RECOVERY_SERVICE',
  'DOCUMENTANALYSISSERVICE',
  'DOCUMENT_ANALYSIS_SERVICE',
  'DOCUMENT_QUEUE_SERVICE',
  'DOCUMENT_STORAGE_SERVICE',
  'DOC_CHECK_SERVICE',
  'DRUGINTERACTIONSERVICE',
  'DRUG_INFORMATION_SERVICE',
  'EFFICIENCY_ANALYZER_SERVICE',
  'EMAILSERVICE',
  'EMAIL_SERVICE',
  'EMERGENCYPROTOCOLDETECTOR',
  'EMERGENCYRESPONSE',
  'EMERGENCYSTABILIZER',
  'EMERGENCY_RESPONSE',
  'ENCRYPTEDKEYSTORAGE',
  'ENCRYPTIONSERVICE',
  'ENCRYPTION_SERVICE',
  'EXTERNAL_API_GATEWAY_SERVICE',
  'EXTRACT_CHECK_SERVICE',
  'FILECLEANUPSERVICE',
  'FILECLEANUP',
  'FORMULARYSERVICE',
  'FUNCTION_INTERCEPTOR',
  'FUNCTION_OPTIMIZATION_SERVICE',
  'GEMINIMEDICALSERVICE',
  'GEMINISERVICE',
  'GLOBALMODELLOADER',
  'GOOGLESECRETMANAGER',
  'HIPAACOMPLIANCESERVICE',
  'HYBRIDAISERVICE',
  'IMMUTABLEAUDITSERVICE',
  'INCIDENTRESPONSESERVICE',
  'INSURANCESERVICE',
  'INTERACTION_CAPTURE_SERVICE',
  'LABRESULTINTERPRETER',
  'LEARNING_API_GATEWAY',
  'LEARNING_DATA_ADAPTER',
  'LEARNING_ORCHESTRATOR',
  'LEARNING_SERVICES_INITIALIZER',
  'LEARNING_WEB_SOCKET_SERVER',
  'LOADBALANCINGSERVICE',
  'LOAD_BALANCING_SERVICE',
  'MEDICALMODELSERVICE',
  'MEDICALPARSINGSERVICE',
  'MEDICAL_DATA_SERVICE',
  'MEDICAL_PARSING_SERVICE',
  'MEDICATIONPRESCRIPTIONSERVICE',
  'MEMORYOPTIMIZERSERVICE',
  'MEMORYOPTIMIZER',
  'MEMORYVECTORSERVICE',
  'MEMORYVECTOR',
  'MESSAGETEMPLATESERVICE',
  'MFASERVICE',
  'MFA',
  'OTPSERVICE',
  'OTP_SERVICE',
  'PASSWORDLESSAUTHSERVICE',
  'PASSWORDLESSAUTH',
  'PASSWORDLESS_AUTH_SERVICE',
  'PATIENTDELETIONSERVICE',
  'PATIENTDELETION',
  'PATIENTS_ROUTE',
  'PATIENT_MATCHING_SERVICE',
  'PATIENT_PORTAL_MESSAGING_SERVICE',
  'PERFORMANCEOPTIMIZATIONS',
  'PERSONAL_ASSISTANT_SERVICE',
  'PHIANONYMIZATIONSERVICE',
  'POLICYMANAGEMENTSERVICE',
  'PRACTICEAUTH',
  'PRACTICE_AUTH',
  'PRACTICE_AUTH_SERVICE',
  'PRACTICE_DATABASE_MANAGER',
  'PRESCRIPTIONGENERATOR',
  'PRESCRIPTIONMONITORINGSERVICE',
  'PROCEDURALMEMORYSERVICE',
  'PROCEDURALMEMORY',
  'PROCEDURAL_MEMORY_SERVICE',
  'PRODUCTIONKMS',
  'QUEUEMANAGEMENTSERVICE',
  'RBACSERVICE',
  'REDIS_DATA_SYNC',
  'REDIS_PERFORMANCE_TEST',
  'REFERRALMANAGEMENTSERVICE',
  'REMINDERSERVICE',
  'REMINDER_SERVICE',
  'REPORTGENERATOR',
  'REQUESTSIGNINGMIDDLEWARE',
  'REQUESTSIGNING',
  'RETRYSERVICE',
  'RETRY_SERVICE',
  'SECRETSMANAGEMENTSERVICE',
  'SECRETS_MANAGEMENT_SERVICE',
  'SECUREAPIKEYSERVICE',
  'SECURECONFIGSERVICE',
  'SECUREDATAACCESSKMS',
  'SECUREDATAACCESS',
  'SECUREHTTPCLIENT',
  'SECURESESSIONMANAGER',
  'SECURE_DATA_ACCESS',
  'SECURE_SESSION_MANAGER',
  'SECURITYAUDITSERVICE',
  'SECURITYHEADERVALIDATOR',
  'SECURITYMONITORINGSERVICE',
  'SECURITYTRAININGSERVICE',
  'SECURITY_AUDIT_SERVICE',
  'SELF_IMPROVING_MEMORY',
  'SEQUENCE_PATTERN_ENGINE',
  'SERVICEACCOUNTMANAGERSECURE',
  'SERVICEACCOUNTMANAGER',
  'SERVICEACCOUNTROTATION',
  'SERVICEREGISTRY',
  'SERVICE_ACCOUNT_MANAGER',
  'SESSIONFINGERPRINT',
  'SESSIONVALIDATION',
  'SESSION_VALIDATION',
  'SIMPLEKMS',
  'SMSSERVICE',
  'SMS_SERVICE',
  'SOLVER_SERVICE',
  'SYMPTOMANALYZER',
  'TEMPORAL_PATTERN_ENGINE',
  'TEST_QUERY_SERVICE',
  'TEST_SERVICE',
  'THREATDETECTIONMIDDLEWARE',
  'THREATDETECTIONSERVICE',
  'THREAT_DETECTION_SERVICE',
  'TRACINGSERVICE',
  'TRACING_SERVICE',
  'TRANSLATIONSERVICE',
  'TREATMENTRECOMMENDER',
  'USER_MEMORY_SERVICE',
  'VENDORRISKSERVICE',
  'VITALSIGNSANALYZER',
  'WEBHOOK_MANAGEMENT_SERVICE',
  'WORKFLOWENGINE',
  'WORKFLOW_ENGINE',
  'WORKFLOW_PREDICTOR_SERVICE',
  'ZEROKNOWLEDGEAUTHSERVICE',
  'ZEROTRUSTSERVICE',
  'ZEROTRUST',
  'ZERO_KNOWLEDGE_AUTH_SERVICE'
];

// External API keys
const EXTERNAL_KEYS = [
  'ANTHROPIC_API_KEY',
  'CLAUDE_API_KEY',
  'SENDGRID_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'BLUEBUTTON_CLIENT_ID',
  'BLUEBUTTON_CLIENT_SECRET',
  'BLUE_BUTTON_CLIENT_ID',
  'BLUE_BUTTON_CLIENT_SECRET',
  'GITHUB_PERSONAL_ACCESS_TOKEN'
];

// Encryption keys
const ENCRYPTION_KEYS = [
  'SESSION_ENCRYPTION_KEY',
  'DOCUMENT_ENCRYPTION_KEY',
  'PHI_ENCRYPTION_KEY',
  'PII_ENCRYPTION_KEY',
  'AUDIT_ENCRYPTION_KEY',
  'BACKUP_ENCRYPTION_KEY'
];

// MongoDB credentials
const MONGODB_KEYS = [
  'MONGODB_ADMIN_USERNAME',
  'MONGODB_ADMIN_PASSWORD',
  'MONGODB_APP_USERNAME',
  'MONGODB_APP_PASSWORD'
];

async function regenerateKeys() {
  console.log('🔐 Service Key Regeneration Script');
  console.log('=' .repeat(50));
  
  // Load ProductionKMS
  const productionKMS = require('../services/productionKMS.js');
  
  console.log('\n📡 Initializing ProductionKMS...');
  await productionKMS.initialize();
  console.log('✅ KMS initialized\n');
  
  const keysDir = path.join(__dirname, '../.kms/keys');
  await fs.mkdir(keysDir, { recursive: true });
  
  let generated = 0;
  let failed = 0;
  
  // Generate service keys
  console.log(`🔄 Generating ${SERVICES.length} service keys...`);
  for (const service of SERVICES) {
    try {
      const keyName = `SERVICE_${service}_KEY`;
      const keyValue = generateSecureKey();
      
      // Encrypt the key
      const encrypted = await productionKMS.encrypt(keyValue, `key-${keyName}`);
      
      // Save to file
      const keyFile = path.join(keysDir, `${keyName}.json`);
      await fs.writeFile(keyFile, JSON.stringify(encrypted, null, 2));
      
      generated++;
      if (generated % 50 === 0) {
        process.stdout.write(`\r  Progress: ${generated}/${SERVICES.length}`);
      }
    } catch (error) {
      failed++;
      console.log(`\n  ⚠️  Failed to generate ${service}: ${error.message}`);
    }
  }
  console.log(`\r  ✅ Generated ${generated} service keys${failed > 0 ? ` (${failed} failed)` : ''}`);
  
  // Generate external API key placeholders
  console.log(`\n🔄 Creating ${EXTERNAL_KEYS.length} external API key placeholders...`);
  for (const keyName of EXTERNAL_KEYS) {
    try {
      const keyValue = generateSecureKey(); // Placeholder - user needs to update
      const encrypted = await productionKMS.encrypt(keyValue, `key-${keyName}`);
      const keyFile = path.join(keysDir, `${keyName}.json`);
      await fs.writeFile(keyFile, JSON.stringify(encrypted, null, 2));
      generated++;
    } catch (error) {
      console.log(`  ⚠️  Failed to create ${keyName}: ${error.message}`);
    }
  }
  console.log(`  ✅ Created ${EXTERNAL_KEYS.length} external API placeholders`);
  
  // Generate encryption keys
  console.log(`\n🔄 Generating ${ENCRYPTION_KEYS.length} encryption keys...`);
  for (const keyName of ENCRYPTION_KEYS) {
    try {
      // Generate 32-byte encryption key
      const keyValue = crypto.randomBytes(32).toString('base64');
      const encrypted = await productionKMS.encrypt(keyValue, `key-${keyName}`);
      const keyFile = path.join(keysDir, `${keyName}.json`);
      await fs.writeFile(keyFile, JSON.stringify(encrypted, null, 2));
      generated++;
    } catch (error) {
      console.log(`  ⚠️  Failed to generate ${keyName}: ${error.message}`);
    }
  }
  console.log(`  ✅ Generated ${ENCRYPTION_KEYS.length} encryption keys`);
  
  // Generate MongoDB credential placeholders
  console.log(`\n🔄 Creating MongoDB credential placeholders...`);
  const mongodbCreds = {
    'MONGODB_ADMIN_USERNAME': 'intellicare_admin',
    'MONGODB_ADMIN_PASSWORD': generateSecurePassword(32),
    'MONGODB_APP_USERNAME': 'intellicare_app',
    'MONGODB_APP_PASSWORD': generateSecurePassword(32)
  };
  
  for (const [keyName, value] of Object.entries(mongodbCreds)) {
    try {
      const encrypted = await productionKMS.encrypt(value, `key-${keyName}`);
      const keyFile = path.join(keysDir, `${keyName}.json`);
      await fs.writeFile(keyFile, JSON.stringify(encrypted, null, 2));
      generated++;
    } catch (error) {
      console.log(`  ⚠️  Failed to create ${keyName}: ${error.message}`);
    }
  }
  console.log(`  ✅ Created MongoDB credentials`);
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ Key Regeneration Complete!');
  console.log(`   Total keys generated: ${generated}`);
  console.log(`   Keys directory: ${keysDir}`);
  
  console.log('\n⚠️  IMPORTANT NOTES:');
  console.log('   1. External API keys (Anthropic, SendGrid, etc.) are placeholders');
  console.log('      You MUST update them with real values in the KMS files');
  console.log('   2. MongoDB credentials are auto-generated');
  console.log('      Update them to match your MongoDB setup if needed');
  console.log('   3. Backup these keys before restarting the server');
  console.log('\n🚀 You can now start the server with: npm run dev');
}

function generateSecureKey() {
  // Generate a 64-character hex key (32 bytes)
  return crypto.randomBytes(32).toString('hex');
}

function generateSecurePassword(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Run regeneration
regenerateKeys().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
