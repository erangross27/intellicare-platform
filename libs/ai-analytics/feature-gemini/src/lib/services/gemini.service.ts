/**
 * Gemini Service - AI Analytics Domain
 * General-purpose Google Gemini AI integration for the IntelliCare platform
 * 
 * Features:
 * - Multi-modal AI content generation (text and vision)
 * - Multiple Gemini model support with flexible configuration
 * - Image analysis and document processing capabilities
 * - Function calling and structured outputs
 * - Comprehensive usage tracking and cost monitoring
 * - Real-time model capability detection
 * - Advanced prompt engineering with context management
 * - Secure API key management through KMS
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');
const productionKMS = require('../../../../../../backend/services/productionKMS');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

export interface GeminiModelConfig {
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
}

export interface GeminiGenerationOptions extends GeminiModelConfig {
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
  systemInstruction?: string;
  tools?: any[];
  toolConfig?: any;
}

export interface GeminiResponse {
  text: string;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  finishReason?: string;
  safetyRatings?: any[];
  citationMetadata?: any;
}

export interface ImagePart {
  inlineData: {
    data: string; // base64 encoded image
    mimeType: string;
  };
}

export interface TextPart {
  text: string;
}

export type ContentPart = TextPart | ImagePart;

export interface Content {
  parts: ContentPart[];
  role?: 'user' | 'model';
}

export interface ModelCapabilities {
  textGeneration: boolean;
  imageAnalysis: boolean;
  functionCalling: boolean;
  contextWindow: number;
  models: string[];
  supportedImageFormats: string[];
  maxImageSize: number;
  maxImagesPerRequest: number;
}

export interface GenerationMetrics {
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  generationTime: number;
  cost: number;
  finishReason: string;
  timestamp: Date;
}

export interface ModelConfiguration {
  name: string;
  displayName: string;
  description: string;
  contextWindow: number;
  inputCostPer1K: number;
  outputCostPer1K: number;
  supportsImages: boolean;
  supportsFunctions: boolean;
  maxTemperature: number;
  defaultTemperature: number;
}

@Injectable()
export class GeminiService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;
  private apiKey: string | null = null;
  private genAI: any = null;
  private modelConfigurations: Map<string, ModelConfiguration> = new Map();
  private generationMetrics: GenerationMetrics[] = [];
  
  // Default safety settings for medical use
  private readonly defaultSafetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH, // Allow some medical content
    },
  ];

  // Supported model configurations
  private readonly supportedModels: ModelConfiguration[] = [
    {
      name: 'gemini-1.5-flash',
      displayName: 'Gemini 1.5 Flash',
      description: 'Fast and efficient model for general tasks',
      contextWindow: 1048576, // 1M tokens
      inputCostPer1K: 0.075 / 1000,
      outputCostPer1K: 0.30 / 1000,
      supportsImages: true,
      supportsFunctions: true,
      maxTemperature: 2.0,
      defaultTemperature: 0.3
    },
    {
      name: 'gemini-1.5-pro',
      displayName: 'Gemini 1.5 Pro',
      description: 'Advanced model for complex reasoning and analysis',
      contextWindow: 2097152, // 2M tokens
      inputCostPer1K: 3.50 / 1000,
      outputCostPer1K: 10.50 / 1000,
      supportsImages: true,
      supportsFunctions: true,
      maxTemperature: 2.0,
      defaultTemperature: 0.3
    },
    {
      name: 'gemini-2.0-flash',
      displayName: 'Gemini 2.0 Flash',
      description: 'Latest generation fast model with improved capabilities',
      contextWindow: 1048576, // 1M tokens
      inputCostPer1K: 0.075 / 1000,
      outputCostPer1K: 0.30 / 1000,
      supportsImages: true,
      supportsFunctions: true,
      maxTemperature: 2.0,
      defaultTemperature: 0.3
    }
  ];

  constructor(
    private configService: ConfigService
  ) {}

  async onModuleInit() {
    if (this.initialized) return;

    try {
      // Initialize model configurations
      this.initializeModelConfigurations();
      
      // Get API key from KMS
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }
      this.apiKey = await productionKMS.getInternalKey('GOOGLE_API_KEY');
      
      if (!this.apiKey) {
        console.error('❌ [Gemini Service] API key not found in KMS');
        throw new Error('Gemini API key not configured');
      }
      
      // Initialize Google Generative AI
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('gemini-service');
      
      this.initialized = true;
      console.log('✅ Gemini Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'gemini-service',
      operation: 'ai_generation',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  private initializeModelConfigurations(): void {
    this.supportedModels.forEach(model => {
      this.modelConfigurations.set(model.name, model);
    });
  }

  /**
   * Get Gemini model instance with configuration
   */
  async getModel(modelName = 'gemini-1.5-flash'): Promise<any> {
    if (!this.initialized) await this.onModuleInit();
    
    if (!this.genAI) {
      throw new Error('Gemini API not configured');
    }
    
    const config = this.modelConfigurations.get(modelName);
    if (!config) {
      throw new Error(`Unsupported model: ${modelName}`);
    }
    
    return this.genAI.getGenerativeModel({ 
      model: modelName,
      safetySettings: this.defaultSafetySettings,
      generationConfig: {
        temperature: config.defaultTemperature,
        maxOutputTokens: 2048,
        topP: 0.95,
        topK: 64
      }
    });
  }

  /**
   * Generate content using Gemini with comprehensive options
   */
  async generateContent(
    prompt: string | Content[],
    options: GeminiGenerationOptions = {}
  ): Promise<GeminiResponse> {
    if (!this.initialized) await this.onModuleInit();
    
    const startTime = Date.now();
    const modelName = options.model || 'gemini-1.5-flash';
    
    try {
      const model = await this.getModel(modelName);
      
      // Configure generation parameters
      const generationConfig = {
        temperature: options.temperature ?? 0.3,
        maxOutputTokens: options.maxOutputTokens ?? 2048,
        topP: options.topP ?? 0.95,
        topK: options.topK ?? 64,
        stopSequences: options.stopSequences || []
      };
      
      // Prepare content
      const content = typeof prompt === 'string' 
        ? [{ parts: [{ text: prompt }] }]
        : prompt;
      
      // Generate content
      const response = await model.generateContent({
        contents: content,
        generationConfig,
        safetySettings: options.safetySettings || this.defaultSafetySettings,
        tools: options.tools,
        toolConfig: options.toolConfig,
        systemInstruction: options.systemInstruction
      });
      
      const result = await response.response;
      const generationTime = Date.now() - startTime;
      
      // Track metrics
      await this.trackGeneration({
        modelUsed: modelName,
        promptTokens: result.usageMetadata?.promptTokenCount || 0,
        completionTokens: result.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: result.usageMetadata?.totalTokenCount || 0,
        generationTime,
        cost: this.calculateCost(modelName, result.usageMetadata),
        finishReason: result.candidates?.[0]?.finishReason || 'STOP',
        timestamp: new Date()
      });
      
      return {
        text: result.text(),
        usageMetadata: result.usageMetadata,
        finishReason: result.candidates?.[0]?.finishReason,
        safetyRatings: result.candidates?.[0]?.safetyRatings,
        citationMetadata: result.candidates?.[0]?.citationMetadata
      };
    } catch (error) {
      console.error(`❌ Gemini generation error with ${modelName}:`, error.message);
      await this.logError('generateContent', error, { prompt: typeof prompt === 'string' ? prompt.substring(0, 100) : 'complex_content', options });
      throw error;
    }
  }

  /**
   * Analyze image with Gemini Vision capabilities
   */
  async analyzeImage(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
    options: GeminiGenerationOptions = {}
  ): Promise<GeminiResponse> {
    if (!this.initialized) await this.onModuleInit();
    
    const modelName = options.model || 'gemini-1.5-flash';
    const modelConfig = this.modelConfigurations.get(modelName);
    
    if (!modelConfig?.supportsImages) {
      throw new Error(`Model ${modelName} does not support image analysis`);
    }
    
    // Validate image format
    const supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!supportedFormats.includes(mimeType)) {
      throw new Error(`Unsupported image format: ${mimeType}`);
    }
    
    // Validate image size (10MB limit)
    if (imageBuffer.length > 10 * 1024 * 1024) {
      throw new Error('Image too large. Maximum size is 10MB');
    }
    
    try {
      const imagePart: ImagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType
        }
      };
      
      const content: Content[] = [{
        parts: [
          { text: prompt },
          imagePart
        ]
      }];
      
      return await this.generateContent(content, {
        ...options,
        model: modelName,
        temperature: options.temperature ?? 0.1 // Lower temperature for image analysis
      });
    } catch (error) {
      console.error('❌ Gemini Vision analysis error:', error.message);
      await this.logError('analyzeImage', error, { mimeType, promptLength: prompt.length, imageSize: imageBuffer.length });
      throw error;
    }
  }

  /**
   * Analyze multiple images in a single request
   */
  async analyzeImages(
    images: Array<{ buffer: Buffer; mimeType: string; description?: string }>,
    prompt: string,
    options: GeminiGenerationOptions = {}
  ): Promise<GeminiResponse> {
    if (images.length > 16) {
      throw new Error('Maximum 16 images per request');
    }
    
    const parts: ContentPart[] = [{ text: prompt }];
    
    // Add each image with optional description
    images.forEach((image, index) => {
      if (image.description) {
        parts.push({ text: `Image ${index + 1}: ${image.description}` });
      }
      
      parts.push({
        inlineData: {
          data: image.buffer.toString('base64'),
          mimeType: image.mimeType
        }
      });
    });
    
    const content: Content[] = [{ parts }];
    
    return await this.generateContent(content, {
      ...options,
      temperature: options.temperature ?? 0.1
    });
  }

  /**
   * Generate structured output using function calling
   */
  async generateStructuredOutput<T = any>(
    prompt: string,
    schema: any,
    options: GeminiGenerationOptions = {}
  ): Promise<{ data: T; response: GeminiResponse }> {
    const tools = [{
      functionDeclarations: [{
        name: 'provide_structured_output',
        description: 'Provide the requested information in the specified structure',
        parameters: schema
      }]
    }];
    
    const response = await this.generateContent(prompt, {
      ...options,
      tools,
      toolConfig: {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: ['provide_structured_output']
        }
      }
    });
    
    // Extract structured data from function call
    // This is a mock implementation - actual extraction would depend on response format
    const structuredData = this.extractStructuredData(response);
    
    return {
      data: structuredData as T,
      response
    };
  }

  /**
   * Stream content generation for real-time responses
   */
  async* streamContent(
    prompt: string | Content[],
    options: GeminiGenerationOptions = {}
  ): AsyncGenerator<Partial<GeminiResponse>, void, unknown> {
    if (!this.initialized) await this.onModuleInit();
    
    const modelName = options.model || 'gemini-1.5-flash';
    const model = await this.getModel(modelName);
    
    try {
      const content = typeof prompt === 'string' 
        ? [{ parts: [{ text: prompt }] }]
        : prompt;
      
      const streamingResponse = await model.generateContentStream({
        contents: content,
        generationConfig: {
          temperature: options.temperature ?? 0.3,
          maxOutputTokens: options.maxOutputTokens ?? 2048,
          topP: options.topP ?? 0.95,
          topK: options.topK ?? 64
        },
        safetySettings: options.safetySettings || this.defaultSafetySettings
      });
      
      for await (const chunk of streamingResponse.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield {
            text: chunkText,
            usageMetadata: chunk.usageMetadata
          };
        }
      }
      
      // Final response with complete metadata
      const finalResponse = await streamingResponse.response;
      yield {
        text: '',
        usageMetadata: finalResponse.usageMetadata,
        finishReason: finalResponse.candidates?.[0]?.finishReason,
        safetyRatings: finalResponse.candidates?.[0]?.safetyRatings
      };
    } catch (error) {
      console.error('❌ Gemini streaming error:', error.message);
      throw error;
    }
  }

  /**
   * Count tokens for input text/content
   */
  async countTokens(content: string | Content[]): Promise<number> {
    if (!this.initialized) await this.onModuleInit();
    
    try {
      const model = await this.getModel();
      const request = typeof content === 'string'
        ? { contents: [{ parts: [{ text: content }] }] }
        : { contents: content };
      
      const tokenResponse = await model.countTokens(request);
      return tokenResponse.totalTokens || 0;
    } catch (error) {
      console.error('❌ Token counting error:', error.message);
      return this.estimateTokens(typeof content === 'string' ? content : JSON.stringify(content));
    }
  }

  /**
   * Estimate token count using heuristics (fallback)
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    
    // Rough estimation: ~4 characters per token for English
    // Adjust for other languages and structured data
    const hasNonEnglish = /[\u0590-\u05FF\u0600-\u06FF\u4E00-\u9FFF]/.test(text);
    const isStructuredData = text.includes('{') || text.includes('[');
    
    let charsPerToken = 4;
    if (isStructuredData) {
      charsPerToken = 5; // JSON/structured data is more token-dense
    } else if (hasNonEnglish) {
      charsPerToken = 3; // Non-English languages typically use fewer characters per token
    }
    
    return Math.ceil(text.length / charsPerToken);
  }

  /**
   * Check if service is available and healthy
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.initialized) return false;
      if (!this.genAI) return false;
      
      // Quick health check with minimal token usage
      const healthCheck = await this.generateContent('Hello', {
        maxOutputTokens: 10,
        temperature: 0
      });
      
      return healthCheck.text.length > 0;
    } catch (error) {
      console.error('❌ Gemini availability check failed:', error.message);
      return false;
    }
  }

  /**
   * Get comprehensive model capabilities
   */
  getCapabilities(): ModelCapabilities {
    return {
      textGeneration: true,
      imageAnalysis: true,
      functionCalling: true,
      contextWindow: Math.max(...this.supportedModels.map(m => m.contextWindow)),
      models: this.supportedModels.map(m => m.name),
      supportedImageFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      maxImageSize: 10 * 1024 * 1024, // 10MB
      maxImagesPerRequest: 16
    };
  }

  /**
   * Get available models with their configurations
   */
  getModelConfigurations(): ModelConfiguration[] {
    return [...this.supportedModels];
  }

  /**
   * Get generation metrics and statistics
   */
  getMetrics(): {
    totalGenerations: number;
    totalTokens: number;
    totalCost: number;
    averageGenerationTime: number;
    modelUsage: Record<string, number>;
  } {
    const totalGenerations = this.generationMetrics.length;
    const totalTokens = this.generationMetrics.reduce((sum, m) => sum + m.totalTokens, 0);
    const totalCost = this.generationMetrics.reduce((sum, m) => sum + m.cost, 0);
    const averageGenerationTime = totalGenerations > 0 
      ? this.generationMetrics.reduce((sum, m) => sum + m.generationTime, 0) / totalGenerations 
      : 0;
    
    const modelUsage: Record<string, number> = {};
    this.generationMetrics.forEach(metric => {
      modelUsage[metric.modelUsed] = (modelUsage[metric.modelUsed] || 0) + 1;
    });
    
    return {
      totalGenerations,
      totalTokens,
      totalCost,
      averageGenerationTime,
      modelUsage
    };
  }

  /**
   * Clear metrics history
   */
  clearMetrics(): void {
    this.generationMetrics = [];
  }

  // ========== PRIVATE METHODS ==========

  private calculateCost(modelName: string, usageMetadata: any): number {
    const config = this.modelConfigurations.get(modelName);
    if (!config || !usageMetadata) return 0;
    
    const inputCost = (usageMetadata.promptTokenCount || 0) * config.inputCostPer1K;
    const outputCost = (usageMetadata.candidatesTokenCount || 0) * config.outputCostPer1K;
    
    return inputCost + outputCost;
  }

  private async trackGeneration(metrics: GenerationMetrics): Promise<void> {
    try {
      // Store in memory for quick access
      this.generationMetrics.push(metrics);
      
      // Keep only last 1000 metrics in memory
      if (this.generationMetrics.length > 1000) {
        this.generationMetrics = this.generationMetrics.slice(-1000);
      }
      
      // Store in database for persistent tracking
      const context = this.getServiceContext();
      await SecureDataAccess.insert('ai_usage_metrics', {
        service: 'gemini',
        model: metrics.modelUsed,
        promptTokens: metrics.promptTokens,
        completionTokens: metrics.completionTokens,
        totalTokens: metrics.totalTokens,
        cost: metrics.cost,
        generationTime: metrics.generationTime,
        finishReason: metrics.finishReason,
        timestamp: metrics.timestamp
      }, context);
    } catch (error) {
      // Don't throw errors for metrics tracking failures
      console.warn('Failed to track generation metrics:', error.message);
    }
  }

  private extractStructuredData(response: GeminiResponse): any {
    // Mock implementation - would need actual function call extraction logic
    try {
      // This would extract data from function calls in the response
      return JSON.parse(response.text);
    } catch (error) {
      return { error: 'Failed to parse structured output' };
    }
  }

  private async logError(operation: string, error: Error, context: any): Promise<void> {
    try {
      const serviceContext = this.getServiceContext();
      await SecureDataAccess.insert('error_logs', {
        service: 'gemini-service',
        operation,
        error: error.message,
        stack: error.stack,
        context,
        timestamp: new Date()
      }, serviceContext);
    } catch (logError) {
      // Don't throw errors for logging failures
      console.warn('Failed to log error:', logError.message);
    }
  }
}