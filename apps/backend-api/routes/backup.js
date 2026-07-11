const express = require('express');
const router = express.Router();
const backupService = require('../services/backupService');
const { validatePracticeAccess, requirePracticeRole } = require('../middleware/practiceAccess');
const serviceAuth = require('../middleware/serviceAuth');

/**
 * @route POST /api/backup/manual
 * @desc Trigger a manual backup
 * @access Admin only
 */
router.post('/manual', 
  validatePracticeAccess,
  requirePracticeRole(['admin']),
  async (req, res) => {
    try {
      console.log('📦 Manual backup requested by user:', req.user.email);
      
      const result = await backupService.performFullBackup();
      
      res.json({
        success: true,
        message: 'Backup completed successfully',
        backup: {
          filename: result.filename,
          timestamp: result.manifest.timestamp,
          databases: result.manifest.databases.length,
          kmsKeys: result.manifest.kmsKeys.length
        }
      });
    } catch (error) {
      console.error('❌ Backup failed:', error);
      res.status(500).json({
        success: false,
        message: 'Backup failed',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/backup/list
 * @desc List all available backups
 * @access Admin only
 */
router.get('/list',
  validatePracticeAccess,
  requirePracticeRole(['admin']),
  async (req, res) => {
    try {
      const backups = await backupService.listBackups();
      
      res.json({
        success: true,
        backups: backups.map(b => ({
          filename: b.filename,
          size: b.size,
          created: b.created,
          timestamp: b.timestamp
        }))
      });
    } catch (error) {
      console.error('❌ Failed to list backups:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to list backups',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/backup/restore
 * @desc Restore from a backup file
 * @access Admin only
 */
router.post('/restore',
  validatePracticeAccess,
  requirePracticeRole(['admin']),
  async (req, res) => {
    try {
      const { filename } = req.body;
      
      if (!filename) {
        return res.status(400).json({
          success: false,
          message: 'Backup filename is required'
        });
      }
      
      console.log(`🔄 Restore requested for backup: ${filename}`);
      console.log(`   Requested by: ${req.user.email}`);
      
      const result = await backupService.restoreFromBackup(filename);
      
      res.json({
        success: true,
        message: 'Restore completed successfully',
        restore: {
          databases: result.manifest.databases.length,
          kmsKeys: result.manifest.kmsKeys.length,
          timestamp: result.manifest.timestamp
        }
      });
    } catch (error) {
      console.error('❌ Restore failed:', error);
      res.status(500).json({
        success: false,
        message: 'Restore failed',
        error: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/backup/clean
 * @desc Clean old backups manually
 * @access Admin only
 */
router.delete('/clean',
  validatePracticeAccess,
  requirePracticeRole(['admin']),
  async (req, res) => {
    try {
      await backupService.cleanOldBackups();
      
      res.json({
        success: true,
        message: 'Old backups cleaned successfully'
      });
    } catch (error) {
      console.error('❌ Failed to clean backups:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clean old backups',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/backup/status
 * @desc Get backup service status
 * @access Admin only
 */
router.get('/status',
  validatePracticeAccess,
  requirePracticeRole(['admin']),
  async (req, res) => {
    try {
      const health = await backupService.healthCheck();
      
      res.json({
        success: true,
        status: health
      });
    } catch (error) {
      console.error('❌ Failed to get backup status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get backup status',
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/backup/service
 * @desc Service-to-service backup endpoint
 * @access Service authentication required
 */
router.post('/service',
  serviceAuth,
  async (req, res) => {
    try {
      // Only allow specific services to trigger backups
      const allowedServices = ['disaster-recovery-service', 'admin-service', 'backup-scheduler'];
      
      if (!allowedServices.includes(req.serviceId)) {
        return res.status(403).json({
          success: false,
          message: 'Service not authorized to trigger backups'
        });
      }
      
      console.log(`📦 Service backup requested by: ${req.serviceId}`);
      
      const result = await backupService.performFullBackup();
      
      res.json({
        success: true,
        message: 'Service backup completed',
        backup: {
          filename: result.filename,
          timestamp: result.manifest.timestamp
        }
      });
    } catch (error) {
      console.error('❌ Service backup failed:', error);
      res.status(500).json({
        success: false,
        message: 'Service backup failed',
        error: error.message
      });
    }
  }
);

module.exports = router;