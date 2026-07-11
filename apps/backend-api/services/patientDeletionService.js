const { ObjectId } = require('mongodb');
const serviceProxyManager = require('./serviceProxyManager');
/**
 * 🔒 SECURITY NOTICE FOR AI AGENTS
 *
 * This service requires:
 * 1. Service account authentication
 * 2. SecureDataAccess for database operations
 * 3. Audit logging for all operations
 *
 * Direct database access will FAIL
 * Missing authentication will FAIL
 *
 * See: /docs/SECURITY-COOKBOOK.md
 */

const fs = require('fs').promises;
const path = require('path');

class PatientDeletionService {

  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this._secureDataAccess = null;
    this._serviceAccountManager = null;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Get services through proxy manager
      this._secureDataAccess = serviceProxyManager.get('secureDataAccess');
      this._serviceAccountManager = serviceProxyManager.get('serviceAccountManager');

      // Authenticate service
      this.serviceToken = await this._serviceAccountManager.authenticate('patient-deletion');

      this.initialized = true;
      console.log('✅ Patient Deletion Service initialized');
    } catch (error) {
      console.error('Failed to initialize Patient Deletion Service:', error);
      throw error;
    }
  }

  /**
   * Soft delete a single patient with all related data
   */
  async deletePatient(patientId, deletedBy = 'system', deleteReason = 'User requested deletion') {
    const startTime = Date.now();
    const getTimestamp = () => new Date().toISOString();

    try {
      console.log(`[${getTimestamp()}] 🚀 Starting deletion process for patient:`, patientId);
      console.log(`[${getTimestamp()}] 📝 Deletion reason:`, deleteReason);
      console.log(`[${getTimestamp()}] 👤 Deleted by:`, deletedBy);

      // Create context for secure data access
      const context = {
        serviceId: 'patient-deletion',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'current' // Will be passed from request context
      };

      // Find the patient
      const findStartTime = Date.now();
      const patientObjectId = new ObjectId(patientId);
      const patientResults = await this._secureDataAccess.query('patients', { _id: patientObjectId }, { limit: 1 }, context);
      const patient = patientResults[0];
      const findDuration = Date.now() - findStartTime;

      if (!patient) {
        throw new Error('Patient not found');
      }

      console.log(`[${getTimestamp()}] ✅ Patient found: ${patient.name} (took ${findDuration}ms)`);

      // Find related documents
      let relatedDocuments = [];
      const docStartTime = Date.now();
      try {
        console.log(`[${getTimestamp()}] 🔍 Searching for patient documents...`);
        const documents = await this._secureDataAccess.query('documents', { patientId: patientId }, {}, context);
        const docFindDuration = Date.now() - docStartTime;
        console.log(`[${getTimestamp()}] 📄 Found ${documents.length} documents (took ${docFindDuration}ms)`);

        relatedDocuments = documents.map(doc => ({
          documentId: doc._id,
          documentPath: doc.filePath || doc.path,
          documentName: doc.originalName || doc.fileName
        }));
      } catch (docError) {
        const docErrorDuration = Date.now() - docStartTime;
        console.log(`[${getTimestamp()}] ❌ Document search failed after ${docErrorDuration}ms:`, docError.message);
      }

      // Create deleted patient record
      const createStartTime = Date.now();
      console.log(`[${getTimestamp()}] 💾 Creating deleted patient record...`);
      const deletedPatientData = {
        originalPatientId: patient._id,
        patientData: patient,
        deletedBy,
        deleteReason,
        relatedDocuments,
        deletedAt: new Date(),
        isRestored: false
      };

      const savedDeletedPatient = await this._secureDataAccess.insert('deletedpatients', deletedPatientData, context);
      const createDuration = Date.now() - createStartTime;
      console.log(`[${getTimestamp()}] ✅ Deleted patient record saved with ID: ${savedDeletedPatient._id} (took ${createDuration}ms)`);

      // Move patient files to deleted folder if they exist
      const moveStartTime = Date.now();
      await this.movePatientFiles(patientId, 'deleted');
      const moveDuration = Date.now() - moveStartTime;
      console.log(`[${getTimestamp()}] 📁 File move completed (took ${moveDuration}ms)`);

      // Remove patient from main collection
      const deleteStartTime = Date.now();
      console.log(`[${getTimestamp()}] 🗑️ Removing patient from main collection...`);
      await this._secureDataAccess.delete('patients', { _id: patientObjectId }, context);
      const deleteDuration = Date.now() - deleteStartTime;
      console.log(`[${getTimestamp()}] ✅ Patient removed from main collection (took ${deleteDuration}ms)`);

      const totalDuration = Date.now() - startTime;
      console.log(`[${getTimestamp()}] 🎯 TOTAL DELETION TIME: ${totalDuration}ms`);

      return {
        success: true,
        deletedPatientId: savedDeletedPatient._id,
        message: 'Patient deleted successfully'
      };

    } catch (error) {
      console.error('Error deleting patient:', error);
      throw error;
    }
  }

  /**
   * Delete multiple patients
   */
  async deleteMultiplePatients(patientIds, deletedBy = 'system', deleteReason = 'Bulk deletion') {
    const results = {
      successful: [],
      failed: [],
      totalDeleted: 0
    };

    for (const patientId of patientIds) {
      try {
        const result = await this.deletePatient(patientId, deletedBy, deleteReason);
        results.successful.push({
          patientId,
          deletedPatientId: result.deletedPatientId
        });
        results.totalDeleted++;
      } catch (error) {
        results.failed.push({
          patientId,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Restore a deleted patient
   */
  async restorePatient(deletedPatientId, restoredBy = 'system') {
    const startTime = Date.now();
    const getTimestamp = () => new Date().toISOString();

    try {
      console.log(`[${getTimestamp()}] 🔄 Starting restore process for deleted patient:`, deletedPatientId);
      console.log(`[${getTimestamp()}] 👤 Restored by:`, restoredBy);

      // Create context for secure data access
      const context = {
        serviceId: 'patient-deletion',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'current'
      };

      // Find the deleted patient record
      const findStartTime = Date.now();
      const deletedPatientObjectId = new ObjectId(deletedPatientId);
      const deletedPatientResults = await this._secureDataAccess.query('deletedpatients', { _id: deletedPatientObjectId }, { limit: 1 }, context);
      const deletedPatient = deletedPatientResults[0];
      const findDuration = Date.now() - findStartTime;

      if (!deletedPatient) {
        throw new Error('Deleted patient record not found');
      }

      if (deletedPatient.isRestored) {
        throw new Error('Patient has already been restored');
      }

      console.log(`[${getTimestamp()}] ✅ Deleted patient record found (took ${findDuration}ms)`);

      // Check if a patient with the same data already exists (only if not previously deleted)
      const existingPatientResults = await this._secureDataAccess.query('patients', {
        email: deletedPatient.patientData.email,
        name: deletedPatient.patientData.name
      }, { limit: 1 }, context);
      const existingPatient = existingPatientResults[0];

      // Only throw error if there's an existing patient AND it's not the same original patient
      if (existingPatient && existingPatient._id.toString() !== deletedPatient.originalPatientId.toString()) {
        throw new Error('A patient with the same email and name already exists');
      }

      // Restore patient data (create new patient with original data)
      const restoreStartTime = Date.now();
      console.log(`[${getTimestamp()}] 🔄 Restoring patient data...`);
      const restoredPatientData = { ...deletedPatient.patientData };
      delete restoredPatientData._id; // Remove the old ID to create a new one

      const restoredPatient = await this._secureDataAccess.insert('patients', restoredPatientData, context);
      const restoreDuration = Date.now() - restoreStartTime;
      console.log(`[${getTimestamp()}] ✅ Patient data restored with new ID: ${restoredPatient._id} (took ${restoreDuration}ms)`);

      // Move files back from deleted folder
      const moveStartTime = Date.now();
      await this.movePatientFiles(deletedPatient.originalPatientId, 'restored', restoredPatient._id);
      const moveDuration = Date.now() - moveStartTime;
      console.log(`[${getTimestamp()}] 📁 Files moved back from deleted folder (took ${moveDuration}ms)`);

      // Update the deleted patient record
      const updateStartTime = Date.now();
      await this._secureDataAccess.update(
        'deletedpatients',
        { _id: deletedPatient._id },
        {
          $set: {
            isRestored: true,
            restoredAt: new Date(),
            restoredBy: restoredBy
          }
        },
        context
      );
      const updateDuration = Date.now() - updateStartTime;
      console.log(`[${getTimestamp()}] ✅ Deleted patient record updated (took ${updateDuration}ms)`);

      const totalDuration = Date.now() - startTime;
      console.log(`[${getTimestamp()}] 🎯 TOTAL RESTORE TIME: ${totalDuration}ms`);

      return {
        success: true,
        restoredPatient,
        message: 'Patient restored successfully'
      };

    } catch (error) {
      console.error('Error restoring patient:', error);
      throw error;
    }
  }

  /**
   * Get all deleted patients
   */
  async getDeletedPatients(includeRestored = false) {
    try {
      console.log('🔍 Fetching deleted patients, includeRestored:', includeRestored);
      const filter = includeRestored ? {} : { isRestored: false };
      console.log('📋 Filter:', filter);
      
      const context = {
        serviceId: 'patient-deletion',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'current'
      };
      
      const deletedPatients = await this._secureDataAccess.query('deletedpatients', filter, { sort: { deletedAt: -1 } }, context);
      console.log('📊 Found deleted patients:', deletedPatients.length);
      
      return deletedPatients;
    } catch (error) {
      console.error('❌ Error fetching deleted patients:', error);
      throw error;
    }
  }

  /**
   * Permanently delete a patient (cannot be restored)
   */
  async permanentlyDeletePatient(deletedPatientId) {
    const startTime = Date.now();
    const getTimestamp = () => new Date().toISOString();

    try {
      console.log(`[${getTimestamp()}] 🗑️ Starting permanent deletion for:`, deletedPatientId);

      const context = {
        serviceId: 'patient-deletion',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'current'
      };

      const findStartTime = Date.now();
      const deletedPatientObjectId = new ObjectId(deletedPatientId);
      const deletedPatientResults = await this._secureDataAccess.query('deletedpatients', { _id: deletedPatientObjectId }, { limit: 1 }, context);
      const deletedPatient = deletedPatientResults[0];
      const findDuration = Date.now() - findStartTime;

      if (!deletedPatient) {
        throw new Error('Deleted patient record not found');
      }
      console.log(`[${getTimestamp()}] ✅ Deleted patient record found (took ${findDuration}ms)`);

      // Remove patient files permanently
      const filesStartTime = Date.now();
      await this.removePatientFiles(deletedPatient.originalPatientId);
      const filesDuration = Date.now() - filesStartTime;
      console.log(`[${getTimestamp()}] 📁 Patient files removed permanently (took ${filesDuration}ms)`);

      // Remove from deleted patients collection
      const deleteStartTime = Date.now();
      await this._secureDataAccess.delete('deletedpatients', { _id: deletedPatientObjectId }, context);
      const deleteDuration = Date.now() - deleteStartTime;
      console.log(`[${getTimestamp()}] ✅ Deleted patient record removed (took ${deleteDuration}ms)`);

      const totalDuration = Date.now() - startTime;
      console.log(`[${getTimestamp()}] 🎯 TOTAL PERMANENT DELETE TIME: ${totalDuration}ms`);

      return {
        success: true,
        message: 'Patient permanently deleted'
      };
    } catch (error) {
      console.error('Error permanently deleting patient:', error);
      throw error;
    }
  }

  /**
   * Move patient files between folders (DEPRECATED - files now stored encrypted in database)
   */
  async movePatientFiles(patientId, action, newPatientId) {
    // Files are now stored encrypted in database, no file system operations needed
    console.log(`📝 Patient file operation skipped (${action}): Files stored in database, not file system`);
    return;
  }

  /**
   * Remove patient files permanently (DEPRECATED - files now stored encrypted in database)
   */
  async removePatientFiles(patientId) {
    // Files are now stored encrypted in database, no file system cleanup needed
    console.log(`📝 Patient file cleanup skipped: Files stored in database, not file system`);
    return;
  }

  /**
   * Clean up old deleted patients (older than specified days)
   */
  async cleanupOldDeletedPatients(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const context = {
        serviceId: 'patient-deletion',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'current'
      };

      const oldDeletedPatients = await this._secureDataAccess.query('deletedpatients', {
        deletedAt: { $lt: cutoffDate },
        isRestored: false
      }, {}, context);

      let cleanedCount = 0;
      for (const deletedPatient of oldDeletedPatients) {
        await this.removePatientFiles(deletedPatient.originalPatientId);
        await this._secureDataAccess.delete('deletedpatients', { _id: deletedPatient._id }, context);
        cleanedCount++;
      }

      return {
        success: true,
        cleanedCount,
        message: `Cleaned up ${cleanedCount} old deleted patients`
      };
    } catch (error) {
      console.error('Error cleaning up old deleted patients:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PatientDeletionService();