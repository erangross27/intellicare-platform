// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PolicyManagementService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('policy-management-service');
    this.initialized = true;
  }

  async createPolicy(policyData, context) {
    await this.initialize();

    const policy = {
      id: `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: policyData.title,
      description: policyData.description,
      category: policyData.category, // clinical, administrative, safety, compliance
      type: policyData.type, // policy, procedure, guideline, protocol
      content: policyData.content,
      version: '1.0',
      status: 'draft',
      effectiveDate: policyData.effectiveDate ? new Date(policyData.effectiveDate) : null,
      expirationDate: policyData.expirationDate ? new Date(policyData.expirationDate) : null,
      reviewDate: policyData.reviewDate ? new Date(policyData.reviewDate) : null,
      approvalRequired: policyData.approvalRequired !== false,
      approvers: policyData.approvers || [],
      approvals: [],
      tags: policyData.tags || [],
      attachments: policyData.attachments || [],
      relatedPolicies: policyData.relatedPolicies || [],
      language: policyData.language || 'en',
      createdBy: context.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      practiceId: context.practiceId
    };

    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    const AuditLog = proxy.getService('auditLog');

    await SecureDataAccess.create('policies', policy, {
      serviceId: 'policy-management-service',
      operation: 'create-policy',
      practiceId: context.practiceId
    });

    await AuditLog.create({
      action: 'CREATE_POLICY',
      resourceType: 'policy',
      resourceId: policy.id,
      userId: context.userId,
      practiceId: context.practiceId,
      details: { title: policy.title, category: policy.category },
      timestamp: new Date()
    });

    return policy;
  }

  async updatePolicy(policyId, updates, context) {
    await this.initialize();

    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    const AuditLog = proxy.getService('auditLog');

    const existingPolicy = await SecureDataAccess.query('policies', { id: policyId }, {}, {
      serviceId: 'policy-management-service',
      operation: 'find-policy',
      practiceId: context.practiceId
    });

    if (!existingPolicy || existingPolicy.length === 0) {
      throw new Error('Policy not found');
    }

    const policy = existingPolicy[0];

    // Create version history entry
    const versionHistory = {
      id: `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      policyId: policyId,
      version: policy.version,
      content: policy.content,
      updatedBy: policy.updatedBy || policy.createdBy,
      updatedAt: policy.updatedAt,
      changeReason: updates.changeReason || 'Policy update',
      practiceId: context.practiceId
    };

    await SecureDataAccess.create('policy_versions', versionHistory, {
      serviceId: 'policy-management-service',
      operation: 'create-policy-version',
      practiceId: context.practiceId
    });

    // Update policy with new version
    const newVersion = this.incrementVersion(policy.version);
    const updatedPolicy = {
      ...updates,
      version: newVersion,
      status: updates.status || 'draft',
      updatedBy: context.userId,
      updatedAt: new Date(),
      approvals: updates.content ? [] : policy.approvals // Reset approvals if content changed
    };

    await SecureDataAccess.update('policies', { id: policyId }, updatedPolicy, {
      serviceId: 'policy-management-service',
      operation: 'update-policy',
      practiceId: context.practiceId
    });

    await AuditLog.create({
      action: 'UPDATE_POLICY',
      resourceType: 'policy',
      resourceId: policyId,
      userId: context.userId,
      practiceId: context.practiceId,
      details: { 
        version: newVersion, 
        changeReason: updates.changeReason,
        fieldsUpdated: Object.keys(updates)
      },
      timestamp: new Date()
    });

    return { ...policy, ...updatedPolicy };
  }

  async approvePolicy(policyId, approvalData, context) {
    await this.initialize();

    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    const AuditLog = proxy.getService('auditLog');

    const policyResults = await SecureDataAccess.query('policies', { id: policyId }, {}, {
      serviceId: 'policy-management-service',
      operation: 'find-policy',
      practiceId: context.practiceId
    });

    if (!policyResults || policyResults.length === 0) {
      throw new Error('Policy not found');
    }

    const policy = policyResults[0];

    const approval = {
      approverId: context.userId,
      approverName: approvalData.approverName,
      approverRole: approvalData.approverRole,
      decision: approvalData.decision, // approved, rejected, conditional
      comments: approvalData.comments || '',
      conditions: approvalData.conditions || [],
      approvedAt: new Date()
    };

    const updatedApprovals = [...(policy.approvals || []), approval];
    
    // Check if all required approvers have approved
    const allApproved = policy.approvers.every(approverId => 
      updatedApprovals.some(app => app.approverId === approverId && app.decision === 'approved')
    );

    const updates = {
      approvals: updatedApprovals,
      status: allApproved ? 'approved' : policy.status,
      approvedAt: allApproved ? new Date() : policy.approvedAt
    };

    await SecureDataAccess.update('policies', { id: policyId }, updates, {
      serviceId: 'policy-management-service',
      operation: 'approve-policy',
      practiceId: context.practiceId
    });

    await AuditLog.create({
      action: 'APPROVE_POLICY',
      resourceType: 'policy',
      resourceId: policyId,
      userId: context.userId,
      practiceId: context.practiceId,
      details: { 
        decision: approvalData.decision,
        allApproved: allApproved,
        comments: approvalData.comments
      },
      timestamp: new Date()
    });

    return { ...policy, ...updates };
  }

  async publishPolicy(policyId, context) {
    await this.initialize();

    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    const AuditLog = proxy.getService('auditLog');

    const policyResults = await SecureDataAccess.query('policies', { id: policyId }, {}, {
      serviceId: 'policy-management-service',
      operation: 'find-policy',
      practiceId: context.practiceId
    });

    if (!policyResults || policyResults.length === 0) {
      throw new Error('Policy not found');
    }

    const policy = policyResults[0];

    if (policy.approvalRequired && policy.status !== 'approved') {
      throw new Error('Policy must be approved before publishing');
    }

    const updates = {
      status: 'published',
      publishedAt: new Date(),
      publishedBy: context.userId,
      effectiveDate: policy.effectiveDate || new Date()
    };

    await SecureDataAccess.update('policies', { id: policyId }, updates, {
      serviceId: 'policy-management-service',
      operation: 'publish-policy',
      practiceId: context.practiceId
    });

    // Create distribution records for all staff
    await this.createPolicyDistribution(policyId, {
      targetGroup: 'all_staff',
      distributionDate: new Date(),
      acknowledgmentRequired: true
    }, context);

    await AuditLog.create({
      action: 'PUBLISH_POLICY',
      resourceType: 'policy',
      resourceId: policyId,
      userId: context.userId,
      practiceId: context.practiceId,
      details: { title: policy.title, effectiveDate: updates.effectiveDate },
      timestamp: new Date()
    });

    return { ...policy, ...updates };
  }

  async createPolicyDistribution(policyId, distributionData, context) {
    await this.initialize();

    const distribution = {
      id: `dist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      policyId: policyId,
      targetGroup: distributionData.targetGroup, // all_staff, role_based, individual
      targetUsers: distributionData.targetUsers || [],
      targetRoles: distributionData.targetRoles || [],
      distributionDate: distributionData.distributionDate || new Date(),
      acknowledgmentRequired: distributionData.acknowledgmentRequired !== false,
      acknowledgmentDeadline: distributionData.acknowledgmentDeadline,
      distributionMethod: distributionData.distributionMethod || 'system_notification',
      status: 'distributed',
      createdBy: context.userId,
      createdAt: new Date(),
      practiceId: context.practiceId
    };

    await SecureDataAccess.create('policy_distributions', distribution, {
      serviceId: 'policy-management-service',
      operation: 'create-policy-distribution',
      practiceId: context.practiceId
    });

    await AuditLog.create({
      action: 'CREATE_POLICY_DISTRIBUTION',
      resourceType: 'policy_distribution',
      resourceId: distribution.id,
      userId: context.userId,
      practiceId: context.practiceId,
      details: { policyId, targetGroup: distributionData.targetGroup },
      timestamp: new Date()
    });

    return distribution;
  }

  async acknowledgePolicyDistribution(distributionId, acknowledgmentData, context) {
    await this.initialize();

    const acknowledgment = {
      id: `ack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      distributionId: distributionId,
      userId: context.userId,
      acknowledgedAt: new Date(),
      method: acknowledgmentData.method || 'electronic',
      comments: acknowledgmentData.comments || '',
      understood: acknowledgmentData.understood !== false,
      practiceId: context.practiceId
    };

    await SecureDataAccess.create('policy_acknowledgments', acknowledgment, {
      serviceId: 'policy-management-service',
      operation: 'create-policy-acknowledgment',
      practiceId: context.practiceId
    });

    await AuditLog.create({
      action: 'ACKNOWLEDGE_POLICY',
      resourceType: 'policy_acknowledgment',
      resourceId: acknowledgment.id,
      userId: context.userId,
      practiceId: context.practiceId,
      details: { distributionId, understood: acknowledgmentData.understood },
      timestamp: new Date()
    });

    return acknowledgment;
  }

  async searchPolicies(searchParams, context) {
    await this.initialize();

    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');

    const filter = {
      practiceId: context.practiceId,
      status: 'published',
      ...(searchParams.category && { category: searchParams.category }),
      ...(searchParams.type && { type: searchParams.type }),
      ...(searchParams.tags && { tags: { $in: searchParams.tags } }),
      ...(searchParams.effectiveFrom && { 
        effectiveDate: { $gte: new Date(searchParams.effectiveFrom) } 
      }),
      ...(searchParams.effectiveTo && { 
        effectiveDate: { $lte: new Date(searchParams.effectiveTo) } 
      })
    };

    // Text search
    if (searchParams.query) {
      filter.$or = [
        { title: { $regex: searchParams.query, $options: 'i' } },
        { description: { $regex: searchParams.query, $options: 'i' } },
        { content: { $regex: searchParams.query, $options: 'i' } },
        { tags: { $regex: searchParams.query, $options: 'i' } }
      ];
    }

    const policies = await SecureDataAccess.query('policies', filter, {
      sort: { updatedAt: -1 },
      limit: searchParams.limit || 50,
      skip: searchParams.offset || 0
    }, {
      serviceId: 'policy-management-service',
      operation: 'search-policies',
      practiceId: context.practiceId
    });

    const totalCount = await SecureDataAccess.count('policies', filter, {
      serviceId: 'policy-management-service',
      operation: 'count-policies',
      practiceId: context.practiceId
    });

    return {
      policies,
      totalCount,
      searchParams,
      searchedAt: new Date()
    };
  }

  async getPolicyComplianceReport(reportParams, context) {
    await this.initialize();

    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    const AuditLog = proxy.getService('auditLog');

    const filter = {
      practiceId: context.practiceId,
      ...(reportParams.startDate && { distributionDate: { $gte: new Date(reportParams.startDate) } }),
      ...(reportParams.endDate && { distributionDate: { $lte: new Date(reportParams.endDate) } }),
      ...(reportParams.policyIds && { policyId: { $in: reportParams.policyIds } })
    };

    const distributions = await SecureDataAccess.query('policy_distributions', filter, {}, {
      serviceId: 'policy-management-service',
      operation: 'query-policy-distributions',
      practiceId: context.practiceId
    });

    const acknowledgments = await SecureDataAccess.query('policy_acknowledgments', {
      practiceId: context.practiceId,
      ...(reportParams.startDate && { acknowledgedAt: { $gte: new Date(reportParams.startDate) } }),
      ...(reportParams.endDate && { acknowledgedAt: { $lte: new Date(reportParams.endDate) } })
    }, {}, {
      serviceId: 'policy-management-service',
      operation: 'query-policy-acknowledgments',
      practiceId: context.practiceId
    });

    const policies = await SecureDataAccess.query('policies', {
      practiceId: context.practiceId,
      status: 'published'
    }, {}, {
      serviceId: 'policy-management-service',
      operation: 'query-published-policies',
      practiceId: context.practiceId
    });

    const report = {
      id: `compliance_report_${Date.now()}`,
      generatedAt: new Date(),
      reportType: 'policy_compliance',
      parameters: reportParams,
      summary: {
        totalPolicies: policies.length,
        totalDistributions: distributions.length,
        totalAcknowledgments: acknowledgments.length,
        overallComplianceRate: this.calculateOverallComplianceRate(distributions, acknowledgments),
        overdueAcknowledgments: this.countOverdueAcknowledgments(distributions, acknowledgments)
      },
      policyCompliance: this.calculatePolicyWiseCompliance(distributions, acknowledgments, policies),
      userCompliance: this.calculateUserWiseCompliance(distributions, acknowledgments),
      trends: this.calculateComplianceTrends(distributions, acknowledgments),
      generatedBy: context.userId,
      practiceId: context.practiceId
    };

    await AuditLog.create({
      action: 'GENERATE_COMPLIANCE_REPORT',
      resourceType: 'compliance_report',
      resourceId: report.id,
      userId: context.userId,
      practiceId: context.practiceId,
      details: { reportType: 'policy_compliance' },
      timestamp: new Date()
    });

    return report;
  }

  async schedulePolicyReview(policyId, reviewData, context) {
    await this.initialize();

    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    const AuditLog = proxy.getService('auditLog');

    const policyResults = await SecureDataAccess.query('policies', { id: policyId }, {}, {
      serviceId: 'policy-management-service',
      operation: 'find-policy',
      practiceId: context.practiceId
    });

    if (!policyResults || policyResults.length === 0) {
      throw new Error('Policy not found');
    }

    const policy = policyResults[0];

    const review = {
      id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      policyId: policyId,
      reviewType: reviewData.reviewType || 'scheduled', // scheduled, ad_hoc, triggered
      scheduledDate: new Date(reviewData.scheduledDate),
      assignedReviewers: reviewData.assignedReviewers || [],
      reviewCriteria: reviewData.reviewCriteria || [],
      priority: reviewData.priority || 'medium',
      reminderSchedule: reviewData.reminderSchedule || [30, 14, 7, 1], // days before
      status: 'scheduled',
      createdBy: context.userId,
      createdAt: new Date(),
      practiceId: context.practiceId
    };

    await SecureDataAccess.create('policy_reviews', review, {
      serviceId: 'policy-management-service',
      operation: 'create-policy-review',
      practiceId: context.practiceId
    });

    // Update policy with next review date
    await SecureDataAccess.update('policies', { id: policyId }, {
      nextReviewDate: reviewData.scheduledDate
    }, {
      serviceId: 'policy-management-service',
      operation: 'update-policy-review-date',
      practiceId: context.practiceId
    });

    await AuditLog.create({
      action: 'SCHEDULE_POLICY_REVIEW',
      resourceType: 'policy_review',
      resourceId: review.id,
      userId: context.userId,
      practiceId: context.practiceId,
      details: { policyId, scheduledDate: reviewData.scheduledDate },
      timestamp: new Date()
    });

    return review;
  }

  // Helper methods
  incrementVersion(currentVersion) {
    const parts = currentVersion.split('.');
    const major = parseInt(parts[0]);
    const minor = parseInt(parts[1]) + 1;
    return `${major}.${minor}`;
  }

  calculateOverallComplianceRate(distributions, acknowledgments) {
    if (distributions.length === 0) return 100;
    
    const requiredAcks = distributions.filter(d => d.acknowledgmentRequired).length;
    const receivedAcks = acknowledgments.length;
    
    return requiredAcks > 0 ? Math.round((receivedAcks / requiredAcks) * 100) : 100;
  }

  countOverdueAcknowledgments(distributions, acknowledgments) {
    const now = new Date();
    const acknowledgedDistributions = new Set(acknowledgments.map(a => a.distributionId));
    
    return distributions.filter(d => 
      d.acknowledgmentRequired &&
      d.acknowledgmentDeadline &&
      d.acknowledgmentDeadline < now &&
      !acknowledgedDistributions.has(d.id)
    ).length;
  }

  calculatePolicyWiseCompliance(distributions, acknowledgments, policies) {
    const policyStats = {};
    
    policies.forEach(policy => {
      const policyDistributions = distributions.filter(d => d.policyId === policy.id);
      const policyAcknowledgments = acknowledgments.filter(a => 
        policyDistributions.some(d => d.id === a.distributionId)
      );
      
      const requiredAcks = policyDistributions.filter(d => d.acknowledgmentRequired).length;
      const receivedAcks = policyAcknowledgments.length;
      
      policyStats[policy.id] = {
        policyTitle: policy.title,
        totalDistributions: policyDistributions.length,
        requiredAcknowledgments: requiredAcks,
        receivedAcknowledgments: receivedAcks,
        complianceRate: requiredAcks > 0 ? Math.round((receivedAcks / requiredAcks) * 100) : 100
      };
    });
    
    return policyStats;
  }

  calculateUserWiseCompliance(distributions, acknowledgments) {
    const userStats = {};
    const userAcks = acknowledgments.reduce((acc, ack) => {
      acc[ack.userId] = (acc[ack.userId] || 0) + 1;
      return acc;
    }, {});
    
    // This would need additional user data to be fully implemented
    return userAcks;
  }

  calculateComplianceTrends(distributions, acknowledgments) {
    // Calculate monthly compliance trends
    const monthlyStats = {};
    
    acknowledgments.forEach(ack => {
      const monthKey = ack.acknowledgedAt.toISOString().substring(0, 7); // YYYY-MM
      monthlyStats[monthKey] = (monthlyStats[monthKey] || 0) + 1;
    });
    
    return monthlyStats;
  }
}

// Create and export singleton
const policyManagementService = new PolicyManagementService();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('policyManagementService', () => policyManagementService);
}

module.exports = policyManagementService;