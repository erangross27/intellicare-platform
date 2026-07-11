// Billing & Insurance Context - Barrel Export
// Manages billing operations, insurance verification, claims, and payments

// Feature Modules
exports.billing = require('./feature-billing');
exports.insurance = require('./feature-insurance'); 
exports.claims = require('./feature-claims');
exports.payments = require('./feature-payments');

// Data Access
exports.financial = require('./data-access-financial');

// Domain Models
exports.domain = require('./domain-billing');

// Utilities
exports.calculations = require('./util-calculations');

// Context Metadata
exports.contextInfo = {
  name: 'billing-insurance', 
  description: 'Billing & Insurance bounded context for financial operations',
  services: [
    'billingService',
    'insuranceVerificationService',
    'paymentProcessingService', 
    'costTrackingService',
    'costTrackingServiceDB',
    'costReportingFunctions',
    'insuranceClaimsService',
    'revenueManagementService'
  ],
  features: ['billing', 'insurance', 'claims', 'payments'],
  compliance: ['PCI', 'HIPAA', 'SOX']
};