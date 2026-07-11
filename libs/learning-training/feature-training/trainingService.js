const SecureDataAccess = require('../../compliance-security/feature-data-access/secureDataAccess');
const serviceAccountManager = require('../../../backend/services/serviceAccountManager');

class TrainingService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    this.serviceToken = await serviceAccountManager.authenticate('training-service');
    this.initialized = true;
  }

  async createTrainingProgram(programData, context) {
    await this.initialize();

    const program = {
      id: `training_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: programData.title,
      description: programData.description,
      type: programData.type, // clinical, regulatory, safety, orientation
      category: programData.category,
      duration: programData.duration,
      modules: programData.modules || [],
      requirements: programData.requirements || [],
      certifications: programData.certifications || [],
      language: programData.language || 'en',
      status: 'draft',
      createdBy: context.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      practiceId: context.practiceId
    };

    await SecureDataAccess.insert('training_programs', program, {
      serviceId: 'training-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId
    });

    await AuditLog.create({
      action: 'CREATE_TRAINING_PROGRAM',
      resourceType: 'training_program',
      resourceId: program.id,
      userId: context.userId,
      practiceId: context.practiceId,
      details: { title: program.title, type: program.type },
      timestamp: new Date()
    });

    return program;
  }

  async enrollInTraining(enrollmentData, context) {
    await this.initialize();

    const enrollment = {
      id: `enrollment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      programId: enrollmentData.programId,
      userId: enrollmentData.userId,
      status: 'enrolled',
      startDate: new Date(),
      dueDate: enrollmentData.dueDate,
      progress: 0,
      completedModules: [],
      assessmentScores: {},
      enrolledBy: context.userId,
      practiceId: context.practiceId
    };

    await SecureDataAccess.insert('training_enrollments', enrollment, {
      serviceId: 'training-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId
    });

    await AuditLog.create({
      action: 'ENROLL_TRAINING',
      resourceType: 'training_enrollment',
      resourceId: enrollment.id,
      userId: context.userId,
      targetUserId: enrollmentData.userId,
      practiceId: context.practiceId,
      details: { programId: enrollmentData.programId },
      timestamp: new Date()
    });

    return enrollment;
  }

  async updateTrainingProgress(progressData, context) {
    await this.initialize();

    const enrollment = await SecureDataAccess.findById('training_enrollments', progressData.enrollmentId, {
      serviceId: 'training-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId
    });

    if (!enrollment) {
      throw new Error('Training enrollment not found');
    }

    const updates = {
      progress: progressData.progress,
      lastActivity: new Date(),
      completedModules: progressData.completedModules || enrollment.completedModules,
      assessmentScores: { ...enrollment.assessmentScores, ...progressData.assessmentScores }
    };

    if (progressData.progress >= 100) {
      updates.status = 'completed';
      updates.completedDate = new Date();
    }

    await SecureDataAccess.updateById('training_enrollments', progressData.enrollmentId, updates, {
      serviceId: 'training-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId
    });

    await AuditLog.create({
      action: 'UPDATE_TRAINING_PROGRESS',
      resourceType: 'training_enrollment',
      resourceId: progressData.enrollmentId,
      userId: context.userId,
      practiceId: context.practiceId,
      details: { progress: progressData.progress },
      timestamp: new Date()
    });

    return { ...enrollment, ...updates };
  }

  async trackCertification(certData, context) {
    await this.initialize();

    const certification = {
      id: `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: certData.userId,
      type: certData.type, // license, board_cert, cme, training
      name: certData.name,
      issuingOrganization: certData.issuingOrganization,
      certificationNumber: certData.certificationNumber,
      issueDate: new Date(certData.issueDate),
      expirationDate: new Date(certData.expirationDate),
      status: 'active',
      documents: certData.documents || [],
      credits: certData.credits || 0,
      requirements: certData.requirements || [],
      addedBy: context.userId,
      practiceId: context.practiceId
    };

    await SecureDataAccess.insert('certifications', certification, {
      serviceId: 'training-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId
    });

    await AuditLog.create({
      action: 'TRACK_CERTIFICATION',
      resourceType: 'certification',
      resourceId: certification.id,
      userId: context.userId,
      targetUserId: certData.userId,
      practiceId: context.practiceId,
      details: { type: certData.type, name: certData.name },
      timestamp: new Date()
    });

    return certification;
  }

  async scheduleMandatoryTraining(scheduleData, context) {
    await this.initialize();

    const schedule = {
      id: `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      programId: scheduleData.programId,
      targetGroup: scheduleData.targetGroup, // all_staff, role_based, individual
      targetUsers: scheduleData.targetUsers || [],
      targetRoles: scheduleData.targetRoles || [],
      dueDate: new Date(scheduleData.dueDate),
      priority: scheduleData.priority || 'medium',
      reminderSchedule: scheduleData.reminderSchedule || [7, 3, 1], // days before due
      consequences: scheduleData.consequences || {},
      createdBy: context.userId,
      createdAt: new Date(),
      practiceId: context.practiceId
    };

    await SecureDataAccess.insert('mandatory_training_schedules', schedule, {
      serviceId: 'training-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId
    });

    // Auto-enroll target users
    if (scheduleData.targetUsers && scheduleData.targetUsers.length > 0) {
      for (const userId of scheduleData.targetUsers) {
        await this.enrollInTraining({
          programId: scheduleData.programId,
          userId: userId,
          dueDate: scheduleData.dueDate
        }, context);
      }
    }

    await AuditLog.create({
      action: 'SCHEDULE_MANDATORY_TRAINING',
      resourceType: 'mandatory_training_schedule',
      resourceId: schedule.id,
      userId: context.userId,
      practiceId: context.practiceId,
      details: { programId: scheduleData.programId, targetGroup: scheduleData.targetGroup },
      timestamp: new Date()
    });

    return schedule;
  }

  async generateTrainingReport(reportParams, context) {
    await this.initialize();

    const filter = {
      practiceId: context.practiceId,
      ...(reportParams.startDate && { createdAt: { $gte: new Date(reportParams.startDate) } }),
      ...(reportParams.endDate && { createdAt: { $lte: new Date(reportParams.endDate) } }),
      ...(reportParams.programType && { type: reportParams.programType }),
      ...(reportParams.userId && { userId: reportParams.userId })
    };

    const enrollments = await SecureDataAccess.query('training_enrollments', filter, {}, {
      serviceId: 'training-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId
    });

    const programs = await SecureDataAccess.query('training_programs', { practiceId: context.practiceId }, {}, {
      serviceId: 'training-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId
    });

    const certifications = await SecureDataAccess.query('certifications', filter, {}, {
      serviceId: 'training-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId
    });

    const report = {
      id: `report_${Date.now()}`,
      generatedAt: new Date(),
      reportType: 'training_summary',
      parameters: reportParams,
      summary: {
        totalEnrollments: enrollments.length,
        completedTraining: enrollments.filter(e => e.status === 'completed').length,
        inProgressTraining: enrollments.filter(e => e.status === 'enrolled').length,
        overdueTraining: enrollments.filter(e => e.dueDate < new Date() && e.status !== 'completed').length,
        totalPrograms: programs.length,
        activeCertifications: certifications.filter(c => c.status === 'active').length,
        expiringCertifications: certifications.filter(c => 
          c.expirationDate && 
          c.expirationDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        ).length
      },
      details: {
        enrollments,
        programs: programs.map(p => ({
          id: p.id,
          title: p.title,
          type: p.type,
          enrollmentCount: enrollments.filter(e => e.programId === p.id).length,
          completionRate: this.calculateCompletionRate(p.id, enrollments)
        })),
        certifications: certifications.map(c => ({
          id: c.id,
          type: c.type,
          name: c.name,
          status: c.status,
          expirationDate: c.expirationDate,
          daysToExpiration: c.expirationDate ? 
            Math.ceil((c.expirationDate - new Date()) / (24 * 60 * 60 * 1000)) : null
        }))
      },
      generatedBy: context.userId,
      practiceId: context.practiceId
    };

    await AuditLog.create({
      action: 'GENERATE_TRAINING_REPORT',
      resourceType: 'training_report',
      resourceId: report.id,
      userId: context.userId,
      practiceId: context.practiceId,
      details: { reportType: 'training_summary' },
      timestamp: new Date()
    });

    return report;
  }

  calculateCompletionRate(programId, enrollments) {
    const programEnrollments = enrollments.filter(e => e.programId === programId);
    if (programEnrollments.length === 0) return 0;
    
    const completed = programEnrollments.filter(e => e.status === 'completed').length;
    return Math.round((completed / programEnrollments.length) * 100);
  }

  async checkExpiringCertifications(context) {
    await this.initialize();

    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const expiringCerts = await SecureDataAccess.query('certifications', {
      practiceId: context.practiceId,
      expirationDate: { $lte: thirtyDaysFromNow },
      status: 'active'
    }, {}, {
      serviceId: 'training-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId
    });

    const alerts = expiringCerts.map(cert => {
      const daysToExpiration = Math.ceil((cert.expirationDate - new Date()) / (24 * 60 * 60 * 1000));
      
      return {
        id: `alert_${cert.id}`,
        type: 'certification_expiring',
        priority: daysToExpiration <= 7 ? 'high' : 'medium',
        userId: cert.userId,
        certificationId: cert.id,
        certificationName: cert.name,
        expirationDate: cert.expirationDate,
        daysToExpiration,
        message: {
          he: `האישור "${cert.name}" יפוג בעוד ${daysToExpiration} ימים`,
          en: `Certification "${cert.name}" expires in ${daysToExpiration} days`
        },
        createdAt: new Date()
      };
    });

    return alerts;
  }

  async createTrainingModule(moduleData, context) {
    await this.initialize();

    const module = {
      id: `module_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      programId: moduleData.programId,
      title: moduleData.title,
      description: moduleData.description,
      type: moduleData.type, // video, document, interactive, assessment
      content: moduleData.content,
      duration: moduleData.duration,
      order: moduleData.order || 1,
      required: moduleData.required !== false,
      passingScore: moduleData.passingScore || 80,
      resources: moduleData.resources || [],
      assessments: moduleData.assessments || [],
      language: moduleData.language || 'en',
      createdBy: context.userId,
      createdAt: new Date(),
      practiceId: context.practiceId
    };

    await SecureDataAccess.insert('training_modules', module, {
      serviceId: 'training-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId
    });

    await AuditLog.create({
      action: 'CREATE_TRAINING_MODULE',
      resourceType: 'training_module',
      resourceId: module.id,
      userId: context.userId,
      practiceId: context.practiceId,
      details: { title: module.title, type: module.type },
      timestamp: new Date()
    });

    return module;
  }

  async recordTrainingAttendance(attendanceData, context) {
    await this.initialize();

    const attendance = {
      id: `attendance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: attendanceData.sessionId,
      userId: attendanceData.userId,
      programId: attendanceData.programId,
      moduleId: attendanceData.moduleId,
      attendanceType: attendanceData.attendanceType, // in_person, virtual, self_paced
      startTime: new Date(attendanceData.startTime),
      endTime: attendanceData.endTime ? new Date(attendanceData.endTime) : null,
      duration: attendanceData.duration || 0,
      completionStatus: attendanceData.completionStatus || 'in_progress',
      notes: attendanceData.notes || '',
      recordedBy: context.userId,
      practiceId: context.practiceId
    };

    await SecureDataAccess.insert('training_attendance', attendance, {
      serviceId: 'training-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId
    });

    await AuditLog.create({
      action: 'RECORD_TRAINING_ATTENDANCE',
      resourceType: 'training_attendance',
      resourceId: attendance.id,
      userId: context.userId,
      targetUserId: attendanceData.userId,
      practiceId: context.practiceId,
      details: { programId: attendanceData.programId },
      timestamp: new Date()
    });

    return attendance;
  }

  async getTrainingDashboard(userId, context) {
    await this.initialize();

    const enrollments = await SecureDataAccess.query('training_enrollments', {
      userId: userId,
      practiceId: context.practiceId
    }, {}, {
      serviceId: 'training-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId
    });

    const certifications = await SecureDataAccess.query('certifications', {
      userId: userId,
      practiceId: context.practiceId
    }, {}, {
      serviceId: 'training-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: context.practiceId
    });

    const upcomingDeadlines = [
      ...enrollments.filter(e => e.dueDate && e.status !== 'completed')
        .map(e => ({
          type: 'training',
          id: e.id,
          title: e.programId,
          dueDate: e.dueDate,
          priority: e.dueDate < new Date() ? 'high' : 'medium'
        })),
      ...certifications.filter(c => c.expirationDate && c.status === 'active')
        .map(c => ({
          type: 'certification',
          id: c.id,
          title: c.name,
          dueDate: c.expirationDate,
          priority: c.expirationDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'high' : 'medium'
        }))
    ].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const dashboard = {
      userId,
      summary: {
        totalEnrollments: enrollments.length,
        completedTraining: enrollments.filter(e => e.status === 'completed').length,
        inProgressTraining: enrollments.filter(e => e.status === 'enrolled').length,
        overdueTraining: enrollments.filter(e => e.dueDate < new Date() && e.status !== 'completed').length,
        activeCertifications: certifications.filter(c => c.status === 'active').length,
        expiringCertifications: certifications.filter(c => 
          c.expirationDate && 
          c.expirationDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        ).length
      },
      recentActivity: enrollments
        .filter(e => e.lastActivity)
        .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
        .slice(0, 5),
      upcomingDeadlines: upcomingDeadlines.slice(0, 10),
      completionStats: {
        averageScore: this.calculateAverageScore(enrollments),
        completionRate: this.calculateUserCompletionRate(enrollments),
        totalHours: this.calculateTotalTrainingHours(enrollments)
      },
      generatedAt: new Date()
    };

    return dashboard;
  }

  calculateAverageScore(enrollments) {
    const scores = enrollments
      .filter(e => e.assessmentScores && Object.keys(e.assessmentScores).length > 0)
      .map(e => Object.values(e.assessmentScores))
      .flat()
      .filter(score => typeof score === 'number');
    
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  calculateUserCompletionRate(enrollments) {
    if (enrollments.length === 0) return 0;
    const completed = enrollments.filter(e => e.status === 'completed').length;
    return Math.round((completed / enrollments.length) * 100);
  }

  calculateTotalTrainingHours(enrollments) {
    return enrollments.reduce((total, e) => {
      return total + (e.duration || 0);
    }, 0);
  }
}

module.exports = new TrainingService();