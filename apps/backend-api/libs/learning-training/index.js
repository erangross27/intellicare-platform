/**
 * Learning & Training Context - Barrel Export
 * Educational systems, training programs, and knowledge management
 */

// Feature modules
const trainingFeature = require('./feature-training');
const educationFeature = require('./feature-education');
const assessmentFeature = require('./feature-assessment');
const knowledgeFeature = require('./feature-knowledge');

// Data access layer
const learningDataAccess = require('./data-access-learning');

// Domain models
const educationDomain = require('./domain-education');

// Utilities
const trackingUtil = require('./util-tracking');

module.exports = {
  // Features
  training: trainingFeature,
  education: educationFeature,
  assessment: assessmentFeature,
  knowledge: knowledgeFeature,
  
  // Data layer
  dataAccess: learningDataAccess,
  
  // Domain
  domain: educationDomain,
  
  // Utilities
  tracking: trackingUtil
};