/**
 * API Versioning Service - Infrastructure Domain
 * Manages API versioning, backward compatibility, and migration paths
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');

export interface ApiVersion {
  version: string;
  supported: boolean;
  deprecated: boolean;
  sunsetDate?: Date;
  migrationPath?: string;
}

@Injectable()
export class ApiVersioningService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;
  
  private versions: Record<string, ApiVersion> = {
    'v1': { version: 'v1', supported: true, deprecated: true, sunsetDate: new Date('2025-12-31') },
    'v2': { version: 'v2', supported: true, deprecated: false },
    'v3': { version: 'v3', supported: true, deprecated: false }
  };

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      this.serviceToken = await serviceAccountManager.authenticate('api-versioning-service');
      this.initialized = true;
      console.log('✅ API Versioning Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize API Versioning Service:', error);
      throw error;
    }
  }

  isVersionSupported(version: string): boolean {
    return this.versions[version]?.supported || false;
  }

  getLatestVersion(): string {
    return 'v3';
  }

  getMigrationPath(fromVersion: string, toVersion: string): string | null {
    if (fromVersion === 'v1' && toVersion === 'v2') {
      return '/migrate/v1-to-v2';
    }
    if (fromVersion === 'v2' && toVersion === 'v3') {
      return '/migrate/v2-to-v3';
    }
    return null;
  }
}