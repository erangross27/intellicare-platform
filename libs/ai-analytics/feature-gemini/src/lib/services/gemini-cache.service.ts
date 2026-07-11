/**
 * Gemini Cache Service - AI Analytics Domain  
 * Intelligent caching service for Gemini AI responses to optimize performance
 * 
 * Features:
 * - Function-specific TTL policies for different medical use cases
 * - Intelligent cache key generation with parameter hashing
 * - Cache hit/miss statistics and performance monitoring
 * - Automatic expiration and cleanup of stale entries
 * - Medical data-aware caching strategies
 * - Cache analysis and debugging capabilities
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface CachedItem<T = any> {
  data: T;
  expires: number;
  functionName: string;
  createdAt: number;
  metadata?: Record<string, any>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  cacheSize: number;
  hitRate: number;
  totalMemoryUsage?: number;
}

export interface CacheInfo {
  key: string;
  functionName: string;
  remainingTTL: number;
  age: number;
  size?: number;
  lastAccessed?: number;
}

export interface TTLConfiguration {
  [functionName: string]: number;
}

export interface CacheConfiguration {
  maxSize?: number;
  defaultTTL?: number;
  enableCompression?: boolean;
  enableMetrics?: boolean;
  cleanupInterval?: number;
}

@Injectable()
export class GeminiCacheService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;
  
  private cache = new Map<string, CachedItem>();
  private config: CacheConfiguration;
  private cleanupTimer?: NodeJS.Timeout;
  
  // Function-specific TTL policies for medical use cases
  private readonly ttlDefaults: TTLConfiguration = {
    prescription: 3600,           // 1 hour - medication prescriptions
    dosing: 7200,                 // 2 hours - dosage calculations
    guidelines: 86400,            // 24 hours - clinical guidelines
    vaccination: 86400,           // 24 hours - vaccination schedules
    soapNote: 0,                  // Don't cache - patient-specific notes
    patientEducation: 43200,      // 12 hours - educational content
    vitalSigns: 300,              // 5 minutes - vital sign analysis
    labResults: 1800,             // 30 minutes - lab result interpretation
    allergyCheck: 3600,           // 1 hour - allergy interactions
    drugInteractions: 3600,       // 1 hour - drug interaction checks
    clinicalDecision: 1800,       // 30 minutes - clinical decision support
    medicalScore: 3600,           // 1 hour - medical scoring algorithms
    symptoms: 1800,               // 30 minutes - symptom analysis
    diagnosis: 900,               // 15 minutes - diagnostic suggestions
    treatment: 1800,              // 30 minutes - treatment recommendations
    drugInformation: 86400,       // 24 hours - drug information lookups
    medicalReference: 604800,     // 7 days - medical reference data
    riskAssessment: 3600,         // 1 hour - patient risk assessments
    healthEducation: 86400        // 24 hours - health education materials
  };

  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    cacheSize: 0,
    hitRate: 0
  };

  constructor(
    private configService: ConfigService,
    config: CacheConfiguration = {}
  ) {
    this.config = {
      maxSize: config.maxSize || 10000,
      defaultTTL: config.defaultTTL || 3600,
      enableCompression: config.enableCompression || false,
      enableMetrics: config.enableMetrics || true,
      cleanupInterval: config.cleanupInterval || 300000, // 5 minutes
      ...config
    };
  }

  async onModuleInit() {
    if (this.initialized) return;

    try {
      this.serviceToken = await serviceAccountManager.authenticate('gemini-cache-service');
      
      // Start automatic cleanup
      this.startAutomaticCleanup();
      
      this.initialized = true;
      console.log('✅ Gemini Cache Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini Cache Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'gemini-cache-service',
      operation: 'cache_operations',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  /**
   * Generate a unique cache key for function and parameters
   */
  generateCacheKey(functionName: string, params: any): string {
    const keyData = `${functionName}_${JSON.stringify(params)}`;
    return crypto.createHash('md5').update(keyData).digest('hex');
  }

  /**
   * Get cached data for a function call
   */
  async get<T = any>(functionName: string, params: any): Promise<T | null> {
    const key = this.generateCacheKey(functionName, params);
    const cached = this.cache.get(key) as CachedItem<T> | undefined;

    if (cached && cached.expires > Date.now()) {
      this.stats.hits++;
      
      // Update last accessed time for LRU tracking
      if (cached.metadata) {
        cached.metadata.lastAccessed = Date.now();
      }
      
      if (this.config.enableMetrics) {
        console.log(`✅ Cache hit for ${functionName} (${this.stats.hits} hits total)`);
      }
      
      await this.logCacheOperation('CACHE_HIT', functionName, key);
      return cached.data;
    }

    // Remove expired entry
    if (cached) {
      this.cache.delete(key);
    }
    
    this.stats.misses++;
    await this.logCacheOperation('CACHE_MISS', functionName, key);
    return null;
  }

  /**
   * Set cached data for a function call
   */
  async set<T = any>(
    functionName: string, 
    params: any, 
    data: T, 
    customTTL?: number
  ): Promise<void> {
    const key = this.generateCacheKey(functionName, params);
    const ttl = customTTL ?? this.ttlDefaults[functionName] ?? this.config.defaultTTL!;

    // Don't cache if TTL is 0 or negative
    if (ttl <= 0) {
      return;
    }

    // Check cache size limits
    if (this.cache.size >= this.config.maxSize!) {
      this.evictLRU();
    }

    const cachedItem: CachedItem<T> = {
      data: data,
      expires: Date.now() + (ttl * 1000),
      functionName: functionName,
      createdAt: Date.now(),
      metadata: {
        lastAccessed: Date.now(),
        size: this.estimateSize(data),
        params: this.hashParams(params)
      }
    };

    this.cache.set(key, cachedItem);
    this.stats.sets++;
    this.updateStats();

    if (this.config.enableMetrics) {
      console.log(`💾 Cached ${functionName} for ${ttl}s (cache size: ${this.cache.size})`);
    }

    await this.logCacheOperation('CACHE_SET', functionName, key, { ttl, dataSize: cachedItem.metadata?.size });
  }

  /**
   * Check if a function call result is cached
   */
  has(functionName: string, params: any): boolean {
    const key = this.generateCacheKey(functionName, params);
    const cached = this.cache.get(key);
    return cached !== undefined && cached.expires > Date.now();
  }

  /**
   * Invalidate cache entry for specific function call
   */
  async invalidate(functionName: string, params: any): Promise<boolean> {
    const key = this.generateCacheKey(functionName, params);
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      this.updateStats();
      await this.logCacheOperation('CACHE_INVALIDATE', functionName, key);
    }
    
    return deleted;
  }

  /**
   * Invalidate all cache entries for a specific function
   */
  async invalidateFunction(functionName: string): Promise<number> {
    let invalidated = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (value.functionName === functionName) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    
    this.updateStats();
    
    if (invalidated > 0) {
      await this.logCacheOperation('CACHE_INVALIDATE_FUNCTION', functionName, '', { invalidatedCount: invalidated });
      console.log(`🗑️ Invalidated ${invalidated} entries for function ${functionName}`);
    }
    
    return invalidated;
  }

  /**
   * Clear expired cache entries
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (value.expires < now) {
        this.cache.delete(key);
        cleared++;
      }
    }
    
    this.updateStats();
    
    if (cleared > 0 && this.config.enableMetrics) {
      console.log(`🧹 Cleared ${cleared} expired cache entries`);
    }
    
    return cleared;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Clear entire cache
   */
  clear(): number {
    const size = this.cache.size;
    this.cache.clear();
    this.updateStats();
    
    if (this.config.enableMetrics) {
      console.log(`🗑️ Cleared entire cache (${size} entries)`);
    }
    
    return size;
  }

  /**
   * Get detailed cache information
   */
  getCacheInfo(): CacheInfo[] {
    const items: CacheInfo[] = [];
    const now = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      items.push({
        key: key.substring(0, 8) + '...',
        functionName: value.functionName,
        remainingTTL: Math.max(0, Math.floor((value.expires - now) / 1000)),
        age: Math.floor((now - value.createdAt) / 1000),
        size: value.metadata?.size,
        lastAccessed: value.metadata?.lastAccessed
      });
    }
    
    return items.sort((a, b) => a.remainingTTL - b.remainingTTL);
  }

  /**
   * Get cache entries by function name
   */
  getEntriesByFunction(functionName: string): CacheInfo[] {
    return this.getCacheInfo().filter(item => item.functionName === functionName);
  }

  /**
   * Update TTL for a specific function
   */
  updateTTL(functionName: string, newTTL: number): void {
    this.ttlDefaults[functionName] = newTTL;
    console.log(`📝 Updated TTL for ${functionName} to ${newTTL}s`);
  }

  /**
   * Get current TTL for a function
   */
  getTTL(functionName: string): number {
    return this.ttlDefaults[functionName] ?? this.config.defaultTTL!;
  }

  /**
   * Get memory usage estimation
   */
  getMemoryUsage(): { totalBytes: number; averageBytesPerEntry: number } {
    let totalBytes = 0;
    let entriesWithSize = 0;
    
    for (const value of this.cache.values()) {
      if (value.metadata?.size) {
        totalBytes += value.metadata.size;
        entriesWithSize++;
      }
    }
    
    return {
      totalBytes,
      averageBytesPerEntry: entriesWithSize > 0 ? Math.round(totalBytes / entriesWithSize) : 0
    };
  }

  // ========== PRIVATE METHODS ==========

  private startAutomaticCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.clearExpired();
    }, this.config.cleanupInterval!);
  }

  private updateStats(): void {
    this.stats.cacheSize = this.cache.size;
    this.stats.hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    
    const memoryUsage = this.getMemoryUsage();
    this.stats.totalMemoryUsage = memoryUsage.totalBytes;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      const lastAccessed = value.metadata?.lastAccessed ?? value.createdAt;
      if (lastAccessed < oldestTime) {
        oldestTime = lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log('🔄 Evicted LRU cache entry to make space');
    }
  }

  private estimateSize(data: any): number {
    try {
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    } catch (error) {
      return 0;
    }
  }

  private hashParams(params: any): string {
    try {
      return crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex').substring(0, 16);
    } catch (error) {
      return 'hash_error';
    }
  }

  private async logCacheOperation(operation: string, functionName: string, key: string, metadata?: any) {
    if (!this.config.enableMetrics || !this.initialized) return;
    
    try {
      const context = this.getServiceContext();
      await SecureDataAccess.insert('audit_logs', {
        action: operation,
        resourceType: 'cache',
        userId: 'system',
        details: {
          functionName,
          cacheKey: key.substring(0, 8) + '...',
          metadata
        },
        timestamp: new Date()
      }, context);
    } catch (error) {
      // Ignore logging errors to prevent cache operations from failing
      console.warn('Cache operation logging failed:', error.message);
    }
  }

  /**
   * Cleanup method called on service destruction
   */
  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  // ========== UTILITY METHODS ==========

  /**
   * Warm up cache with commonly used function results
   */
  async warmUp(warmUpData: Array<{ functionName: string; params: any; data: any }>): Promise<number> {
    let warmed = 0;
    
    for (const { functionName, params, data } of warmUpData) {
      await this.set(functionName, params, data);
      warmed++;
    }
    
    console.log(`🔥 Warmed up cache with ${warmed} entries`);
    return warmed;
  }

  /**
   * Export cache data for backup
   */
  exportCache(): Array<{ key: string; value: CachedItem }> {
    return Array.from(this.cache.entries()).map(([key, value]) => ({ key, value }));
  }

  /**
   * Import cache data from backup
   */
  importCache(cacheData: Array<{ key: string; value: CachedItem }>): number {
    let imported = 0;
    const now = Date.now();
    
    for (const { key, value } of cacheData) {
      // Only import non-expired entries
      if (value.expires > now) {
        this.cache.set(key, value);
        imported++;
      }
    }
    
    this.updateStats();
    console.log(`📥 Imported ${imported} cache entries`);
    return imported;
  }

  /**
   * Get cache health metrics
   */
  getHealthMetrics(): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const stats = this.getStats();
    const memoryUsage = this.getMemoryUsage();
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check hit rate
    if (stats.hitRate < 0.5) {
      issues.push(`Low cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
      recommendations.push('Consider adjusting TTL values or cache key generation');
    }
    
    // Check cache size
    if (stats.cacheSize > this.config.maxSize! * 0.9) {
      issues.push(`Cache near capacity: ${stats.cacheSize}/${this.config.maxSize}`);
      recommendations.push('Consider increasing max cache size or reducing TTL values');
    }
    
    // Check memory usage
    if (memoryUsage.totalBytes > 100 * 1024 * 1024) { // 100MB
      issues.push(`High memory usage: ${Math.round(memoryUsage.totalBytes / 1024 / 1024)}MB`);
      recommendations.push('Consider enabling compression or reducing cache size');
    }
    
    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations
    };
  }
}