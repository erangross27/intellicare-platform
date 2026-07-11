# Get Authorization Status

## Function Details
- **Name**: getAuthorizationStatus
- **Status**: Not Implemented
- **Priority**: Critical (Phase 1)
- **Estimated Time**: 3 hours

## Problem Description
Healthcare providers need to track the status of prior authorization requests submitted to insurance companies. The system must provide real-time status updates, handle multiple authorization types, track approval timelines, and alert providers of status changes or required actions.

## Implementation Steps

### 1. Create Authorization Status Service
```javascript
// backend/services/authorizationStatusService.js

const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const axios = require('axios');

class AuthorizationStatusService {
  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('authorization-status-service');
    this.statusMappings = await this.loadStatusMappings();
    this.providerAPIs = await this.loadProviderAPIs();
  }

  async getAuthorizationStatus(authorizationId, options = {}, context) {
    const {
      includeHistory = true,
      includeDocuments = false,
      includeTimeline = true,
      checkRealTime = true
    } = options;

    // Get authorization record
    const authorization = await SecureDataAccess.findById(
      'authorizations',
      authorizationId,
      context
    );

    if (!authorization) {
      throw new Error('Authorization not found');
    }

    // Verify practice access
    if (authorization.practiceId !== context.practiceId) {
      throw new Error('Access denied to authorization');
    }

    // Get current status
    let currentStatus = authorization.status;
    let realTimeUpdate = null;

    // Check for real-time updates if requested
    if (checkRealTime && this.shouldCheckRealTime(authorization)) {
      try {
        realTimeUpdate = await this.checkRealTimeStatus(authorization);
        if (realTimeUpdate && realTimeUpdate.status !== currentStatus) {
          await this.updateAuthorizationStatus(
            authorizationId,
            realTimeUpdate,
            context
          );
          currentStatus = realTimeUpdate.status;
        }
      } catch (error) {
        console.warn('Real-time status check failed:', error.message);
        // Continue with cached status
      }
    }

    // Build response
    const result = {
      authorizationId,
      authorizationNumber: authorization.authorizationNumber,
      referenceNumber: authorization.referenceNumber,
      status: currentStatus,
      statusDescription: this.getStatusDescription(currentStatus),
      submittedDate: authorization.submittedDate,
      lastUpdated: authorization.lastUpdated || authorization.submittedDate,
      expirationDate: authorization.expirationDate,
      approvedUnits: authorization.approvedUnits,
      usedUnits: authorization.usedUnits,
      remainingUnits: authorization.remainingUnits,
      patient: {
        id: authorization.patientId,
        name: authorization.patientName,
        memberId: authorization.memberId
      },
      provider: {
        id: authorization.providerId,
        name: authorization.providerName,
        npi: authorization.providerNPI
      },
      insurance: {
        company: authorization.insuranceCompany,
        planName: authorization.planName,
        memberId: authorization.memberId
      },
      service: {
        code: authorization.serviceCode,
        description: authorization.serviceDescription,
        requestedUnits: authorization.requestedUnits,
        urgentStatus: authorization.urgentStatus
      }
    };

    // Add history if requested
    if (includeHistory) {
      result.statusHistory = await this.getStatusHistory(authorizationId, context);
    }

    // Add timeline if requested
    if (includeTimeline) {
      result.timeline = await this.buildTimeline(authorization, result.statusHistory);
    }

    // Add documents if requested
    if (includeDocuments) {
      result.documents = await this.getAuthorizationDocuments(authorizationId, context);
    }

    // Add next actions
    result.nextActions = this.getNextActions(currentStatus, authorization);

    // Add alerts
    result.alerts = await this.checkStatusAlerts(authorization, currentStatus);

    // Create audit log
    await AuditLog.create({
      action: 'GET_AUTHORIZATION_STATUS',
      userId: context.userId,
      patientId: authorization.patientId,
      practiceId: context.practiceId,
      details: {
        authorizationId,
        authorizationNumber: authorization.authorizationNumber,
        status: currentStatus,
        realTimeChecked: !!realTimeUpdate
      },
      timestamp: new Date()
    });

    return result;
  }

  async checkRealTimeStatus(authorization) {
    const provider = this.providerAPIs[authorization.payerId];
    if (!provider || !provider.statusEndpoint) {
      return null;
    }

    // Build status inquiry request
    const statusRequest = {
      authorizationNumber: authorization.authorizationNumber,
      referenceNumber: authorization.referenceNumber,
      memberId: authorization.memberId,
      serviceDate: authorization.serviceDate,
      providerNPI: authorization.providerNPI
    };

    try {
      let response;
      
      switch (provider.type) {
        case 'x12-278':
          response = await this.sendX12StatusRequest(statusRequest, provider);
          break;
        case 'rest-api':
          response = await this.sendRESTStatusRequest(statusRequest, provider);
          break;
        case 'web-portal':
          response = await this.scrapePortalStatus(statusRequest, provider);
          break;
        default:
          throw new Error(`Unsupported provider type: ${provider.type}`);
      }

      return this.parseStatusResponse(response, provider.type);
    } catch (error) {
      console.error('Real-time status check failed:', error);
      throw error;
    }
  }

  async sendX12StatusRequest(request, provider) {
    // Generate X12 278 status inquiry
    const x12Message = this.generateX12_278_Inquiry(request, provider);
    
    const response = await axios.post(provider.statusEndpoint, x12Message, {
      headers: {
        'Content-Type': 'application/x12',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      timeout: 30000
    });

    return {
      type: 'x12-278',
      data: response.data
    };
  }

  async sendRESTStatusRequest(request, provider) {
    const response = await axios.get(
      `${provider.statusEndpoint}/${request.authorizationNumber}`,
      {
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'X-Client-ID': provider.clientId
        },
        params: {
          referenceNumber: request.referenceNumber,
          memberId: request.memberId
        },
        timeout: 30000
      }
    );

    return {
      type: 'rest-json',
      data: response.data
    };
  }

  async scrapePortalStatus(request, provider) {
    // For providers that only have web portals
    // This would use a headless browser service
    const portalService = require('./portalScrapingService');
    
    const result = await portalService.getAuthorizationStatus(
      provider.portalUrl,
      provider.credentials,
      request
    );

    return {
      type: 'web-portal',
      data: result
    };
  }

  parseStatusResponse(response, type) {
    switch (type) {
      case 'x12-278':
        return this.parseX12_278Response(response.data);
      case 'rest-json':
        return this.parseRESTStatusResponse(response.data);
      case 'web-portal':
        return this.parsePortalResponse(response.data);
      default:
        throw new Error(`Unknown response type: ${type}`);
    }
  }

  parseX12_278Response(x12Data) {
    // Parse X12 278 response - simplified implementation
    const segments = x12Data.split('~');
    const result = {
      status: null,
      statusDate: null,
      approvedUnits: null,
      expirationDate: null,
      messages: []
    };

    segments.forEach(segment => {
      const elements = segment.split('*');
      
      switch (elements[0]) {
        case 'HCR': // Health Care Services Review
          result.status = this.mapX12Status(elements[1]);
          if (elements[3]) {
            result.statusDate = this.parseX12Date(elements[3]);
          }
          break;
        
        case 'REF': // Reference Information
          if (elements[1] === 'BB') { // Authorization number
            result.authorizationNumber = elements[2];
          }
          break;
        
        case 'QTY': // Quantity
          if (elements[1] === 'CA') { // Approved quantity
            result.approvedUnits = parseInt(elements[2]);
          }
          break;
        
        case 'DTP': // Date/Time Period
          if (elements[1] === '036') { // Expiration date
            result.expirationDate = this.parseX12Date(elements[3]);
          }
          break;
        
        case 'MSG': // Message Text
          result.messages.push(elements[1]);
          break;
      }
    });

    return result;
  }

  parseRESTStatusResponse(data) {
    return {
      status: this.normalizeStatus(data.status || data.authorizationStatus),
      statusDate: data.statusDate ? new Date(data.statusDate) : null,
      approvedUnits: data.approvedUnits || data.approvedQuantity,
      expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
      messages: data.messages || data.notes || [],
      additionalInfo: data.additionalInfo || {}
    };
  }

  parsePortalResponse(data) {
    // Parse scraped portal data
    return {
      status: this.normalizeStatus(data.status),
      statusDate: data.lastUpdated ? new Date(data.lastUpdated) : null,
      approvedUnits: data.approvedUnits,
      expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
      messages: data.messages || [],
      portalData: data.rawData
    };
  }

  async updateAuthorizationStatus(authorizationId, statusUpdate, context) {
    // Update authorization with new status
    const updateData = {
      status: statusUpdate.status,
      lastUpdated: new Date(),
      statusDate: statusUpdate.statusDate || new Date()
    };

    // Add optional fields if present
    if (statusUpdate.approvedUnits) {
      updateData.approvedUnits = statusUpdate.approvedUnits;
      updateData.remainingUnits = statusUpdate.approvedUnits - (updateData.usedUnits || 0);
    }

    if (statusUpdate.expirationDate) {
      updateData.expirationDate = statusUpdate.expirationDate;
    }

    // Update the record
    await SecureDataAccess.update('authorizations', authorizationId, updateData, context);

    // Create status history entry
    await SecureDataAccess.create('authorizationhistory', {
      authorizationId,
      status: statusUpdate.status,
      statusDate: updateData.statusDate,
      updatedBy: 'system',
      updateSource: 'real-time-check',
      notes: statusUpdate.messages ? statusUpdate.messages.join('; ') : null,
      createdAt: new Date()
    }, context);

    // Check for notifications needed
    await this.checkStatusChangeNotifications(
      authorizationId,
      statusUpdate.status,
      context
    );
  }

  async getStatusHistory(authorizationId, context) {
    // Get status change history
    const history = await SecureDataAccess.query('authorizationhistory', {
      authorizationId,
      practiceId: context.practiceId
    }, {
      sort: { statusDate: -1 }
    }, context);

    return history.map(h => ({
      status: h.status,
      statusDescription: this.getStatusDescription(h.status),
      statusDate: h.statusDate,
      updatedBy: h.updatedBy,
      updateSource: h.updateSource,
      notes: h.notes,
      createdAt: h.createdAt
    }));
  }

  async buildTimeline(authorization, statusHistory = []) {
    const timeline = [];

    // Add submission
    timeline.push({
      event: 'submitted',
      title: 'Authorization Submitted',
      date: authorization.submittedDate,
      status: 'completed',
      description: `Submitted ${authorization.serviceCode} authorization request`
    });

    // Add status changes
    statusHistory.forEach(h => {
      timeline.push({
        event: 'status-change',
        title: `Status: ${h.statusDescription}`,
        date: h.statusDate,
        status: h.status === 'approved' ? 'completed' : 
                h.status === 'denied' ? 'failed' : 'in-progress',
        description: h.notes || `Status changed to ${h.statusDescription}`,
        updatedBy: h.updatedBy
      });
    });

    // Add expiration if approved
    if (authorization.status === 'approved' && authorization.expirationDate) {
      const isExpired = new Date() > new Date(authorization.expirationDate);
      timeline.push({
        event: 'expiration',
        title: isExpired ? 'Authorization Expired' : 'Authorization Expires',
        date: authorization.expirationDate,
        status: isExpired ? 'failed' : 'pending',
        description: `Authorization ${isExpired ? 'expired' : 'expires'} on this date`
      });
    }

    // Sort by date
    return timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async getAuthorizationDocuments(authorizationId, context) {
    // Get associated documents
    const documents = await SecureDataAccess.query('authorizationdocuments', {
      authorizationId,
      practiceId: context.practiceId
    }, {
      sort: { uploadedDate: -1 }
    }, context);

    return documents.map(doc => ({
      id: doc._id,
      type: doc.type,
      name: doc.name,
      description: doc.description,
      uploadedDate: doc.uploadedDate,
      uploadedBy: doc.uploadedBy,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      required: doc.required,
      status: doc.status
    }));
  }

  getNextActions(status, authorization) {
    const actions = [];

    switch (status) {
      case 'pending':
        actions.push({
          action: 'check-status',
          title: 'Check Status',
          description: 'Check for updates on authorization status',
          priority: 'medium'
        });
        
        if (this.isUrgent(authorization)) {
          actions.push({
            action: 'follow-up',
            title: 'Follow Up',
            description: 'Contact insurance for urgent authorization',
            priority: 'high'
          });
        }
        break;

      case 'additional-info-required':
        actions.push({
          action: 'provide-info',
          title: 'Provide Additional Information',
          description: 'Submit requested additional documentation',
          priority: 'high'
        });
        break;

      case 'approved':
        if (authorization.expirationDate) {
          const daysUntilExpiration = Math.ceil(
            (new Date(authorization.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)
          );
          
          if (daysUntilExpiration <= 30) {
            actions.push({
              action: 'renew',
              title: 'Renew Authorization',
              description: `Authorization expires in ${daysUntilExpiration} days`,
              priority: daysUntilExpiration <= 7 ? 'high' : 'medium'
            });
          }
        }
        break;

      case 'denied':
        actions.push({
          action: 'appeal',
          title: 'Submit Appeal',
          description: 'Appeal the denied authorization',
          priority: 'high'
        });
        
        actions.push({
          action: 'resubmit',
          title: 'Resubmit with Corrections',
          description: 'Submit new authorization with corrections',
          priority: 'medium'
        });
        break;

      case 'expired':
        actions.push({
          action: 'reauthorize',
          title: 'Submit New Authorization',
          description: 'Submit new authorization request',
          priority: 'high'
        });
        break;
    }

    return actions;
  }

  async checkStatusAlerts(authorization, status) {
    const alerts = [];

    // Check for expiration
    if (status === 'approved' && authorization.expirationDate) {
      const daysUntilExpiration = Math.ceil(
        (new Date(authorization.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilExpiration <= 7) {
        alerts.push({
          type: 'expiring-soon',
          severity: 'high',
          message: `Authorization expires in ${daysUntilExpiration} days`,
          expirationDate: authorization.expirationDate
        });
      } else if (daysUntilExpiration <= 30) {
        alerts.push({
          type: 'expiring-soon',
          severity: 'medium',
          message: `Authorization expires in ${daysUntilExpiration} days`,
          expirationDate: authorization.expirationDate
        });
      }
    }

    // Check for overdue status updates
    const daysSinceUpdate = Math.ceil(
      (new Date() - new Date(authorization.lastUpdated || authorization.submittedDate)) / (1000 * 60 * 60 * 24)
    );

    if (status === 'pending' && daysSinceUpdate > 14) {
      alerts.push({
        type: 'overdue-response',
        severity: 'medium',
        message: `No response for ${daysSinceUpdate} days`,
        daysSinceUpdate
      });
    }

    // Check for denied status
    if (status === 'denied') {
      alerts.push({
        type: 'authorization-denied',
        severity: 'high',
        message: 'Authorization has been denied',
        appealDeadline: this.calculateAppealDeadline(authorization.statusDate)
      });
    }

    // Check for units exhausted
    if (status === 'approved' && authorization.remainingUnits <= 0) {
      alerts.push({
        type: 'units-exhausted',
        severity: 'medium',
        message: 'All approved units have been used',
        usedUnits: authorization.usedUnits,
        approvedUnits: authorization.approvedUnits
      });
    }

    return alerts;
  }

  async checkStatusChangeNotifications(authorizationId, newStatus, context) {
    // Send notifications for important status changes
    const notificationService = require('./notificationService');
    
    const authorization = await SecureDataAccess.findById(
      'authorizations',
      authorizationId,
      context
    );

    const importantStatuses = ['approved', 'denied', 'expired', 'additional-info-required'];
    
    if (importantStatuses.includes(newStatus)) {
      await notificationService.sendNotification({
        type: 'AUTHORIZATION_STATUS_CHANGE',
        priority: newStatus === 'denied' ? 'high' : 'medium',
        patientId: authorization.patientId,
        authorizationId,
        status: newStatus,
        message: `Authorization ${authorization.authorizationNumber} status changed to ${newStatus}`,
        recipients: [authorization.requestedBy, authorization.providerId],
        practiceId: context.practiceId
      });
    }
  }

  // Utility methods
  shouldCheckRealTime(authorization) {
    const lastCheck = authorization.lastRealTimeCheck;
    if (!lastCheck) return true;
    
    // Check at most once per hour for pending authorizations
    const hoursSinceLastCheck = (Date.now() - lastCheck) / (1000 * 60 * 60);
    return hoursSinceLastCheck >= 1;
  }

  getStatusDescription(status) {
    const descriptions = {
      'submitted': 'Submitted',
      'pending': 'Pending Review',
      'in-review': 'Under Review',
      'additional-info-required': 'Additional Information Required',
      'approved': 'Approved',
      'denied': 'Denied',
      'expired': 'Expired',
      'cancelled': 'Cancelled',
      'appealed': 'Appeal Submitted',
      'appeal-approved': 'Appeal Approved',
      'appeal-denied': 'Appeal Denied'
    };
    
    return descriptions[status] || 'Unknown Status';
  }

  normalizeStatus(rawStatus) {
    // Normalize different provider status formats to standard values
    const statusMappings = {
      'A1': 'approved',
      'A2': 'partial-approval',
      'A3': 'denied',
      'A4': 'pending',
      'APPROVED': 'approved',
      'DENIED': 'denied',
      'PENDING': 'pending',
      'PEND': 'pending',
      'AUTH': 'approved'
    };
    
    return statusMappings[rawStatus?.toUpperCase()] || rawStatus?.toLowerCase() || 'unknown';
  }

  mapX12Status(code) {
    const x12StatusMap = {
      'A1': 'approved',
      'A2': 'partial-approval', 
      'A3': 'denied',
      'A4': 'pending',
      'A6': 'cancelled'
    };
    
    return x12StatusMap[code] || 'unknown';
  }

  parseX12Date(dateString) {
    // Parse X12 date format (CCYYMMDD)
    if (!dateString || dateString.length !== 8) return null;
    
    const year = dateString.substr(0, 4);
    const month = dateString.substr(4, 2);
    const day = dateString.substr(6, 2);
    
    return new Date(`${year}-${month}-${day}`);
  }

  generateX12_278_Inquiry(request, provider) {
    // Generate X12 278 authorization inquiry message
    // Simplified version - production would use proper X12 library
    const transactionId = `TXN${Date.now()}`;
    
    const segments = [
      `ST*278*${transactionId}*005010X217E1~`,
      `BHT*0007*13*${transactionId}*${new Date().toISOString().slice(0,10).replace(/-/g,'')}*${new Date().toTimeString().slice(0,5).replace(/:/g,'')}~`,
      `HL*1**20*1~`,
      `NM1*X3*2*${provider.name}*****XX*${provider.npi}~`,
      `HL*2*1*21*1~`,
      `NM1*1P*2*${provider.submitterName}*****XX*${provider.submitterNPI}~`,
      `HL*3*2*22*0~`,
      `TRN*1*${request.authorizationNumber}~`,
      `NM1*IL*1*${request.lastName}*${request.firstName}****MI*${request.memberId}~`,
      `SE*9*${transactionId}~`
    ];
    
    return segments.join('');
  }

  isUrgent(authorization) {
    return authorization.urgentStatus === 'urgent' || 
           authorization.serviceCode?.startsWith('99281'); // Emergency services
  }

  calculateAppealDeadline(denialDate) {
    // Most insurers allow 60-180 days for appeals
    const deadline = new Date(denialDate);
    deadline.setDate(deadline.getDate() + 60);
    return deadline;
  }

  async loadStatusMappings() {
    // Load status mapping configurations
    return await SecureDataAccess.query('statusmappings', { active: true });
  }

  async loadProviderAPIs() {
    // Load provider API configurations
    return await SecureDataAccess.query('providerapis', { 
      active: true,
      hasStatusEndpoint: true
    });
  }
}

module.exports = new AuthorizationStatusService();
```

### 2. Create Authorization Status API Endpoints
```javascript
// backend/routes/authorization.js

// Get authorization status
router.get('/api/authorization/:id/status', authenticate, authorize(['provider', 'nurse', 'medical-assistant']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      includeHistory = 'true',
      includeDocuments = 'false',
      includeTimeline = 'true',
      checkRealTime = 'true'
    } = req.query;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await authorizationStatusService.getAuthorizationStatus(id, {
      includeHistory: includeHistory === 'true',
      includeDocuments: includeDocuments === 'true', 
      includeTimeline: includeTimeline === 'true',
      checkRealTime: checkRealTime === 'true'
    }, context);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting authorization status:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk status check for multiple authorizations
router.post('/api/authorization/bulk-status-check', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { authorizationIds, checkRealTime = false } = req.body;

    if (!Array.isArray(authorizationIds) || authorizationIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Authorization IDs array is required'
      });
    }

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const results = await Promise.all(
      authorizationIds.map(async (id) => {
        try {
          const status = await authorizationStatusService.getAuthorizationStatus(id, {
            includeHistory: false,
            includeDocuments: false,
            includeTimeline: false,
            checkRealTime
          }, context);
          return {
            authorizationId: id,
            success: true,
            status
          };
        } catch (error) {
          return {
            authorizationId: id,
            success: false,
            error: error.message
          };
        }
      })
    );

    res.json({
      success: true,
      data: results,
      processed: results.length,
      successful: results.filter(r => r.success).length
    });
  } catch (error) {
    console.error('Error in bulk status check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk status check'
    });
  }
});

// Refresh authorization status (force real-time check)
router.post('/api/authorization/:id/refresh-status', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { id } = req.params;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await authorizationStatusService.getAuthorizationStatus(id, {
      checkRealTime: true,
      includeHistory: true,
      includeTimeline: true
    }, context);
    
    res.json({
      success: true,
      data: result,
      message: 'Status refreshed successfully'
    });
  } catch (error) {
    console.error('Error refreshing authorization status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get authorizations by status
router.get('/api/authorization/by-status/:status', authenticate, authorize(['provider', 'nurse']), async (req, res) => {
  try {
    const { status } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const authorizations = await SecureDataAccess.query('authorizations', {
      status,
      practiceId: context.practiceId
    }, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort: { lastUpdated: -1 }
    }, context);

    res.json({
      success: true,
      data: authorizations,
      count: authorizations.length,
      status
    });
  } catch (error) {
    console.error('Error getting authorizations by status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve authorizations'
    });
  }
});
```

## Required Endpoints

### GET /api/authorization/:id/status
**Description**: Get comprehensive authorization status
**Access**: Providers, Nurses, Medical Assistants
**Query Parameters**:
- `includeHistory` (boolean): Include status change history
- `includeDocuments` (boolean): Include associated documents
- `includeTimeline` (boolean): Include timeline visualization
- `checkRealTime` (boolean): Check real-time status

**Response**:
```json
{
  "success": true,
  "data": {
    "authorizationId": "60d5eca7f1b2c8b1d8e4f89a",
    "authorizationNumber": "AUTH12345",
    "status": "approved",
    "statusDescription": "Approved",
    "submittedDate": "2024-12-01T09:00:00Z",
    "lastUpdated": "2024-12-03T14:30:00Z",
    "expirationDate": "2025-03-01T23:59:59Z",
    "approvedUnits": 12,
    "usedUnits": 3,
    "remainingUnits": 9,
    "patient": {
      "id": "patient123",
      "name": "John Doe",
      "memberId": "M123456789"
    },
    "timeline": [...],
    "statusHistory": [...],
    "nextActions": [...],
    "alerts": [...]
  }
}
```

### POST /api/authorization/bulk-status-check
**Description**: Check status for multiple authorizations
**Access**: Providers, Nurses

### POST /api/authorization/:id/refresh-status
**Description**: Force real-time status check
**Access**: Providers, Nurses

### GET /api/authorization/by-status/:status
**Description**: Get all authorizations with specific status
**Access**: Providers, Nurses

## Data Models Required

### AuthorizationHistory Collection
```javascript
{
  authorizationId: ObjectId,
  status: String,
  statusDate: Date,
  updatedBy: String, // userId or 'system'
  updateSource: String, // 'manual', 'real-time-check', 'batch-update'
  notes: String,
  createdAt: Date
}
```

### AuthorizationDocuments Collection
```javascript
{
  authorizationId: ObjectId,
  type: String,
  name: String,
  description: String,
  fileUrl: String,
  uploadedDate: Date,
  uploadedBy: ObjectId,
  fileSize: Number,
  mimeType: String,
  required: Boolean,
  status: String
}
```

### StatusMappings Collection
```javascript
{
  providerId: String,
  providerStatus: String,
  normalizedStatus: String,
  description: String,
  active: Boolean
}
```

## Test Cases

### 1. Basic Status Retrieval
- Get status for existing authorization
- Verify all status fields present
- Check patient/provider information

### 2. Real-time Status Check
- Force real-time status update
- Verify API call to insurance provider
- Check status update if changed

### 3. Status History
- Create multiple status changes
- Verify history is maintained
- Check chronological order

### 4. Timeline Generation
- Build timeline from status history
- Verify milestone events included
- Check future expiration events

### 5. Status Alerts
- Test expiration warnings
- Check overdue response alerts
- Verify denial alerts

### 6. Bulk Operations
- Check multiple authorization statuses
- Verify performance acceptable
- Handle mixed success/failure

### 7. Provider API Integration
- Test X12 278 status inquiry
- Test REST API status check
- Handle API failures gracefully

## Dependencies
- SecureDataAccess service
- Insurance provider APIs
- X12 processing libraries
- Portal scraping service (optional)
- Notification service
- AuditLog for tracking

## Success Criteria
- [ ] Real-time status checking functional
- [ ] Complete status history maintained
- [ ] Timeline visualization available
- [ ] Multiple provider API support
- [ ] X12 278 transaction processing
- [ ] Status change notifications
- [ ] Alert system for important events
- [ ] Bulk status checking capability
- [ ] Document association working
- [ ] Complete audit trail maintained

## Notes
- Consider implementing Change Healthcare API
- May need RPA for portal-only providers
- Future enhancement: predictive status updates
- Consider adding mobile notifications
- May need integration with scheduling system