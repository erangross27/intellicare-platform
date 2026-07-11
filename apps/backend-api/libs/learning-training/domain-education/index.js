/**
 * Education Domain Models
 * Core entities for learning and training systems
 */

const TrainingProgram = require('./TrainingProgram');
const Assessment = require('./Assessment');
const Certificate = require('./Certificate');
const LearningPath = require('./LearningPath');
const Progress = require('./Progress');

module.exports = {
  TrainingProgram,
  Assessment,
  Certificate,
  LearningPath,
  Progress
};