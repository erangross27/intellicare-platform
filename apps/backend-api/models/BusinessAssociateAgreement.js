const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const baaSchema = new mongoose.Schema({
    practiceId: { 
        type: String, 
        required: true,
        index: true 
    },
    vendorName: {
        type: String,
        required: true,
        trim: true
    },
    vendorType: {
        type: String,
        required: true,
        enum: ['EHR', 'CLOUD', 'BILLING', 'LAB', 'PHARMACY', 'IMAGING', 'TELEHEALTH', 'ANALYTICS', 'OTHER']
    },
    agreementNumber: {
        type: String,
        required: true,
        unique: true
    },
    effectiveDate: {
        type: Date,
        required: true
    },
    expirationDate: {
        type: Date,
        required: true,
        index: true
    },
    renewalDate: {
        type: Date,
        index: true
    },
    contractValue: {
        type: Number,
        min: 0
    },
    dataTypes: [{
        type: String,
        enum: ['PHI', 'PII', 'FINANCIAL', 'CLINICAL', 'DEMOGRAPHIC', 'BEHAVIORAL']
    }],
    dataFlowDirection: {
        type: String,
        enum: ['BIDIRECTIONAL', 'OUTBOUND', 'INBOUND'],
        required: true
    },
    encryptionRequired: {
        type: Boolean,
        default: true
    },
    complianceStatus: {
        status: {
            type: String,
            enum: ['COMPLIANT', 'NON_COMPLIANT', 'PENDING_REVIEW', 'EXPIRED', 'TERMINATED'],
            default: 'PENDING_REVIEW'
        },
        lastReviewDate: Date,
        nextReviewDate: Date,
        reviewNotes: String
    },
    securityMeasures: {
        encryption: { type: Boolean, default: false },
        accessControls: { type: Boolean, default: false },
        auditLogging: { type: Boolean, default: false },
        incidentResponse: { type: Boolean, default: false },
        dataRetention: { type: Boolean, default: false },
        employeeTraining: { type: Boolean, default: false }
    },
    incidents: [{
        date: Date,
        incidentType: String,
        description: String,
        resolved: Boolean,
        resolutionDate: Date,
        impactLevel: {
            type: String,
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
        }
    }],
    contacts: [{
        name: String,
        role: String,
        email: String,
        phone: String,
        isPrimary: Boolean
    }],
    documents: [{
        documentType: {
            type: String,
            enum: ['BAA', 'ADDENDUM', 'AUDIT_REPORT', 'CERTIFICATE', 'INSURANCE', 'OTHER']
        },
        fileName: String,
        uploadDate: Date,
        fileHash: String,
        expirationDate: Date
    }],
    alerts: [{
        alertType: {
            type: String,
            enum: ['EXPIRATION', 'RENEWAL', 'REVIEW', 'INCIDENT', 'COMPLIANCE']
        },
        date: Date,
        message: String,
        acknowledged: Boolean,
        acknowledgedBy: String,
        acknowledgedDate: Date
    }],
    terminationInfo: {
        terminated: { type: Boolean, default: false },
        terminationDate: Date,
        terminationReason: String,
        dataDispositionMethod: String,
        dataDispositionConfirmed: Boolean
    },
    auditHistory: [{
        date: Date,
        action: String,
        performedBy: String,
        details: Object
    }],
    metadata: {
        createdBy: String,
        createdAt: { type: Date, default: Date.now },
        lastModifiedBy: String,
        lastModifiedAt: { type: Date, default: Date.now },
        version: { type: Number, default: 1 }
    }
});

// Indexes for performance
baaSchema.index({ practiceId: 1, expirationDate: 1 });
baaSchema.index({ practiceId: 1, 'complianceStatus.status': 1 });
baaSchema.index({ practiceId: 1, vendorType: 1 });
baaSchema.index({ 'alerts.acknowledged': 1, 'alerts.date': 1 });

// Virtual for days until expiration
baaSchema.virtual('daysUntilExpiration').get(function() {
    if (!this.expirationDate) return null;
    const now = new Date();
    const diff = this.expirationDate - now;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// Virtual for compliance score
baaSchema.virtual('complianceScore').get(function() {
    let score = 0;
    let maxScore = 0;
    
    // Check security measures (60 points)
    Object.values(this.securityMeasures || {}).forEach(measure => {
        maxScore += 10;
        if (measure) score += 10;
    });
    
    // Check compliance status (20 points)
    maxScore += 20;
    if (this.complianceStatus?.status === 'COMPLIANT') score += 20;
    else if (this.complianceStatus?.status === 'PENDING_REVIEW') score += 10;
    
    // Check for recent incidents (20 points)
    maxScore += 20;
    const recentIncidents = (this.incidents || []).filter(i => {
        const daysSince = (Date.now() - new Date(i.date)) / (1000 * 60 * 60 * 24);
        return daysSince < 365 && !i.resolved;
    });
    if (recentIncidents.length === 0) score += 20;
    else if (recentIncidents.length === 1) score += 10;
    
    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
});

module.exports = mongoose.model('BusinessAssociateAgreement', baaSchema);