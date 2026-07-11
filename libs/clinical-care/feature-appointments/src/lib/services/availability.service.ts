/**
 * Availability Service - Clinical Care Domain
 * Manages healthcare provider availability, scheduling, and resource allocation
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface AvailabilitySlot {
  id: string;
  providerId: string;
  startTime: Date;
  endTime: Date;
  available: boolean;
  appointmentType: string[];
  location?: string;
}

export interface ProviderSchedule {
  providerId: string;
  date: Date;
  slots: AvailabilitySlot[];
  workingHours: {
    start: string;
    end: string;
  };
}

@Injectable()
export class AvailabilityService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      this.serviceToken = await serviceAccountManager.authenticate('availability-service');
      this.initialized = true;
      console.log('✅ Availability Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Availability Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'availability-service',
      operation: 'availability_management',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  async getDoctorAvailability(providerId: string, date: Date, clinicId?: string): Promise<ProviderSchedule | null> {
    const context = this.getServiceContext(clinicId);
    
    const schedules = await SecureDataAccess.query('provider_schedules', {
      providerId,
      date: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lte: new Date(date.setHours(23, 59, 59, 999))
      },
      clinicId: clinicId || 'global'
    }, {}, context);

    return schedules[0] || null;
  }

  async findAvailableSlots(
    date: Date, 
    appointmentType: string, 
    duration: number = 30, 
    clinicId?: string
  ): Promise<AvailabilitySlot[]> {
    const context = this.getServiceContext(clinicId);
    
    const availableSlots = await SecureDataAccess.query('availability_slots', {
      startTime: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lte: new Date(date.setHours(23, 59, 59, 999))
      },
      available: true,
      appointmentType: appointmentType,
      clinicId: clinicId || 'global'
    }, {
      sort: { startTime: 1 }
    }, context);

    return availableSlots.filter(slot => {
      const slotDuration = (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / (1000 * 60);
      return slotDuration >= duration;
    });
  }

  async bookSlot(slotId: string, patientId: string, appointmentDetails: any, clinicId?: string): Promise<boolean> {
    const context = this.getServiceContext(clinicId);
    
    try {
      // Mark slot as unavailable
      await SecureDataAccess.update('availability_slots', {
        id: slotId,
        available: true,
        clinicId: clinicId || 'global'
      }, {
        $set: { 
          available: false, 
          bookedBy: patientId,
          bookedAt: new Date(),
          appointmentDetails 
        }
      }, context);

      // Log booking
      await SecureDataAccess.insert('audit_logs', {
        action: 'SLOT_BOOKED',
        details: { slotId, patientId, appointmentDetails },
        timestamp: new Date(),
        serviceId: 'availability-service'
      }, context);

      return true;
    } catch (error) {
      console.error('Failed to book slot:', error);
      return false;
    }
  }

  async releaseSlot(slotId: string, clinicId?: string): Promise<boolean> {
    const context = this.getServiceContext(clinicId);
    
    try {
      await SecureDataAccess.update('availability_slots', {
        id: slotId,
        clinicId: clinicId || 'global'
      }, {
        $set: { available: true },
        $unset: { bookedBy: '', bookedAt: '', appointmentDetails: '' }
      }, context);

      return true;
    } catch (error) {
      console.error('Failed to release slot:', error);
      return false;
    }
  }

  async updateProviderSchedule(schedule: ProviderSchedule, clinicId?: string): Promise<boolean> {
    const context = this.getServiceContext(clinicId);
    
    try {
      await SecureDataAccess.upsert('provider_schedules', {
        providerId: schedule.providerId,
        date: schedule.date,
        clinicId: clinicId || 'global'
      }, {
        ...schedule,
        clinicId: clinicId || 'global',
        updatedAt: new Date()
      }, context);

      return true;
    } catch (error) {
      console.error('Failed to update provider schedule:', error);
      return false;
    }
  }
}