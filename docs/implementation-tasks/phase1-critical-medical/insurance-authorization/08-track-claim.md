# Track Claim Status - Implementation Task

## Function Details
- **Function Name**: `trackClaim`
- **Location**: `backend/services/insuranceAuthorizationService.js`
- **Status**: Not Implemented
- **Priority**: High
- **Estimated Time**: 3-4 days
- **Complexity**: High

## Problem Description
Implement comprehensive claim tracking functionality to monitor submitted claims through the entire lifecycle from submission to payment. The system must handle real-time status updates, automated follow-ups, payment posting, denial management, and compliance with various payer-specific tracking requirements.

## Implementation Steps

### 1. Claim Tracking Service Implementation

```javascript
// File: backend/services/claimTrackingService.js
const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const X12Parser = require('./x12ParserService');
const NotificationService = require('./notificationService');
const PaymentPostingService = require('./paymentPostingService');

class ClaimTrackingService {
  constructor() {
    this.statusMappings = {
      // X12 277 status codes
      '1': 'Received',
      '2': 'Accepted',
      '3': 'Rejected',
      '4': 'Processed',
      '19': 'Acknowledged',
      '20': 'Paid',
      '21': 'Denied',
      '22': 'Suspended',
      '23': 'Under Review'
    };
  }

  async trackClaim(claimId, context) {
    try {
      // Get claim details
      const claim = await SecureDataAccess.query('claims', 
        { _id: claimId }, 
        {}, 
        context
      );

      if (!claim.length) {
        throw new Error('Claim not found');
      }

      const claimData = claim[0];
      
      // Track with multiple payers if applicable
      const trackingResults = [];
      
      for (const submission of claimData.submissions) {
        const result = await this.trackWithPayer(submission, claimData, context);
        trackingResults.push(result);
      }

      // Update claim with tracking results
      await this.updateClaimStatus(claimId, trackingResults, context);

      // Check for automated actions
      await this.processAutomatedActions(claimData, trackingResults, context);

      return {
        success: true,
        claimId,
        trackingResults,
        lastUpdated: new Date()
      };

    } catch (error) {
      await AuditLog.create({
        action: 'TRACK_CLAIM_ERROR',
        claimId,
        error: error.message,
        userId: context.userId,
        practiceId: context.practiceId,
        timestamp: new Date()
      });
      throw error;
    }
  }

  async trackWithPayer(submission, claimData, context) {
    const payer = submission.payer;
    
    try {
      let trackingResult;
      
      switch (payer.trackingMethod) {
        case 'x12_276_277':
          trackingResult = await this.trackViaX12(submission, claimData, context);
          break;
        case 'web_portal':
          trackingResult = await this.trackViaPortal(submission, claimData, context);
          break;
        case 'api':
          trackingResult = await this.trackViaAPI(submission, claimData, context);
          break;
        case 'batch_file':
          trackingResult = await this.trackViaBatch(submission, claimData, context);
          break;
        default:
          trackingResult = await this.trackGeneric(submission, claimData, context);
      }

      return {
        payerId: payer.id,
        payerName: payer.name,
        submissionId: submission.id,
        status: trackingResult.status,
        details: trackingResult.details,
        lastChecked: new Date(),
        nextCheckDue: this.calculateNextCheck(trackingResult.status)
      };

    } catch (error) {
      return {
        payerId: payer.id,
        payerName: payer.name,
        submissionId: submission.id,
        status: 'tracking_error',
        error: error.message,
        lastChecked: new Date(),
        nextCheckDue: new Date(Date.now() + 24 * 60 * 60 * 1000) // Retry in 24 hours
      };
    }
  }

  async trackViaX12(submission, claimData, context) {
    const x12Service = new X12Parser();
    
    // Create X12 276 inquiry
    const inquiry276 = {
      transactionSetHeader: {
        transactionSetIdentifierCode: '276',
        transactionSetControlNumber: this.generateControlNumber(),
        implementationConventionReference: '005010X212'
      },
      beginningOfHierarchicalTransaction: {
        hierarchicalStructureCode: '0010',
        transactionSetPurposeCode: '13', // Request
        referenceIdentification: claimData.claimNumber,
        date: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        time: new Date().toTimeString().slice(0, 8).replace(/:/g, '')
      },
      submitterName: {
        entityIdentifierCode: 'PR',
        entityTypeQualifier: '2',
        nameLastOrOrganizationName: context.practice.name,
        identificationCodeQualifier: 'XX',
        identificationCode: context.practice.npi
      },
      receiverName: {
        entityIdentifierCode: 'PE',
        entityTypeQualifier: '2',
        nameLastOrOrganizationName: submission.payer.name,
        identificationCodeQualifier: 'PI',
        identificationCode: submission.payer.id
      },
      providerInformation: {
        hierarchicalLevel: '20',
        hierarchicalChildCode: '1',
        providerCode: claimData.provider.npi,
        referenceIdentification: claimData.claimNumber
      },
      patientInformation: {
        hierarchicalLevel: '22',
        hierarchicalChildCode: '0',
        patientControlNumber: claimData.patient.id,
        memberID: claimData.patient.memberId,
        dateOfBirth: claimData.patient.dateOfBirth,
        gender: claimData.patient.gender
      },
      claimInformation: {
        claimSubmissionReasonCode: '00',
        claimNumber: claimData.claimNumber,
        facilityCodeValue: '11',
        claimFrequencyTypeCode: '1',
        patientSignatureSourceCode: 'P',
        relatedCausesCode: '',
        specialProgramCode: '',
        patientStatusCode: '01'
      }
    };

    // Submit X12 276 inquiry
    const response = await this.submitX12Transaction(inquiry276, submission.payer, context);
    
    // Parse X12 277 response
    if (response.transactionSetIdentifierCode === '277') {
      return this.parseX12277Response(response);
    }

    throw new Error('Invalid response format from payer');
  }

  parseX12277Response(response277) {
    const statusCode = response277.claimStatusCode;
    const statusDescription = this.statusMappings[statusCode] || 'Unknown Status';
    
    return {
      status: statusDescription.toLowerCase().replace(/\s+/g, '_'),
      details: {
        statusCode,
        statusDescription,
        payerClaimNumber: response277.payerClaimControlNumber,
        serviceDate: response277.serviceDate,
        totalCharges: response277.totalSubmittedCharges,
        adjustments: response277.adjustments || [],
        remittanceAdvice: response277.remittanceAdvice || null,
        contactInfo: response277.payerContactInfo || null
      },
      paymentInfo: response277.paymentInformation ? {
        paidAmount: response277.paymentInformation.paidAmount,
        paymentDate: response277.paymentInformation.paymentDate,
        paymentMethod: response277.paymentInformation.paymentMethod,
        checkNumber: response277.paymentInformation.checkNumber
      } : null
    };
  }

  async trackViaPortal(submission, claimData, context) {
    // Simulate web portal tracking (would use web scraping or APIs)
    const portalConfig = submission.payer.portalConfig;
    
    // This would typically use Puppeteer or similar for web scraping
    const trackingData = {
      status: 'under_review',
      details: {
        statusDescription: 'Under Review',
        estimatedProcessingTime: '14 business days',
        lastActivity: new Date().toISOString(),
        notes: 'Claim received and assigned to medical review'
      }
    };

    return trackingData;
  }

  async trackViaAPI(submission, claimData, context) {
    const apiConfig = submission.payer.apiConfig;
    const secureApiClient = require('./secureApiClient');
    
    try {
      const response = await secureApiClient.request(apiConfig.trackingEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiConfig.accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          claimNumber: claimData.claimNumber,
          submissionId: submission.id
        }
      });

      return {
        status: response.data.status.toLowerCase().replace(/\s+/g, '_'),
        details: response.data
      };

    } catch (error) {
      throw new Error(`API tracking failed: ${error.message}`);
    }
  }

  async updateClaimStatus(claimId, trackingResults, context) {
    const statusUpdate = {
      trackingResults,
      lastTracked: new Date(),
      overallStatus: this.determineOverallStatus(trackingResults)
    };

    await SecureDataAccess.update('claims',
      { _id: claimId },
      { $set: statusUpdate },
      context
    );

    // Create status history entry
    await SecureDataAccess.create('claim_status_history', {
      claimId,
      status: statusUpdate.overallStatus,
      trackingResults,
      timestamp: new Date(),
      updatedBy: context.userId
    }, context);
  }

  determineOverallStatus(trackingResults) {
    const statuses = trackingResults.map(r => r.status);
    
    // Priority order for status determination
    if (statuses.includes('denied')) return 'denied';
    if (statuses.includes('paid')) return 'paid';
    if (statuses.includes('suspended')) return 'suspended';
    if (statuses.includes('under_review')) return 'under_review';
    if (statuses.includes('processed')) return 'processed';
    if (statuses.includes('accepted')) return 'accepted';
    if (statuses.includes('received')) return 'received';
    
    return 'unknown';
  }

  async processAutomatedActions(claimData, trackingResults, context) {
    for (const result of trackingResults) {
      switch (result.status) {
        case 'paid':
          await this.processPaidClaim(claimData, result, context);
          break;
        case 'denied':
          await this.processDeniedClaim(claimData, result, context);
          break;
        case 'suspended':
          await this.processSuspendedClaim(claimData, result, context);
          break;
        case 'under_review':
          await this.scheduleFollowUp(claimData, result, context);
          break;
      }
    }
  }

  async processPaidClaim(claimData, trackingResult, context) {
    if (trackingResult.paymentInfo) {
      // Post payment
      const paymentService = new PaymentPostingService();
      await paymentService.postPayment({
        claimId: claimData._id,
        payerId: trackingResult.payerId,
        amount: trackingResult.paymentInfo.paidAmount,
        paymentDate: trackingResult.paymentInfo.paymentDate,
        paymentMethod: trackingResult.paymentInfo.paymentMethod,
        checkNumber: trackingResult.paymentInfo.checkNumber
      }, context);
    }

    // Send notification
    await NotificationService.send({
      type: 'claim_paid',
      recipients: [claimData.provider.email],
      data: {
        claimNumber: claimData.claimNumber,
        patientName: claimData.patient.name,
        paidAmount: trackingResult.paymentInfo?.paidAmount,
        paymentDate: trackingResult.paymentInfo?.paymentDate
      }
    });
  }

  async processDeniedClaim(claimData, trackingResult, context) {
    // Create denial record
    await SecureDataAccess.create('claim_denials', {
      claimId: claimData._id,
      payerId: trackingResult.payerId,
      denialReason: trackingResult.details.statusDescription,
      denialCode: trackingResult.details.statusCode,
      denialDate: new Date(),
      appealsRemaining: 2,
      appealDeadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
    }, context);

    // Send notification
    await NotificationService.send({
      type: 'claim_denied',
      recipients: [claimData.provider.email],
      data: {
        claimNumber: claimData.claimNumber,
        patientName: claimData.patient.name,
        denialReason: trackingResult.details.statusDescription,
        appealDeadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      }
    });
  }

  async scheduleFollowUp(claimData, trackingResult, context) {
    const followUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await SecureDataAccess.create('claim_followups', {
      claimId: claimData._id,
      payerId: trackingResult.payerId,
      dueDate: followUpDate,
      type: 'status_check',
      status: 'pending',
      createdBy: context.userId
    }, context);
  }

  calculateNextCheck(status) {
    const intervals = {
      'received': 3, // 3 days
      'accepted': 7, // 7 days
      'under_review': 14, // 14 days
      'processed': 30, // 30 days
      'paid': null, // No follow-up needed
      'denied': null, // Handled separately
      'suspended': 3 // 3 days
    };

    const days = intervals[status];
    return days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
  }

  generateControlNumber() {
    return Math.floor(Math.random() * 999999999).toString().padStart(9, '0');
  }

  async submitX12Transaction(transaction, payer, context) {
    // Implementation for submitting X12 transactions
    // This would integrate with EDI clearinghouses or direct payer connections
    const ediService = require('./ediService');
    return await ediService.submit(transaction, payer, context);
  }
}

module.exports = ClaimTrackingService;
```

### 2. API Endpoint Implementation

```javascript
// File: backend/routes/insurance.js - Add this endpoint

router.post('/claims/:claimId/track', requireAuth, async (req, res) => {
  try {
    const { claimId } = req.params;
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'claim-tracking-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_CLAIM_TRACKING_KEY')
    };

    const claimTrackingService = new ClaimTrackingService();
    const result = await claimTrackingService.trackClaim(claimId, context);

    // Create audit log
    await AuditLog.create({
      action: 'TRACK_CLAIM',
      claimId,
      userId: req.user.id,
      practiceId: req.practice.id,
      details: { trackingResults: result.trackingResults },
      timestamp: new Date()
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: {
        he: 'שגיאה במעקב אחר תביעה',
        en: 'Error tracking claim'
      },
      details: error.message 
    });
  }
});

router.get('/claims/:claimId/status', requireAuth, async (req, res) => {
  try {
    const { claimId } = req.params;
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'claim-tracking-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_CLAIM_TRACKING_KEY')
    };

    const claim = await SecureDataAccess.query('claims',
      { _id: claimId },
      { include: ['trackingResults', 'statusHistory'] },
      context
    );

    if (!claim.length) {
      return res.status(404).json({ 
        error: {
          he: 'תביעה לא נמצאה',
          en: 'Claim not found'
        }
      });
    }

    res.json(claim[0]);
  } catch (error) {
    res.status(500).json({ 
      error: {
        he: 'שגיאה בקבלת סטטוס תביעה',
        en: 'Error retrieving claim status'
      },
      details: error.message 
    });
  }
});

router.get('/claims/tracking/summary', requireAuth, async (req, res) => {
  try {
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'claim-tracking-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_CLAIM_TRACKING_KEY')
    };

    const pipeline = [
      { $match: { practiceId: context.practiceId } },
      {
        $group: {
          _id: '$overallStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalCharges' }
        }
      }
    ];

    const summary = await SecureDataAccess.aggregate('claims', pipeline, context);

    res.json({ summary });
  } catch (error) {
    res.status(500).json({ 
      error: {
        he: 'שגיאה בקבלת סיכום מעקב',
        en: 'Error retrieving tracking summary'
      },
      details: error.message 
    });
  }
});
```

### 3. Data Models

```javascript
// File: backend/models/ClaimStatusHistory.js
const mongoose = require('mongoose');

const claimStatusHistorySchema = new mongoose.Schema({
  claimId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Claim'
  },
  status: {
    type: String,
    required: true,
    enum: [
      'submitted', 'received', 'accepted', 'rejected',
      'under_review', 'processed', 'paid', 'denied',
      'suspended', 'tracking_error'
    ]
  },
  trackingResults: [{
    payerId: String,
    payerName: String,
    submissionId: String,
    status: String,
    details: mongoose.Schema.Types.Mixed,
    lastChecked: Date,
    nextCheckDue: Date
  }],
  timestamp: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  notes: String
}, {
  timestamps: true
});

claimStatusHistorySchema.index({ claimId: 1, timestamp: -1 });

module.exports = mongoose.model('ClaimStatusHistory', claimStatusHistorySchema);
```

```javascript
// File: backend/models/ClaimFollowup.js
const mongoose = require('mongoose');

const claimFollowupSchema = new mongoose.Schema({
  claimId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Claim'
  },
  payerId: {
    type: String,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['status_check', 'payment_inquiry', 'denial_review', 'appeal_deadline']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'overdue', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedDate: Date,
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  }
}, {
  timestamps: true
});

claimFollowupSchema.index({ dueDate: 1, status: 1 });
claimFollowupSchema.index({ claimId: 1 });

module.exports = mongoose.model('ClaimFollowup', claimFollowupSchema);
```

### 4. Frontend Components

```jsx
// File: frontend-vite/src/components/claims/ClaimTracker.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Loader2, RefreshCw, Eye, AlertTriangle } from 'lucide-react';
import secureApi from '../../services/secureApiClient';

const ClaimTracker = ({ claimId, onStatusUpdate }) => {
  const [claim, setClaim] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClaimStatus();
  }, [claimId]);

  const fetchClaimStatus = async () => {
    try {
      const response = await secureApi.get(`/api/insurance/claims/${claimId}/status`);
      setClaim(response.data);
    } catch (error) {
      console.error('Error fetching claim status:', error);
    } finally {
      setLoading(false);
    }
  };

  const trackClaim = async () => {
    setTracking(true);
    try {
      const response = await secureApi.post(`/api/insurance/claims/${claimId}/track`);
      setClaim(prev => ({
        ...prev,
        trackingResults: response.data.trackingResults,
        lastTracked: response.data.lastUpdated,
        overallStatus: response.data.overallStatus
      }));
      onStatusUpdate?.(response.data);
    } catch (error) {
      console.error('Error tracking claim:', error);
    } finally {
      setTracking(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'paid': 'bg-green-100 text-green-800',
      'denied': 'bg-red-100 text-red-800',
      'under_review': 'bg-yellow-100 text-yellow-800',
      'suspended': 'bg-orange-100 text-orange-800',
      'processed': 'bg-blue-100 text-blue-800',
      'received': 'bg-gray-100 text-gray-800',
      'tracking_error': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatStatus = (status) => {
    return status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Claim Tracking</CardTitle>
          <Button 
            onClick={trackClaim} 
            disabled={tracking}
            variant="outline"
            size="sm"
          >
            {tracking ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Update Status
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Overall Status */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Overall Status:</span>
            <Badge className={getStatusColor(claim?.overallStatus)}>
              {formatStatus(claim?.overallStatus)}
            </Badge>
          </div>

          {/* Last Tracked */}
          {claim?.lastTracked && (
            <div className="flex items-center justify-between">
              <span className="font-medium">Last Tracked:</span>
              <span className="text-sm text-gray-600">
                {new Date(claim.lastTracked).toLocaleString()}
              </span>
            </div>
          )}

          {/* Tracking Results per Payer */}
          {claim?.trackingResults && (
            <div className="space-y-3">
              <h4 className="font-medium">Payer Status:</h4>
              {claim.trackingResults.map((result, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{result.payerName}</span>
                    <Badge className={getStatusColor(result.status)}>
                      {formatStatus(result.status)}
                    </Badge>
                  </div>
                  
                  {result.details && (
                    <div className="text-sm space-y-1">
                      {result.details.statusDescription && (
                        <p><strong>Description:</strong> {result.details.statusDescription}</p>
                      )}
                      {result.details.payerClaimNumber && (
                        <p><strong>Payer Claim #:</strong> {result.details.payerClaimNumber}</p>
                      )}
                      {result.details.estimatedProcessingTime && (
                        <p><strong>Processing Time:</strong> {result.details.estimatedProcessingTime}</p>
                      )}
                    </div>
                  )}

                  {result.paymentInfo && (
                    <div className="mt-2 p-2 bg-green-50 rounded">
                      <p className="text-sm font-medium text-green-800">Payment Information:</p>
                      <div className="text-sm space-y-1">
                        <p><strong>Amount:</strong> ${result.paymentInfo.paidAmount}</p>
                        <p><strong>Date:</strong> {new Date(result.paymentInfo.paymentDate).toLocaleDateString()}</p>
                        {result.paymentInfo.checkNumber && (
                          <p><strong>Check #:</strong> {result.paymentInfo.checkNumber}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {result.nextCheckDue && (
                    <div className="mt-2 text-xs text-gray-600">
                      Next check due: {new Date(result.nextCheckDue).toLocaleString()}
                    </div>
                  )}

                  {result.error && (
                    <div className="mt-2 p-2 bg-red-50 rounded">
                      <div className="flex items-center text-red-800">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        <span className="text-sm font-medium">Tracking Error:</span>
                      </div>
                      <p className="text-sm text-red-700">{result.error}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Status History */}
          {claim?.statusHistory && claim.statusHistory.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Status History:</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {claim.statusHistory.slice(0, 5).map((history, index) => (
                  <div key={index} className="text-sm border-l-2 border-gray-200 pl-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {formatStatus(history.status)}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(history.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {history.notes && (
                      <p className="text-xs text-gray-600 mt-1">{history.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ClaimTracker;
```

## Test Cases

### 1. Unit Tests

```javascript
// File: backend/tests/claimTrackingService.test.js
const ClaimTrackingService = require('../services/claimTrackingService');
const SecureDataAccess = require('../services/secureDataAccess');

describe('ClaimTrackingService', () => {
  let service;
  let mockContext;

  beforeEach(() => {
    service = new ClaimTrackingService();
    mockContext = {
      userId: 'user123',
      practiceId: 'clinic123',
      serviceId: 'claim-tracking-service',
      apiKey: 'test-key'
    };
  });

  test('should track claim successfully', async () => {
    const mockClaim = {
      _id: 'claim123',
      claimNumber: 'CLM001',
      submissions: [{
        id: 'sub123',
        payer: {
          id: 'payer123',
          name: 'Test Insurance',
          trackingMethod: 'x12_276_277'
        }
      }]
    };

    jest.spyOn(SecureDataAccess, 'query').mockResolvedValue([mockClaim]);
    jest.spyOn(service, 'trackWithPayer').mockResolvedValue({
      payerId: 'payer123',
      status: 'under_review',
      details: { statusDescription: 'Under Review' }
    });

    const result = await service.trackClaim('claim123', mockContext);

    expect(result.success).toBe(true);
    expect(result.trackingResults).toHaveLength(1);
  });

  test('should handle tracking errors gracefully', async () => {
    jest.spyOn(SecureDataAccess, 'query').mockResolvedValue([]);

    await expect(service.trackClaim('nonexistent', mockContext))
      .rejects.toThrow('Claim not found');
  });

  test('should parse X12 277 response correctly', () => {
    const mockResponse = {
      claimStatusCode: '20',
      payerClaimControlNumber: 'PCN123',
      totalSubmittedCharges: '150.00',
      paymentInformation: {
        paidAmount: '120.00',
        paymentDate: '20241220',
        paymentMethod: 'CHECK'
      }
    };

    const result = service.parseX12277Response(mockResponse);

    expect(result.status).toBe('paid');
    expect(result.paymentInfo.paidAmount).toBe('120.00');
  });
});
```

### 2. Integration Tests

```javascript
// File: backend/tests/claimTracking.integration.test.js
const request = require('supertest');
const app = require('../server');

describe('Claim Tracking Integration', () => {
  test('should track claim via API', async () => {
    const response = await request(app)
      .post('/api/insurance/claims/claim123/track')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.trackingResults).toBeDefined();
  });

  test('should get claim status via API', async () => {
    const response = await request(app)
      .get('/api/insurance/claims/claim123/status')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.overallStatus).toBeDefined();
  });
});
```

## Dependencies
- SecureDataAccess service
- X12Parser service  
- NotificationService
- PaymentPostingService
- EDI service integration
- Audit logging system

## Success Criteria
- [ ] Claims can be tracked across multiple payers
- [ ] X12 276/277 transactions work correctly
- [ ] Status updates trigger appropriate notifications
- [ ] Payment information is automatically posted
- [ ] Follow-up tasks are created for pending claims
- [ ] Tracking errors are handled gracefully
- [ ] Comprehensive audit trail is maintained
- [ ] Real-time status updates in UI
- [ ] Performance handles high volume tracking
- [ ] Integration with existing claim management system