/**
 * Continuing Education Service - Learning Training Domain
 * Manages healthcare professional continuing education and certification tracking
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface EducationProgram {
  id: string;
  title: string;
  description: string;
  category: 'clinical' | 'compliance' | 'technology' | 'management';
  credits: number;
  duration: number; // in minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  objectives: string[];
  modules: EducationModule[];
  certificationRequired: boolean;
  expirationMonths?: number;
}

export interface EducationModule {
  id: string;
  title: string;
  content: string;
  mediaType: 'video' | 'text' | 'interactive' | 'quiz';
  duration: number;
  order: number;
}

export interface UserEnrollment {
  userId: string;
  programId: string;
  enrolledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: number; // 0-100
  score?: number;
  certificateIssued?: Date;
  expiresAt?: Date;
  status: 'enrolled' | 'in_progress' | 'completed' | 'expired';
}

@Injectable()
export class ContinuingEducationService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      this.serviceToken = await serviceAccountManager.authenticate('continuing-education-service');
      await this.initializeDefaultPrograms();
      this.initialized = true;
      console.log('✅ Continuing Education Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Continuing Education Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'continuing-education-service',
      operation: 'education_management',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  async createProgram(program: Omit<EducationProgram, 'id'>, clinicId?: string): Promise<string> {
    const context = this.getServiceContext(clinicId);
    
    const educationProgram: EducationProgram = {
      ...program,
      id: require('crypto').randomUUID()
    };

    await SecureDataAccess.insert('education_programs', {
      ...educationProgram,
      clinicId: clinicId || 'global',
      createdAt: new Date()
    }, context);

    // Log program creation
    await SecureDataAccess.insert('audit_logs', {
      action: 'EDUCATION_PROGRAM_CREATED',
      details: { programId: educationProgram.id, title: program.title },
      timestamp: new Date(),
      serviceId: 'continuing-education-service'
    }, context);

    return educationProgram.id;
  }

  async getProgram(programId: string, clinicId?: string): Promise<EducationProgram | null> {
    const context = this.getServiceContext(clinicId);
    
    const programs = await SecureDataAccess.query('education_programs', {
      id: programId,
      clinicId: clinicId || 'global'
    }, {}, context);

    return programs[0] || null;
  }

  async getAllPrograms(category?: string, clinicId?: string): Promise<EducationProgram[]> {
    const context = this.getServiceContext(clinicId);
    const query: any = { clinicId: clinicId || 'global' };
    
    if (category) {
      query.category = category;
    }

    return await SecureDataAccess.query('education_programs', query, {
      sort: { createdAt: -1 }
    }, context);
  }

  async enrollUser(userId: string, programId: string, clinicId?: string): Promise<boolean> {
    const context = this.getServiceContext(clinicId);
    
    try {
      // Check if already enrolled
      const existingEnrollments = await SecureDataAccess.query('user_enrollments', {
        userId,
        programId,
        clinicId: clinicId || 'global'
      }, {}, context);

      if (existingEnrollments.length > 0) {
        console.warn('User already enrolled in program');
        return false;
      }

      // Get program details
      const program = await this.getProgram(programId, clinicId);
      if (!program) {
        console.error('Program not found');
        return false;
      }

      // Create enrollment
      const enrollment: UserEnrollment = {
        userId,
        programId,
        enrolledAt: new Date(),
        progress: 0,
        status: 'enrolled',
        expiresAt: program.expirationMonths ? 
          new Date(Date.now() + program.expirationMonths * 30 * 24 * 60 * 60 * 1000) : 
          undefined
      };

      await SecureDataAccess.insert('user_enrollments', {
        ...enrollment,
        clinicId: clinicId || 'global',
        createdAt: new Date()
      }, context);

      // Log enrollment
      await SecureDataAccess.insert('audit_logs', {
        action: 'USER_ENROLLED',
        details: { userId, programId, programTitle: program.title },
        timestamp: new Date(),
        serviceId: 'continuing-education-service'
      }, context);

      return true;
    } catch (error) {
      console.error('Failed to enroll user:', error);
      return false;
    }
  }

  async updateProgress(userId: string, programId: string, moduleId: string, completed: boolean, clinicId?: string): Promise<boolean> {
    const context = this.getServiceContext(clinicId);
    
    try {
      const enrollment = await this.getUserEnrollment(userId, programId, clinicId);
      if (!enrollment) {
        console.error('Enrollment not found');
        return false;
      }

      const program = await this.getProgram(programId, clinicId);
      if (!program) {
        console.error('Program not found');
        return false;
      }

      // Calculate new progress
      const completedModules = completed ? 1 : 0; // Simplified calculation
      const newProgress = Math.min((completedModules / program.modules.length) * 100, 100);
      
      const updateData: any = {
        progress: newProgress,
        updatedAt: new Date()
      };

      // Update status based on progress
      if (enrollment.status === 'enrolled' && newProgress > 0) {
        updateData.status = 'in_progress';
        updateData.startedAt = new Date();
      }

      if (newProgress >= 100) {
        updateData.status = 'completed';
        updateData.completedAt = new Date();
        
        // Issue certificate if required
        if (program.certificationRequired) {
          updateData.certificateIssued = new Date();
        }
      }

      await SecureDataAccess.update('user_enrollments', {
        userId,
        programId,
        clinicId: clinicId || 'global'
      }, { $set: updateData }, context);

      return true;
    } catch (error) {
      console.error('Failed to update progress:', error);
      return false;
    }
  }

  async getUserEnrollment(userId: string, programId: string, clinicId?: string): Promise<UserEnrollment | null> {
    const context = this.getServiceContext(clinicId);
    
    const enrollments = await SecureDataAccess.query('user_enrollments', {
      userId,
      programId,
      clinicId: clinicId || 'global'
    }, {}, context);

    return enrollments[0] || null;
  }

  async getUserEnrollments(userId: string, clinicId?: string): Promise<UserEnrollment[]> {
    const context = this.getServiceContext(clinicId);
    
    return await SecureDataAccess.query('user_enrollments', {
      userId,
      clinicId: clinicId || 'global'
    }, {
      sort: { enrolledAt: -1 }
    }, context);
  }

  async getExpiringCertifications(daysAhead: number = 30, clinicId?: string): Promise<UserEnrollment[]> {
    const context = this.getServiceContext(clinicId);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return await SecureDataAccess.query('user_enrollments', {
      status: 'completed',
      certificateIssued: { $exists: true },
      expiresAt: {
        $lte: futureDate,
        $gte: new Date()
      },
      clinicId: clinicId || 'global'
    }, {
      sort: { expiresAt: 1 }
    }, context);
  }

  async generateEducationReport(userId?: string, clinicId?: string): Promise<any> {
    const context = this.getServiceContext(clinicId);
    const query: any = { clinicId: clinicId || 'global' };
    
    if (userId) {
      query.userId = userId;
    }

    const enrollments = await SecureDataAccess.query('user_enrollments', query, {}, context);
    const programs = await this.getAllPrograms(undefined, clinicId);

    const report = {
      totalEnrollments: enrollments.length,
      completedPrograms: enrollments.filter(e => e.status === 'completed').length,
      inProgressPrograms: enrollments.filter(e => e.status === 'in_progress').length,
      averageProgress: enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length || 0,
      certificatesIssued: enrollments.filter(e => e.certificateIssued).length,
      expiringCertifications: (await this.getExpiringCertifications(30, clinicId)).length,
      programsByCategory: {} as Record<string, number>,
      completionRate: 0
    };

    // Group programs by category
    for (const program of programs) {
      report.programsByCategory[program.category] = (report.programsByCategory[program.category] || 0) + 1;
    }

    // Calculate completion rate
    report.completionRate = report.totalEnrollments > 0 ? 
      Math.round((report.completedPrograms / report.totalEnrollments) * 100) : 0;

    return report;
  }

  private async initializeDefaultPrograms() {
    const defaultPrograms: Omit<EducationProgram, 'id'>[] = [
      {
        title: 'HIPAA Privacy and Security Training',
        description: 'Comprehensive training on HIPAA privacy and security requirements for healthcare professionals',
        category: 'compliance',
        credits: 2,
        duration: 120,
        difficulty: 'intermediate',
        prerequisites: [],
        objectives: [
          'Understand HIPAA privacy rules',
          'Implement security safeguards',
          'Handle patient data appropriately'
        ],
        modules: [
          {
            id: 'module1',
            title: 'Introduction to HIPAA',
            content: 'Overview of HIPAA regulations',
            mediaType: 'video',
            duration: 30,
            order: 1
          },
          {
            id: 'module2',
            title: 'Privacy Requirements',
            content: 'HIPAA privacy requirements',
            mediaType: 'interactive',
            duration: 45,
            order: 2
          },
          {
            id: 'module3',
            title: 'Security Safeguards',
            content: 'Technical and administrative safeguards',
            mediaType: 'text',
            duration: 30,
            order: 3
          },
          {
            id: 'quiz1',
            title: 'HIPAA Knowledge Check',
            content: 'Test your HIPAA knowledge',
            mediaType: 'quiz',
            duration: 15,
            order: 4
          }
        ],
        certificationRequired: true,
        expirationMonths: 12
      }
    ];

    for (const program of defaultPrograms) {
      try {
        await this.createProgram(program);
      } catch (error) {
        console.warn('Could not create default program:', program.title);
      }
    }
  }
}