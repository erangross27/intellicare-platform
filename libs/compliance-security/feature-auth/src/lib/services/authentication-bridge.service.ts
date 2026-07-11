/**
 * Authentication Bridge Service - Compliance Security Domain
 * Bridges different authentication systems and maintains session consistency
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface SessionContext {
  userId: string;
  clinicId: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  expiresAt: Date;
}

@Injectable()
export class AuthenticationBridgeService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;
  private activeSessions = new Map<string, SessionContext>();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      this.serviceToken = await serviceAccountManager.authenticate('authentication-bridge-service');
      this.startSessionCleanup();
      this.initialized = true;
      console.log('✅ Authentication Bridge Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Authentication Bridge Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'authentication-bridge-service',
      operation: 'auth_bridge',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  async createSession(userId: string, clinicId: string, roles: string[] = [], permissions: string[] = []): Promise<SessionContext> {
    const sessionId = require('crypto').randomUUID();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    const session: SessionContext = {
      userId,
      clinicId,
      roles,
      permissions,
      sessionId,
      expiresAt
    };

    this.activeSessions.set(sessionId, session);

    // Log session creation
    const context = this.getServiceContext(clinicId);
    await SecureDataAccess.insert('audit_logs', {
      action: 'SESSION_CREATED',
      details: { userId, clinicId, sessionId },
      timestamp: new Date(),
      serviceId: 'authentication-bridge-service'
    }, context);

    return session;
  }

  async validateSession(sessionId: string): Promise<SessionContext | null> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    if (new Date() > session.expiresAt) {
      this.activeSessions.delete(sessionId);
      return null;
    }

    return session;
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.activeSessions.delete(sessionId);

      // Log session destruction
      const context = this.getServiceContext(session.clinicId);
      await SecureDataAccess.insert('audit_logs', {
        action: 'SESSION_DESTROYED',
        details: { userId: session.userId, sessionId },
        timestamp: new Date(),
        serviceId: 'authentication-bridge-service'
      }, context);
    }
  }

  private startSessionCleanup() {
    setInterval(() => {
      const now = new Date();
      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (now > session.expiresAt) {
          this.activeSessions.delete(sessionId);
        }
      }
    }, 300000); // Clean every 5 minutes
  }

  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }
}