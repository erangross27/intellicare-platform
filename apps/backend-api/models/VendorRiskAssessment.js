const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const vendorRiskSchema = new mongoose.Schema({
    practiceId: { 
        type: String, 
        required: true,
        index: true 
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BusinessAssociateAgreement',
        required: true
    },
    vendorName: {
        type: String,
        required: true
    },
    assessmentId: {
        type: String,
        required: true,
        unique: true
    },
    assessmentDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    nextAssessmentDate: {
        type: Date,
        required: true,
        index: true
    },
    riskScore: {
        overall: { type: Number, min: 0, max: 100 },
        technical: { type: Number, min: 0, max: 100 },
        operational: { type: Number, min: 0, max: 100 },
        compliance: { type: Number, min: 0, max: 100 },
        financial: { type: Number, min: 0, max: 100 }
    },
    riskLevel: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        required: true
    },
    securityPosture: {
        certifications: [{
            type: { type: String },
            validUntil: Date
        }],
        lastAuditDate: Date,
        penetrationTestDate: Date,
        vulnerabilityScanDate: Date,
        encryptionMethods: [String],
        accessControlMethods: [String],
        incidentResponsePlan: Boolean,
        disasterRecoveryPlan: Boolean,
        dataBackupFrequency: String,
        employeeScreening: Boolean,
        securityTrainingFrequency: String
    },
    technicalControls: {
        mfa: { implemented: Boolean, score: Number },
        encryption: { implemented: Boolean, score: Number },
        apiSecurity: { implemented: Boolean, score: Number },
        networkSegmentation: { implemented: Boolean, score: Number },
        logging: { implemented: Boolean, score: Number },
        monitoring: { implemented: Boolean, score: Number },
        patchManagement: { implemented: Boolean, score: Number },
        vulnerabilityManagement: { implemented: Boolean, score: Number }
    },
    dataHandling: {
        dataClassification: Boolean,
        dataRetentionPolicy: Boolean,
        dataDisposalMethod: String,
        crossBorderTransfers: Boolean,
        subprocessors: [{
            name: String,
            location: String,
            dataTypes: [String]
        }]
    },
    incidents: [{
        date: Date,
        type: {
            type: String,
            enum: ['DATA_BREACH', 'UNAUTHORIZED_ACCESS', 'DATA_LOSS', 'RANSOMWARE', 'DDOS', 'OTHER']
        },
        severity: {
            type: String,
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
        },
        recordsAffected: Number,
        resolutionTime: Number, // hours
        rootCause: String,
        preventiveMeasures: String
    }],
    questionnaire: [{
        category: String,
        question: String,
        answer: String,
        score: Number,
        weight: Number
    }],
    findings: [{
        type: {
            type: String,
            enum: ['VULNERABILITY', 'NON_COMPLIANCE', 'MISSING_CONTROL', 'PROCESS_GAP', 'DOCUMENTATION']
        },
        severity: {
            type: String,
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
        },
        description: String,
        recommendation: String,
        dueDate: Date,
        status: {
            type: String,
            enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED'],
            default: 'OPEN'
        }
    }],
    mitigationPlan: {
        measures: [{
            control: String,
            implementationDate: Date,
            responsible: String,
            status: String
        }],
        alternativeVendor: String,
        contingencyPlan: String
    },
    monitoring: {
        frequency: {
            type: String,
            enum: ['CONTINUOUS', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']
        },
        metrics: [{
            name: String,
            threshold: Number,
            currentValue: Number,
            status: String
        }],
        lastReviewDate: Date,
        nextReviewDate: Date
    },
    approvals: [{
        role: String,
        approver: String,
        date: Date,
        decision: {
            type: String,
            enum: ['APPROVED', 'CONDITIONAL', 'REJECTED']
        },
        comments: String
    }],
    metadata: {
        createdBy: String,
        createdAt: { type: Date, default: Date.now },
        lastModifiedBy: String,
        lastModifiedAt: { type: Date, default: Date.now },
        version: { type: Number, default: 1 }
    }
});

// Indexes
vendorRiskSchema.index({ practiceId: 1, riskLevel: 1 });
vendorRiskSchema.index({ practiceId: 1, nextAssessmentDate: 1 });
vendorRiskSchema.index({ vendorId: 1, assessmentDate: -1 });

// Calculate risk score
vendorRiskSchema.methods.calculateRiskScore = function() {
    const weights = {
        technical: 0.35,
        operational: 0.25,
        compliance: 0.25,
        financial: 0.15
    };

    // Calculate technical score
    let technicalScore = 0;
    const technicalItems = Object.values(this.technicalControls || {});
    technicalItems.forEach(item => {
        if (item.implemented) technicalScore += item.score || 10;
    });
    this.riskScore.technical = Math.min(technicalScore, 100);

    // Calculate operational score
    let operationalScore = 0;
    const posture = this.securityPosture || {};
    if (posture.incidentResponsePlan) operationalScore += 25;
    if (posture.disasterRecoveryPlan) operationalScore += 25;
    if (posture.employeeScreening) operationalScore += 25;
    if (posture.securityTrainingFrequency) operationalScore += 25;
    this.riskScore.operational = operationalScore;

    // Calculate compliance score based on certifications and audits
    let complianceScore = 0;
    if (posture.certifications?.length > 0) complianceScore += 40;
    if (posture.lastAuditDate) {
        const daysSinceAudit = (Date.now() - new Date(posture.lastAuditDate)) / (1000 * 60 * 60 * 24);
        if (daysSinceAudit < 365) complianceScore += 30;
    }
    if (this.dataHandling?.dataClassification) complianceScore += 15;
    if (this.dataHandling?.dataRetentionPolicy) complianceScore += 15;
    this.riskScore.compliance = Math.min(complianceScore, 100);

    // Financial score (simplified - would need more data in production)
    this.riskScore.financial = 70; // Default moderate score

    // Calculate overall score
    this.riskScore.overall = Math.round(
        this.riskScore.technical * weights.technical +
        this.riskScore.operational * weights.operational +
        this.riskScore.compliance * weights.compliance +
        this.riskScore.financial * weights.financial
    );

    // Determine risk level
    if (this.riskScore.overall >= 80) this.riskLevel = 'LOW';
    else if (this.riskScore.overall >= 60) this.riskLevel = 'MEDIUM';
    else if (this.riskScore.overall >= 40) this.riskLevel = 'HIGH';
    else this.riskLevel = 'CRITICAL';
};

module.exports = mongoose.model('VendorRiskAssessment', vendorRiskSchema);