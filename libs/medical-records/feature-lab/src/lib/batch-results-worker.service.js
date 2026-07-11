// Batch Results Worker Service
// Automatically checks and processes completed batch jobs
// Runs in the background to update documents with analysis results
// SECURITY: All database access through SecureDataAccess

const serviceAccountManager = require('../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../backend/services/secureDataAccess');
const batchProcessor = require('../../../../../backend/services/claudeBatchProcessor');
const immutableAuditService = require('../../../../../backend/services/immutableAuditService');
const secureConfigService = require('../../../../../backend/services/secureConfigService');

class BatchResultsWorkerService {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 60000; // Check every minute
    this.intervalId = null;
    this.serviceToken = null;
    this.serviceContext = null;
    
    // Batch Results Worker initialized
  }

  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('batch-results-worker');
    if (!this.serviceToken) {
      throw new Error('Failed to authenticate batch-results-worker service');
    }
    
    this.serviceContext = {
      serviceId: this.serviceToken.serviceId,
      operation: 'batch-worker-operations',
      practiceId: 'global'
    };
    
    // Batch Results Worker authenticated
    return this;
  }
  
  /**
   * Start the worker
   * SECURITY: Service must authenticate before accessing any data
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Batch worker already running');
      return;
    }
    
    // SECURITY: Authenticate service account
    try {
      if (!this.serviceToken) {
        await this.initialize();
      }
      
      // Log service startup
      await immutableAuditService.logSecurityEvent({
        type: 'SERVICE_STARTED',
        service: 'batch-results-worker',
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ Service authentication failed:', error.message);
      throw new Error('Cannot start service without authentication');
    }
    
    this.isRunning = true;
    // Starting batch results worker
    
    // Initial check
    this.checkPendingBatches();
    
    // Set up interval
    this.intervalId = setInterval(() => {
      this.checkPendingBatches();
    }, this.checkInterval);
  }
  
  /**
   * Stop the worker
   */
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Batch results worker stopped
  }
  
  /**
   * Check all pending batches across all practices
   */
  async checkPendingBatches() {
    try {
      // Log batch job check (suppressed in quiet mode)
      if (secureConfigService.get('QUIET_LOGS') !== 'true' && secureConfigService.get('NODE_ENV') !== 'test') {
        console.log('🔍 Checking for completed batch jobs...');
      }
      
      // SECURITY: Get allowed practices from service permissions
      const allowedClinics = this.serviceContext?.permissions?.practices || [];
      
      let clinicsToCheck = [];
      if (allowedClinics.includes('*')) {
        // Service has access to all practices
        clinicsToCheck = ['medical-center', 'medical-center-usa', 'hipaa-test-english', 'hipaa-test-hebrew'];
      } else {
        clinicsToCheck = allowedClinics;
      }
      
      let totalPendingBatches = 0;
      
      for (const practiceId of clinicsToCheck) {
        const context = { ...this.serviceContext, practiceId };
        const pendingCount = await this.checkClinicBatches(context);
        totalPendingBatches += pendingCount || 0;
      }
      
      // Auto-stop worker if no pending batches and in development mode
      if (totalPendingBatches === 0 && secureConfigService.get('NODE_ENV') !== 'production') {
        // Log worker stop (suppressed in quiet mode)
        if (secureConfigService.get('QUIET_LOGS') !== 'true' && secureConfigService.get('NODE_ENV') !== 'test') {
          console.log('💤 No pending batches found. Stopping worker to save resources.');
        }
        this.stop();
      }
      
    } catch (error) {
      console.error('❌ Batch worker error:', error.message);
    }
  }
  
  /**
   * Check batches for a specific practice
   */
  async checkClinicBatches(context) {
    try {
      // Find all patients with pending batches
      const allPatients = await SecureDataAccess.query('patients', {}, {}, context);
      const patientsWithBatches = allPatients.filter(patient => 
        patient.pendingBatchAnalysis && 
        Array.isArray(patient.pendingBatchAnalysis) && 
        patient.pendingBatchAnalysis.length > 0
      );
      
      if (patientsWithBatches.length === 0) {
        return 0;
      }
      
      console.log(`📦 Found ${patientsWithBatches.length} patients with pending batches in practice ${context.practiceId}`);
      
      for (const patient of patientsWithBatches) {
        for (const batch of patient.pendingBatchAnalysis) {
          try {
            // Check if batch is old enough to check (at least 1 minute old)
            const batchAge = Date.now() - batch.createdAt.getTime();
            if (batchAge < 60000) {
              continue; // Skip very recent batches
            }
            
            // Check batch status
            const status = await batchProcessor.checkBatchStatus(batch.batchId);
            
            if (status.status === 'ended') {
              console.log(`✅ Batch ${batch.batchId} completed for patient ${patient.firstName} ${patient.lastName}`);
              
              // Get results
              const results = await batchProcessor.getBatchResults(batch.batchId);
              
              // Process each result
              let successCount = 0;
              let failCount = 0;
              const keyFindings = [];
              
              for (const result of results) {
                if (result.success && result.analysis) {
                  successCount++;
                  
                  // Find the corresponding document
                  const docInfo = batch.documents.find(d => 
                    result.customId && result.customId.includes(d.id)
                  );
                  
                  if (docInfo) {
                    console.log(`📄 Updating document ${docInfo.id} (${docInfo.fileName})`);
                    const documents = await SecureDataAccess.query('documents', { _id: docInfo.id }, { limit: 1 }, context);
                    const document = documents[0];
                    if (document) {
                      console.log(`✅ Found document, current status: ${document.processingStatus}`);
                      // Update document with analysis results
                      document.aiClassification = {
                        documentType: result.analysis.documentType || 'medical_document',
                        confidence: 0.95,
                        extractedText: result.analysis.diagnosis || result.analysis.additionalNotes || '',
                        analyzedAt: new Date(),
                        medicalEntities: []
                      };
                      
                      if (result.analysis.medications) {
                        result.analysis.medications.forEach(med => {
                          document.aiClassification.medicalEntities.push({
                            entity: med.name,
                            type: 'medication',
                            confidence: 0.9
                          });
                        });
                      }
                      
                      if (result.analysis.tests) {
                        result.analysis.tests.forEach(test => {
                          document.aiClassification.medicalEntities.push({
                            entity: test.name,
                            type: 'test_result',
                            confidence: 0.9
                          });
                        });
                      }
                      
                      document.analysisResults = {
                        extractedText: JSON.stringify(result.analysis),
                        confidence: 0.95,
                        medicalData: result.analysis,
                        analyzedAt: new Date()
                      };
                      
                      document.processingStatus = 'completed';
                      document.processingResults = {
                        ...document.processingResults,
                        progress: 100,
                        progressStatus: 'Analysis complete (50% cost saved)',
                        stage: 'completed',
                        aiConfidence: 95,
                        aiConfidencePercentage: 95
                      };
                      
                      await SecureDataAccess.update('documents', { _id: document._id }, { $set: document }, {}, context);
                      console.log(`💾 Document ${docInfo.fileName} saved with status: ${document.processingStatus}`);
                      
                      // Collect key findings
                      if (result.analysis.diagnosis) {
                        keyFindings.push(`${docInfo.fileName}: ${result.analysis.diagnosis}`);
                      }
                      if (result.analysis.recommendations) {
                        keyFindings.push(`המלצות: ${result.analysis.recommendations}`);
                      }
                    }
                  }
                } else {
                  failCount++;
                }
              }
              
              // Add each analyzed document to medical history with proper category
              await this.addMedicalHistoryEntries(patient, results, batch, context);
              
              // Add summary entry
              let summaryText = `📊 ניתוח אצווה הושלם\n`;
              summaryText += `✅ ${successCount}/${results.length} מסמכים נותחו בהצלחה\n`;
              summaryText += `💰 חסכנו 50% בעלויות עיבוד!\n`;
              
              if (keyFindings.length > 0) {
                summaryText += `\nממצאים עיקריים:\n${keyFindings.join('\n')}`;
              }
              
              // Store batch summary in a note field or custom field
              patient.batchAnalysisHistory = patient.batchAnalysisHistory || [];
              patient.batchAnalysisHistory.push({
                date: new Date(),
                batchId: batch.batchId,
                description: summaryText,
                documents: batch.documents.map(d => d.id),
                analysisResults: {
                  successful: successCount,
                  failed: failCount,
                  total: results.length
                }
              });
              
              // Remove this batch from pending
              patient.pendingBatchAnalysis = patient.pendingBatchAnalysis.filter(
                b => b.batchId !== batch.batchId
              );
              
              await SecureDataAccess.update('patients', { _id: patient._id }, { $set: patient }, {}, context);
              
              console.log(`📊 Processed batch ${batch.batchId}: ${successCount} successful, ${failCount} failed`);
              
              // Track cost savings
              const costSaved = batchProcessor.calculateSavings(batch.documentCount);
              console.log(`💰 Saved approximately $${costSaved} with batch processing`);
              
            } else if (status.status === 'failed' || status.status === 'expired') {
              console.error(`❌ Batch ${batch.batchId} failed or expired`);
              
              // Update patient record
              patient.medicalHistory = patient.medicalHistory || [];
              patient.medicalHistory.push({
                date: new Date(),
                type: 'batch_analysis_failed',
                description: `❌ ניתוח אצווה נכשל עבור ${batch.documentCount} מסמכים`,
                documents: batch.documents.map(d => d.id),
                batchId: batch.batchId
              });
              
              // Mark documents as failed
              for (const docInfo of batch.documents) {
                const documents = await SecureDataAccess.query('documents', { _id: docInfo.id }, { limit: 1 }, context);
                const document = documents[0];
                if (document) {
                  document.processingStatus = 'failed';
                  document.processingResults = {
                    ...document.processingResults,
                    progressStatus: 'Batch analysis failed',
                    stage: 'failed'
                  };
                  await SecureDataAccess.update('documents', { _id: document._id }, { $set: document }, {}, context);
                }
              }
              
              // Remove from pending
              patient.pendingBatchAnalysis = patient.pendingBatchAnalysis.filter(
                b => b.batchId !== batch.batchId
              );
              
              await SecureDataAccess.update('patients', { _id: patient._id }, { $set: patient }, {}, context);
            } else {
              // Still processing
              console.log(`⏳ Batch ${batch.batchId} still processing: ${status.progress}`);
            }
            
          } catch (batchError) {
            console.error(`❌ Error processing batch ${batch.batchId}:`, batchError.message);
          }
        }
      }
      
      return patientsWithBatches.length;
      
    } catch (error) {
      console.error(`❌ Error checking practice ${context.practiceId} batches:`, error.message);
      return 0;
    }
  }

  /**
   * Add medical history entries for analyzed documents
   */
  async addMedicalHistoryEntries(patient, results, batch, context) {
    for (const result of results) {
      if (result.success && result.analysis) {
        const docInfo = batch.documents.find(d => 
          result.customId && result.customId.includes(d.id)
        );
        
        if (result.analysis.documentType) {
          // Map AI document type to patient history category
          const categoryMapping = {
            'lab_results': 'lab_results',
            'prescription': 'prescriptions',
            'discharge_summary': 'discharge_summary',
            'imaging_report': 'imaging_reports',
            'consultation_notes': 'consultation_notes',
            'vaccination_record': 'vaccination_records',
            'referral': 'referrals',
            'medical_certificate': 'medical_certificate'
          };
          
          const category = categoryMapping[result.analysis.documentType] || 'consultation_notes';
          
          // Build medical history entry based on category
          const historyEntry = {
            date: result.analysis.date ? new Date(result.analysis.date) : new Date(),
            category: category,
            documentId: docInfo?.id,
            fileName: docInfo?.fileName
          };
          
          // Add category-specific fields
          this.addCategorySpecificFields(historyEntry, result.analysis, category);
          
          patient.medicalHistory = patient.medicalHistory || [];
          patient.medicalHistory.push(historyEntry);
        }
      }
    }
  }

  /**
   * Add category-specific fields to history entry
   */
  addCategorySpecificFields(historyEntry, analysis, category) {
    // Add required fields based on category
    switch (category) {
      case 'lab_results':
        historyEntry.testType = analysis.tests?.[0]?.name || 'בדיקות מעבדה';
        historyEntry.results = analysis.tests || [];
        historyEntry.referenceRange = analysis.tests?.[0]?.referenceRange || '';
        if (analysis.patientInfo) {
          historyEntry.patientInfo = analysis.patientInfo;
        }
        historyEntry.notes = analysis.additionalNotes || '';
        historyEntry.extractedData = analysis;
        break;
      
      case 'prescriptions':
        historyEntry.medications = analysis.medications || [];
        historyEntry.prescribingDoctor = analysis.doctorName || '';
        historyEntry.diagnosis = analysis.diagnosis || '';
        historyEntry.treatment = analysis.recommendations || '';
        if (analysis.patientInfo) {
          historyEntry.patientInfo = analysis.patientInfo;
        }
        historyEntry.notes = analysis.additionalNotes || '';
        historyEntry.extractedData = analysis;
        break;
      
      case 'consultation_notes':
        historyEntry.diagnosis = analysis.diagnosis || 'ייעוץ רפואי';
        historyEntry.symptoms = analysis.symptoms || [];
        historyEntry.treatment = analysis.recommendations || '';
        if (analysis.patientInfo) {
          historyEntry.patientInfo = analysis.patientInfo;
        }
        historyEntry.notes = analysis.additionalNotes || '';
        historyEntry.extractedData = analysis;
        break;
      
      case 'imaging_reports':
        const studyType = (analysis.studyType || '').toLowerCase();
        if (studyType.includes('x-ray') || studyType.includes('xray')) {
          historyEntry.imagingType = 'x-ray';
        } else if (studyType.includes('ct')) {
          historyEntry.imagingType = 'ct';
        } else if (studyType.includes('mri')) {
          historyEntry.imagingType = 'mri';
        } else if (studyType.includes('ultrasound')) {
          historyEntry.imagingType = 'ultrasound';
        } else if (studyType.includes('pet')) {
          historyEntry.imagingType = 'pet';
        } else {
          historyEntry.imagingType = 'other';
        }
        historyEntry.findings = analysis.findings || analysis.tests?.[0]?.result || '';
        historyEntry.impression = analysis.impression || analysis.diagnosis || '';
        historyEntry.bodyPart = analysis.bodyPart || '';
        if (analysis.patientInfo) {
          historyEntry.patientInfo = analysis.patientInfo;
        }
        historyEntry.notes = analysis.additionalNotes || '';
        historyEntry.extractedData = analysis;
        break;
      
      case 'vaccination_records':
        if (analysis.vaccinations && Array.isArray(analysis.vaccinations)) {
          historyEntry.vaccinations = analysis.vaccinations;
          const firstVaccine = analysis.vaccinations[0] || {};
          historyEntry.vaccine = firstVaccine.vaccine || '';
          historyEntry.manufacturer = firstVaccine.manufacturer || '';
          historyEntry.lotNumber = firstVaccine.lotNumber || '';
          historyEntry.dose = firstVaccine.dose || firstVaccine.doseNumber || '';
          historyEntry.site = firstVaccine.site || '';
        } else {
          historyEntry.vaccine = analysis.vaccine || analysis.vaccineName || '';
          historyEntry.manufacturer = analysis.manufacturer || '';
          historyEntry.lotNumber = analysis.lotNumber || '';
          historyEntry.dose = analysis.dose || '';
          historyEntry.site = analysis.site || '';
        }
        if (analysis.patientInfo) {
          historyEntry.patientInfo = analysis.patientInfo;
        }
        historyEntry.notes = analysis.additionalNotes || '';
        historyEntry.extractedData = analysis;
        break;
      
      default:
        historyEntry.diagnosis = analysis.diagnosis || 'מסמך רפואי';
        historyEntry.treatment = analysis.recommendations || '';
        historyEntry.medications = analysis.medications || [];
        historyEntry.results = analysis.tests || [];
        if (analysis.patientInfo) {
          historyEntry.patientInfo = analysis.patientInfo;
        }
        historyEntry.notes = analysis.additionalNotes || '';
        historyEntry.extractedData = analysis;
    }
  }
  
  /**
   * Manually trigger batch check for a specific batch ID
   */
  async processBatch(batchId, practiceId = 'global') {
    try {
      const status = await batchProcessor.checkBatchStatus(batchId);
      
      if (status.status !== 'ended') {
        return {
          success: false,
          message: `Batch still ${status.status}`,
          progress: status.progress
        };
      }
      
      const results = await batchProcessor.getBatchResults(batchId);
      
      return {
        success: true,
        results: results,
        count: results.length
      };
      
    } catch (error) {
      console.error('❌ Manual batch processing error:', error.message);
      throw error;
    }
  }
}

module.exports = BatchResultsWorkerService;