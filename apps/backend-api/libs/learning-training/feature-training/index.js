/**
 * Training Feature Module
 * Handles training program management and delivery
 */

const TrainingService = require('./TrainingService');
const TrainingEnrollmentService = require('./TrainingEnrollmentService');
const TrainingDeliveryService = require('./TrainingDeliveryService');

module.exports = {
  TrainingService,
  TrainingEnrollmentService,
  TrainingDeliveryService
};