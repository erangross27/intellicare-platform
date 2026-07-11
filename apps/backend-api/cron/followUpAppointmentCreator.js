// Follow-Up Appointment Creator Cron Job
// Automatically creates appointments from follow_up_appointments metadata

const cron = require('node-cron');
const secureConfigService = require('../services/secureConfigService');
const SecureDataAccess = require('../services/secureDataAccess');

class FollowUpAppointmentCreatorJob {
  constructor(options = {}) {
    this.schedule = options.schedule || '*/15 * * * *'; // Default: every 15 minutes
    this.enabled = options.enabled !== false; // Default: enabled
    this.job = null;
    this.isRunning = false;
    this.runHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Start the cron job
   */
  start() {
    if (!this.enabled) {
      console.log('⏸️ [FollowUpCreator] Cron job is disabled');
      return;
    }

    if (this.job) {
      console.log('⚠️ [FollowUpCreator] Cron job is already running');
      return;
    }

    console.log(`🕐 [FollowUpCreator] Starting cron job with schedule: ${this.schedule}`);

    // Validate cron expression
    if (!cron.validate(this.schedule)) {
      console.error(`❌ [FollowUpCreator] Invalid cron schedule: ${this.schedule}`);
      throw new Error(`Invalid cron schedule: ${this.schedule}`);
    }

    // Create and start the cron job
    this.job = cron.schedule(this.schedule, async () => {
      await this.processFollowUpAppointments();
    }, {
      scheduled: true,
      timezone: secureConfigService.get('TZ') || 'UTC'
    });

    console.log('✅ [FollowUpCreator] Cron job started successfully');

    // Run initial processing after 1 minute
    setTimeout(() => {
      console.log('🚀 [FollowUpCreator] Running initial processing...');
      this.processFollowUpAppointments();
    }, 60000);
  }

  /**
   * Stop the cron job
   */
  async stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      console.log('⏹️ [FollowUpCreator] Cron job stopped');
    }
  }

  /**
   * Process follow-up appointments by reading metadata from global database
   */
  async processFollowUpAppointments() {
    if (this.isRunning) {
      console.log('⏭️ [FollowUpCreator] Processing already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('🔄 [FollowUpCreator] Starting scheduled follow-up processing...');

      // Create global context for querying metadata
      const globalContext = {
        serviceId: 'follow-up-appointment-creator',
        practiceId: 'global',
        operation: 'queryMetadata',
        userId: 'system_cron'
      };

      // Query metadata from GLOBAL database (like batch_metadata pattern)
      const metadata = await SecureDataAccess.query(
        'follow_up_metadata',
        { processed: false }, // Only unprocessed metadata
        {},
        globalContext
      );

      if (!metadata || metadata.length === 0) {
        console.log('⚠️ [FollowUpCreator] No pending follow-ups found in metadata');
        return { totalProcessed: 0, totalCreated: 0, totalErrors: 0 };
      }

      console.log(`📋 [FollowUpCreator] Found ${metadata.length} follow-up metadata record(s) to process`);

      let totalProcessed = 0;
      let totalCreated = 0;
      let totalErrors = 0;

      // Process each metadata record
      for (const meta of metadata) {
        const practiceId = meta.practiceId;
        const followUpId = meta.followUpId;

        console.log(`🏥 [FollowUpCreator] Processing follow-up ${followUpId} for practice: ${practiceId}`);

        try {
          const stats = await this.processFollowUp(practiceId, followUpId, meta);
          totalProcessed += stats.processed;
          totalCreated += stats.created;
          totalErrors += stats.errors;

          // Mark metadata as processed
          if (stats.created > 0 || stats.errors > 0) {
            await SecureDataAccess.update(
              'follow_up_metadata',
              { _id: meta._id },
              { $set: { processed: true, processedAt: new Date() } },
              globalContext
            );
          }
        } catch (error) {
          console.error(`❌ [FollowUpCreator] Error processing follow-up ${followUpId}:`, error.message);
          totalErrors++;
        }
      }

      // Record in history
      const duration = Date.now() - startTime;
      this.addToHistory({
        timestamp: new Date(),
        duration: duration,
        stats: {
          totalProcessed,
          totalCreated,
          totalErrors
        },
        success: true
      });

      console.log(`✅ [FollowUpCreator] Processing completed in ${duration}ms`);

      if (totalCreated > 0 || totalErrors > 0) {
        console.log(`📊 [FollowUpCreator] Stats:`, {
          totalProcessed,
          totalCreated,
          totalErrors
        });
      }

      return { totalProcessed, totalCreated, totalErrors };
    } catch (error) {
      console.error('❌ [FollowUpCreator] Processing error:', error);

      // Record error in history
      this.addToHistory({
        timestamp: new Date(),
        duration: Date.now() - startTime,
        error: error.message,
        success: false
      });

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process a single follow-up appointment
   */
  async processFollowUp(practiceId, followUpId, metadata) {
    // Create practice context
    const practiceContext = {
      serviceId: 'follow-up-appointment-creator',
      practiceId: practiceId,
      operation: 'processFollowUp',
      userId: 'system_cron'
    };

    try {
      // Query the actual follow-up record
      const followUps = await SecureDataAccess.query(
        'follow_up_appointments',
        {
          _id: followUpId,
          status: 'scheduled',
          scheduledDate: { $exists: true, $ne: null }
        },
        { limit: 1 },
        practiceContext
      );

      if (!followUps || followUps.length === 0) {
        console.log(`⚠️ [FollowUpCreator] Follow-up ${followUpId} not found or already processed`);
        return { processed: 0, created: 0, errors: 0 };
      }

      const followUp = followUps[0];

      // Parse the scheduled date and time
      const scheduledDate = followUp.scheduledDate ? new Date(followUp.scheduledDate) : null;
      const scheduledTime = followUp.scheduledTime || '09:00'; // Default to 9 AM if no time specified

      if (!scheduledDate || isNaN(scheduledDate.getTime())) {
        console.warn(`⚠️ [FollowUpCreator] Invalid scheduledDate for follow-up ${followUpId}, skipping...`);
        return { processed: 1, created: 0, errors: 1 };
      }

      // Check if appointment already exists
      const existingAppointments = await SecureDataAccess.query(
        'appointments',
        {
          patientId: followUp.patientId,
          appointmentDate: scheduledDate,
          reason: followUp.reason
        },
        { limit: 1 },
        practiceContext
      );

      if (existingAppointments && existingAppointments.length > 0) {
        // Delete the follow-up since appointment already exists
        await SecureDataAccess.delete(
          'follow_up_appointments',
          { _id: followUp._id },
          practiceContext
        );
        console.log(`🔗 [FollowUpCreator] Deleted follow-up ${followUp._id} - appointment ${existingAppointments[0]._id} already exists`);
        return { processed: 1, created: 0, errors: 0 };
      }

      // Create new appointment - copy ALL fields from follow-up
      const newAppointment = {
        // Core appointment fields
        patientId: followUp.patientId,
        appointmentDate: scheduledDate,
        appointmentTime: scheduledTime,
        status: 'scheduled',

        // Copy ALL follow-up fields
        specialty: followUp.specialty,
        provider: followUp.provider,
        reason: followUp.reason,
        type: followUp.type,
        timing: followUp.timing,
        location: followUp.location,
        instructions: followUp.instructions,
        requiresReferral: followUp.requiresReferral,
        requiresPrep: followUp.requiresPrep,
        labsBeforeVisits: followUp.labsBeforeVisits,
        urgency: followUp.urgency,
        department: followUp.department,
        notes: followUp.notes,

        // Metadata
        source: 'auto_follow_up',
        followUpId: followUp._id,
        documentId: followUp.documentId, // Link to source document
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system_cron'
      };

      // Remove undefined fields
      Object.keys(newAppointment).forEach(key => {
        if (newAppointment[key] === undefined) {
          delete newAppointment[key];
        }
      });

      const insertResult = await SecureDataAccess.insert(
        'appointments',
        newAppointment,
        practiceContext
      );

      // Delete the follow-up appointment after creating the real appointment
      await SecureDataAccess.delete(
        'follow_up_appointments',
        { _id: followUp._id },
        practiceContext
      );

      console.log(`✨ [FollowUpCreator] Created appointment ${insertResult.insertedId} and deleted follow-up ${followUp._id}`);
      return { processed: 1, created: 1, errors: 0 };
    } catch (error) {
      console.error(`❌ [FollowUpCreator] Error creating appointment for follow-up ${followUpId}:`, error.message);
      return { processed: 1, created: 0, errors: 1 };
    }
  }

  /**
   * Add run to history
   */
  addToHistory(run) {
    this.runHistory.unshift(run);

    // Limit history size
    if (this.runHistory.length > this.maxHistorySize) {
      this.runHistory = this.runHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      running: this.job !== null,
      schedule: this.schedule,
      isExecuting: this.isRunning,
      lastRun: this.runHistory[0] || null,
      totalRuns: this.runHistory.length,
      successfulRuns: this.runHistory.filter(r => r.success).length,
      failedRuns: this.runHistory.filter(r => !r.success).length
    };
  }

  /**
   * Get run history
   */
  getHistory(limit = 10) {
    return this.runHistory.slice(0, limit);
  }
}

// Create singleton instance
const followUpCreatorJob = new FollowUpAppointmentCreatorJob({
  schedule: secureConfigService.get('FOLLOW_UP_CREATOR_SCHEDULE') || '*/15 * * * *', // Every 15 minutes by default
  enabled: secureConfigService.get('FOLLOW_UP_CREATOR_ENABLED') !== 'false' // Enabled by default
});

// Export for use in other modules
module.exports = {
  FollowUpAppointmentCreatorJob,
  followUpCreatorJob
};

// Auto-start if this is the main module
if (require.main === module) {
  console.log('🚀 [FollowUpCreator] Starting follow-up appointment creator as standalone service...');
  followUpCreatorJob.start();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 [FollowUpCreator] Received SIGINT, stopping...');
    await followUpCreatorJob.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 [FollowUpCreator] Received SIGTERM, stopping...');
    await followUpCreatorJob.stop();
    process.exit(0);
  });
}
