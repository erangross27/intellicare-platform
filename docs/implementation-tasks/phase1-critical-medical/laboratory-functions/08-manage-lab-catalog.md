# Laboratory Catalog Management Function

## Function Details
- **Function Name**: manageLabCatalog
- **Location**: `backend/services/laboratoryCatalogService.js`
- **Status**: Not Implemented
- **Priority**: High
- **Complexity**: High
- **Estimated Time**: 6-8 hours

## Problem Description
The system requires comprehensive laboratory catalog management to maintain current test offerings, reference ranges, pricing information, vendor relationships, and ordering codes. This function must support multi-vendor catalogs, automated catalog updates, customizable test panels, clinical decision support integration, insurance coverage verification, and real-time availability tracking.

## Implementation Steps

### 1. Core Service Implementation
```javascript
// backend/services/laboratoryCatalogService.js
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AuditLog = require('../models/AuditLog');
const agentServiceWrapper = require('./agentServiceWrapper');

class LaboratoryCatalogService {
  constructor() {
    this.serviceToken = null;
    this.catalogCache = new Map();
    this.vendorConnections = new Map();
  }

  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('laboratory-catalog-service');
    await this.loadVendorConnections();
    await this.initializeCatalogCache();
  }

  async manageLabCatalog(catalogRequest, context) {
    try {
      // Validate catalog management request
      await this.validateCatalogRequest(catalogRequest, context);
      
      // Execute specific catalog management operation
      let result;
      switch (catalogRequest.operation) {
        case 'search':
          result = await this.searchCatalog(catalogRequest, context);
          break;
        case 'add-test':
          result = await this.addTestToCatalog(catalogRequest, context);
          break;
        case 'update-test':
          result = await this.updateTestInCatalog(catalogRequest, context);
          break;
        case 'create-panel':
          result = await this.createTestPanel(catalogRequest, context);
          break;
        case 'sync-vendor':
          result = await this.syncVendorCatalog(catalogRequest, context);
          break;
        case 'update-pricing':
          result = await this.updateTestPricing(catalogRequest, context);
          break;
        case 'verify-coverage':
          result = await this.verifyInsuranceCoverage(catalogRequest, context);
          break;
        default:
          throw new Error(`Unsupported catalog operation: ${catalogRequest.operation}`);
      }
      
      // Update catalog cache if needed
      await this.updateCatalogCache(catalogRequest.operation, result, context);
      
      // Audit catalog management activity
      await AuditLog.create({
        action: 'MANAGE_LAB_CATALOG',
        userId: context.userId,
        practiceId: context.practiceId,
        details: {
          operation: catalogRequest.operation,
          affectedTests: result.affectedTests || 0,
          vendorId: catalogRequest.vendorId,
          success: true
        },
        timestamp: new Date()
      });
      
      return {
        operation: catalogRequest.operation,
        status: 'completed',
        result,
        timestamp: new Date()
      };
      
    } catch (error) {
      await this.handleCatalogError(error, catalogRequest, context);
      throw new Error(`Laboratory catalog management failed: ${error.message}`);
    }
  }

  async searchCatalog(searchRequest, context) {
    const searchCriteria = {
      query: searchRequest.query,
      category: searchRequest.category,
      vendor: searchRequest.vendor,
      availability: searchRequest.availability || 'available',
      insuranceCoverage: searchRequest.insuranceCoverage
    };
    
    // Build database query
    const dbQuery = this.buildCatalogQuery(searchCriteria);
    
    // Execute search
    const results = await SecureDataAccess.query(
      'laboratorycatalog',
      dbQuery,
      {
        sort: { relevanceScore: -1, testName: 1 },
        limit: searchRequest.limit || 50
      },
      context
    );
    
    // Enhance results with real-time information
    const enhancedResults = await this.enhanceSearchResults(results, searchCriteria, context);
    
    // Apply clinical decision support filters if requested
    if (searchRequest.clinicalContext) {
      const filteredResults = await this.applyClinicaDecisionSupport(
        enhancedResults, 
        searchRequest.clinicalContext, 
        context
      );
      return filteredResults;
    }
    
    return {
      query: searchRequest.query,
      totalResults: enhancedResults.length,
      results: enhancedResults,
      searchTime: new Date()
    };
  }

  async addTestToCatalog(addRequest, context) {
    // Validate new test information
    await this.validateNewTest(addRequest.testData, context);
    
    // Check for duplicate tests
    const existingTest = await this.checkForDuplicateTest(addRequest.testData, context);
    if (existingTest) {
      throw new Error(`Test already exists: ${existingTest.testName}`);
    }
    
    // Enrich test data with vendor information
    const enrichedTestData = await this.enrichTestData(addRequest.testData, context);
    
    // Generate unique test identifier
    const testId = await this.generateTestId(enrichedTestData, context);
    
    const newTest = {
      testId,
      ...enrichedTestData,
      status: 'active',
      addedBy: context.userId,
      practiceId: context.practiceId,
      createdAt: new Date(),
      version: 1
    };
    
    // Store in catalog
    const storedTest = await SecureDataAccess.create('laboratorycatalog', newTest, context);
    
    // Update search indexes
    await this.updateSearchIndexes(storedTest, 'add', context);
    
    return {
      testId: storedTest.testId,
      testName: storedTest.testName,
      status: 'added',
      affectedTests: 1
    };
  }

  async updateTestInCatalog(updateRequest, context) {
    const testId = updateRequest.testId;
    const updates = updateRequest.updates;
    
    // Validate test exists
    const existingTest = await SecureDataAccess.findOne(
      'laboratorycatalog',
      { testId, practiceId: context.practiceId },
      context
    );
    
    if (!existingTest) {
      throw new Error(`Test not found: ${testId}`);
    }
    
    // Validate update permissions
    await this.validateUpdatePermissions(existingTest, context);
    
    // Process specific types of updates
    const processedUpdates = await this.processTestUpdates(updates, existingTest, context);
    
    // Apply updates
    const updatedTest = await SecureDataAccess.updateById(
      'laboratorycatalog',
      existingTest._id,
      {
        ...processedUpdates,
        updatedBy: context.userId,
        updatedAt: new Date(),
        version: existingTest.version + 1
      },
      context
    );
    
    // Update search indexes
    await this.updateSearchIndexes(updatedTest, 'update', context);
    
    // Handle reference range updates
    if (updates.referenceRanges) {
      await this.updateReferenceRanges(testId, updates.referenceRanges, context);
    }
    
    return {
      testId,
      testName: updatedTest.testName,
      status: 'updated',
      changesApplied: Object.keys(processedUpdates),
      affectedTests: 1
    };
  }

  async createTestPanel(panelRequest, context) {
    // Validate panel configuration
    await this.validatePanelConfiguration(panelRequest.panelData, context);
    
    // Verify all tests in panel exist
    const testIds = panelRequest.panelData.tests.map(t => t.testId);
    const existingTests = await SecureDataAccess.query(
      'laboratorycatalog',
      { 
        testId: { $in: testIds },
        status: 'active',
        practiceId: context.practiceId
      },
      {},
      context
    );
    
    if (existingTests.length !== testIds.length) {
      const missingTests = testIds.filter(id => !existingTests.find(t => t.testId === id));
      throw new Error(`Missing tests in catalog: ${missingTests.join(', ')}`);
    }
    
    // Calculate panel pricing
    const panelPricing = await this.calculatePanelPricing(existingTests, panelRequest.panelData, context);
    
    // Generate panel ID
    const panelId = await this.generatePanelId(panelRequest.panelData, context);
    
    const newPanel = {
      panelId,
      panelName: panelRequest.panelData.name,
      description: panelRequest.panelData.description,
      category: panelRequest.panelData.category,
      tests: existingTests.map(test => ({
        testId: test.testId,
        testName: test.testName,
        required: panelRequest.panelData.tests.find(t => t.testId === test.testId)?.required || true,
        order: panelRequest.panelData.tests.find(t => t.testId === test.testId)?.order || 1
      })),
      pricing: panelPricing,
      clinicalIndications: panelRequest.panelData.clinicalIndications || [],
      turnaroundTime: Math.max(...existingTests.map(t => t.turnaroundTime || 24)),
      specimens: [...new Set(existingTests.flatMap(t => t.specimenTypes))],
      status: 'active',
      createdBy: context.userId,
      practiceId: context.practiceId,
      createdAt: new Date(),
      version: 1
    };
    
    // Store panel
    const storedPanel = await SecureDataAccess.create('laboratorypanels', newPanel, context);
    
    // Update catalog search indexes
    await this.updateSearchIndexes(storedPanel, 'add-panel', context);
    
    return {
      panelId: storedPanel.panelId,
      panelName: storedPanel.panelName,
      testCount: storedPanel.tests.length,
      status: 'created',
      affectedTests: storedPanel.tests.length
    };
  }

  async syncVendorCatalog(syncRequest, context) {
    const vendorId = syncRequest.vendorId;
    const syncType = syncRequest.syncType || 'incremental';
    
    // Get vendor connection
    const vendorConnection = this.vendorConnections.get(vendorId);
    if (!vendorConnection) {
      throw new Error(`Vendor connection not found: ${vendorId}`);
    }
    
    // Initialize sync session
    const syncSession = await this.initializeSyncSession(vendorId, syncType, context);
    
    try {
      // Fetch vendor catalog
      const vendorCatalog = await this.fetchVendorCatalog(vendorConnection, syncType, context);
      
      // Compare with current catalog
      const catalogComparison = await this.compareCatalogs(vendorCatalog, vendorId, context);
      
      // Apply catalog changes
      const syncResults = await this.applyCatalogChanges(catalogComparison, vendorId, context);
      
      // Update sync status
      await this.finalizeSyncSession(syncSession, syncResults, context);
      
      return {
        vendorId,
        syncType,
        testsAdded: syncResults.added.length,
        testsUpdated: syncResults.updated.length,
        testsRemoved: syncResults.removed.length,
        errors: syncResults.errors.length,
        affectedTests: syncResults.added.length + syncResults.updated.length + syncResults.removed.length,
        lastSyncTime: new Date()
      };
      
    } catch (error) {
      await this.handleSyncError(syncSession, error, context);
      throw error;
    }
  }

  async updateTestPricing(pricingRequest, context) {
    const updates = pricingRequest.priceUpdates;
    const effectiveDate = new Date(pricingRequest.effectiveDate || Date.now());
    
    const results = {
      updated: [],
      failed: [],
      affectedTests: 0
    };
    
    for (const update of updates) {
      try {
        // Validate test exists
        const test = await SecureDataAccess.findOne(
          'laboratorycatalog',
          { testId: update.testId, practiceId: context.practiceId },
          context
        );
        
        if (!test) {
          results.failed.push({ testId: update.testId, error: 'Test not found' });
          continue;
        }
        
        // Create pricing history entry
        const pricingHistory = {
          previousPrice: test.pricing,
          newPrice: update.pricing,
          effectiveDate,
          updatedBy: context.userId,
          reason: update.reason || 'Price adjustment'
        };
        
        // Update test pricing
        const updatedTest = await SecureDataAccess.updateById(
          'laboratorycatalog',
          test._id,
          {
            pricing: update.pricing,
            $push: { pricingHistory },
            updatedAt: new Date(),
            version: test.version + 1
          },
          context
        );
        
        results.updated.push({
          testId: update.testId,
          testName: test.testName,
          previousPrice: test.pricing?.basePrice,
          newPrice: update.pricing.basePrice
        });
        
        results.affectedTests++;
        
      } catch (error) {
        results.failed.push({ testId: update.testId, error: error.message });
      }
    }
    
    return results;
  }

  async verifyInsuranceCoverage(coverageRequest, context) {
    const testIds = coverageRequest.testIds;
    const insuranceInfo = coverageRequest.insuranceInfo;
    
    const coverageResults = [];
    
    for (const testId of testIds) {
      try {
        // Get test information
        const test = await SecureDataAccess.findOne(
          'laboratorycatalog',
          { testId, practiceId: context.practiceId },
          context
        );
        
        if (!test) {
          coverageResults.push({
            testId,
            covered: false,
            reason: 'Test not found in catalog'
          });
          continue;
        }
        
        // Check insurance coverage
        const coverageCheck = await this.checkInsuranceCoverage(test, insuranceInfo, context);
        
        coverageResults.push({
          testId,
          testName: test.testName,
          covered: coverageCheck.covered,
          copay: coverageCheck.copay,
          deductible: coverageCheck.deductible,
          preAuthRequired: coverageCheck.preAuthRequired,
          coveragePercentage: coverageCheck.coveragePercentage,
          reason: coverageCheck.reason
        });
        
      } catch (error) {
        coverageResults.push({
          testId,
          covered: false,
          error: error.message
        });
      }
    }
    
    return {
      insurancePlan: insuranceInfo.planName,
      totalTests: testIds.length,
      coveredTests: coverageResults.filter(r => r.covered).length,
      results: coverageResults
    };
  }

  buildCatalogQuery(searchCriteria) {
    const query = { status: 'active' };
    
    // Text search
    if (searchCriteria.query) {
      query.$or = [
        { testName: { $regex: searchCriteria.query, $options: 'i' } },
        { description: { $regex: searchCriteria.query, $options: 'i' } },
        { synonyms: { $in: [new RegExp(searchCriteria.query, 'i')] } },
        { cptCodes: { $in: [searchCriteria.query] } },
        { loincCodes: { $in: [searchCriteria.query] } }
      ];
    }
    
    // Category filter
    if (searchCriteria.category) {
      query.category = searchCriteria.category;
    }
    
    // Vendor filter
    if (searchCriteria.vendor) {
      query.vendorId = searchCriteria.vendor;
    }
    
    // Availability filter
    if (searchCriteria.availability === 'available') {
      query.availability = { $ne: 'discontinued' };
    }
    
    return query;
  }

  async enhanceSearchResults(results, searchCriteria, context) {
    const enhancedResults = [];
    
    for (const test of results) {
      const enhanced = {
        ...test.toObject(),
        realTimeStatus: await this.getRealTimeTestStatus(test.testId, context),
        estimatedTurnaround: await this.getEstimatedTurnaround(test.testId, context),
        availability: await this.checkTestAvailability(test.testId, context)
      };
      
      // Add insurance information if requested
      if (searchCriteria.insuranceCoverage) {
        enhanced.coverageInfo = await this.getInsuranceCoverageInfo(
          test.testId,
          searchCriteria.insuranceCoverage,
          context
        );
      }
      
      enhancedResults.push(enhanced);
    }
    
    return enhancedResults;
  }

  async applyClinicaDecisionSupport(results, clinicalContext, context) {
    // Use AI agent for clinical decision support
    const cdsRequest = {
      tests: results.map(r => ({
        testId: r.testId,
        testName: r.testName,
        category: r.category,
        clinicalIndications: r.clinicalIndications
      })),
      patientContext: clinicalContext.patient,
      clinicalScenario: clinicalContext.scenario,
      orderingReason: clinicalContext.reason
    };
    
    const cdsResponse = await agentServiceWrapper.callAgent({
      agentId: 'clinical-decision-support',
      userMessage: `Provide clinical decision support for laboratory test selection based on the given context.`,
      context: {
        ...context,
        specialization: 'laboratory-medicine',
        requestData: cdsRequest
      }
    });
    
    // Apply CDS recommendations to results
    const filteredResults = results.map(result => ({
      ...result,
      cdsRecommendation: cdsResponse.data.recommendations?.find(r => r.testId === result.testId),
      appropriatenessScore: cdsResponse.data.scores?.[result.testId] || 0,
      clinicalRelevance: cdsResponse.data.relevance?.[result.testId] || 'unknown'
    }));
    
    // Sort by clinical appropriateness
    return filteredResults.sort((a, b) => (b.appropriatenessScore || 0) - (a.appropriatenessScore || 0));
  }
}

module.exports = LaboratoryCatalogService;
```

### 2. API Endpoints
```javascript
// backend/routes/laboratory.js
router.post('/catalog/search', authMiddleware, async (req, res) => {
  try {
    const searchRequest = {
      operation: 'search',
      query: req.body.query,
      category: req.body.category,
      vendor: req.body.vendor,
      availability: req.body.availability,
      insuranceCoverage: req.body.insuranceCoverage,
      clinicalContext: req.body.clinicalContext,
      limit: req.body.limit || 50
    };

    const catalogService = new LaboratoryCatalogService();
    await catalogService.initialize();
    
    const result = await catalogService.manageLabCatalog(searchRequest, {
      userId: req.user.id,
      practiceId: req.practice.id,
      userRole: req.user.role
    });
    
    res.status(200).json({
      success: true,
      data: result.result,
      message: {
        en: 'Catalog search completed successfully',
        he: 'חיפוש בקטלוג הושלם בהצלחה'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: {
        en: `Catalog search failed: ${error.message}`,
        he: `חיפוש בקטלוג נכשל: ${error.message}`
      }
    });
  }
});

router.post('/catalog/add-test', authMiddleware, requireRole(['admin', 'lab_manager']), async (req, res) => {
  try {
    const addRequest = {
      operation: 'add-test',
      testData: req.body.testData
    };

    const catalogService = new LaboratoryCatalogService();
    await catalogService.initialize();
    
    const result = await catalogService.manageLabCatalog(addRequest, {
      userId: req.user.id,
      practiceId: req.practice.id,
      userRole: req.user.role
    });
    
    res.status(201).json({
      success: true,
      data: result.result,
      message: {
        en: 'Test added to catalog successfully',
        he: 'בדיקה נוספה לקטלוג בהצלחה'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: {
        en: `Failed to add test: ${error.message}`,
        he: `הוספת בדיקה נכשלה: ${error.message}`
      }
    });
  }
});

router.post('/catalog/create-panel', authMiddleware, requireRole(['admin', 'lab_manager']), async (req, res) => {
  try {
    const panelRequest = {
      operation: 'create-panel',
      panelData: req.body.panelData
    };

    const catalogService = new LaboratoryCatalogService();
    await catalogService.initialize();
    
    const result = await catalogService.manageLabCatalog(panelRequest, {
      userId: req.user.id,
      practiceId: req.practice.id,
      userRole: req.user.role
    });
    
    res.status(201).json({
      success: true,
      data: result.result,
      message: {
        en: 'Test panel created successfully',
        he: 'פאנל בדיקות נוצר בהצלחה'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: {
        en: `Failed to create panel: ${error.message}`,
        he: `יצירת פאנל נכשלה: ${error.message}`
      }
    });
  }
});

router.post('/catalog/verify-coverage', authMiddleware, async (req, res) => {
  try {
    const coverageRequest = {
      operation: 'verify-coverage',
      testIds: req.body.testIds,
      insuranceInfo: req.body.insuranceInfo
    };

    const catalogService = new LaboratoryCatalogService();
    await catalogService.initialize();
    
    const result = await catalogService.manageLabCatalog(coverageRequest, {
      userId: req.user.id,
      practiceId: req.practice.id,
      userRole: req.user.role
    });
    
    res.status(200).json({
      success: true,
      data: result.result,
      message: {
        en: 'Insurance coverage verified',
        he: 'כיסוי ביטוח אומת'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: {
        en: `Coverage verification failed: ${error.message}`,
        he: `אימות כיסוי נכשל: ${error.message}`
      }
    });
  }
});
```

### 3. Data Models
```javascript
// backend/models/LaboratoryCatalog.js
const mongoose = require('mongoose');

const laboratoryCatalogSchema = new mongoose.Schema({
  testId: { type: String, required: true, unique: true },
  testName: { type: String, required: true },
  description: String,
  synonyms: [String],
  category: { type: String, required: true },
  subcategory: String,
  
  // Coding systems
  cptCodes: [String],
  loincCodes: [String],
  snomedCodes: [String],
  icd10Codes: [String],
  
  // Vendor information
  vendorId: { type: String, required: true },
  vendorTestId: String,
  vendorName: String,
  
  // Specimen requirements
  specimenTypes: [String],
  specimenVolume: String,
  collectionInstructions: String,
  transportRequirements: String,
  
  // Timing
  turnaroundTime: Number, // in hours
  scheduleRestrictions: {
    availableDays: [String],
    cutoffTimes: [String],
    holidaySchedule: String
  },
  
  // Pricing
  pricing: {
    basePrice: Number,
    memberPrice: Number,
    insurancePrice: Number,
    currency: { type: String, default: 'USD' },
    effectiveDate: Date
  },
  pricingHistory: [{
    previousPrice: mongoose.Schema.Types.Mixed,
    newPrice: mongoose.Schema.Types.Mixed,
    effectiveDate: Date,
    updatedBy: mongoose.Schema.Types.ObjectId,
    reason: String
  }],
  
  // Reference ranges
  referenceRanges: [{
    ageMin: Number,
    ageMax: Number,
    gender: String,
    unit: String,
    lowNormal: Number,
    highNormal: Number,
    lowCritical: Number,
    highCritical: Number,
    panicLow: Number,
    panicHigh: Number,
    qualitativeValues: [String]
  }],
  
  // Clinical information
  clinicalIndications: [String],
  contraindications: [String],
  interferencesFactors: [String],
  clinicalSignificance: String,
  
  // Insurance and coverage
  insuranceCoverage: [{
    insuranceId: String,
    planType: String,
    covered: Boolean,
    copay: Number,
    deductible: Number,
    preAuthRequired: Boolean,
    coveragePercentage: Number,
    effectiveDate: Date,
    expirationDate: Date
  }],
  
  // Availability and status
  status: { 
    type: String, 
    enum: ['active', 'discontinued', 'pending', 'unavailable'], 
    default: 'active' 
  },
  availability: {
    currentStatus: String,
    backorderedUntil: Date,
    seasonalRestrictions: [String]
  },
  
  // Quality control
  qualityMetrics: {
    accuracy: Number,
    precision: Number,
    sensitivity: Number,
    specificity: Number,
    lastValidated: Date
  },
  
  // Search and indexing
  searchKeywords: [String],
  relevanceScore: Number,
  
  // Audit fields
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: mongoose.Schema.Types.ObjectId,
  updatedBy: mongoose.Schema.Types.ObjectId,
  version: { type: Number, default: 1 },
  practiceId: { type: String, required: true },
  isActive: { type: Boolean, default: true }
});

// Indexes for performance
laboratoryCatalogSchema.index({ testId: 1 }, { unique: true });
laboratoryCatalogSchema.index({ testName: 1, practiceId: 1 });
laboratoryCatalogSchema.index({ category: 1, subcategory: 1 });
laboratoryCatalogSchema.index({ vendorId: 1, status: 1 });
laboratoryCatalogSchema.index({ cptCodes: 1 });
laboratoryCatalogSchema.index({ loincCodes: 1 });
laboratoryCatalogSchema.index({ status: 1, practiceId: 1 });
laboratoryCatalogSchema.index({ 
  testName: 'text', 
  description: 'text', 
  synonyms: 'text',
  searchKeywords: 'text'
});

module.exports = mongoose.model('LaboratoryCatalog', laboratoryCatalogSchema);
```

### 4. Frontend Components
```javascript
// frontend-vite/src/components/Laboratory/CatalogManager.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { Search, Plus, Edit, Package, DollarSign } from 'lucide-react';
import secureApiClient from '../../services/secureApiClient';

const CatalogManager = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [showAddTest, setShowAddTest] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);

  const testCategories = [
    { value: 'all', label: 'All Categories' },
    { value: 'chemistry', label: 'Clinical Chemistry' },
    { value: 'hematology', label: 'Hematology' },
    { value: 'immunology', label: 'Immunology' },
    { value: 'microbiology', label: 'Microbiology' },
    { value: 'molecular', label: 'Molecular Diagnostics' },
    { value: 'pathology', label: 'Anatomical Pathology' }
  ];

  const searchCatalog = async () => {
    if (!searchQuery.trim() && selectedCategory === 'all') return;
    
    try {
      setIsLoading(true);
      
      const response = await secureApiClient.post('/api/laboratory/catalog/search', {
        query: searchQuery.trim(),
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        limit: 100
      });
      
      setSearchResults(response.data.data.results || []);
    } catch (error) {
      console.error('Catalog search failed:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchCatalog();
    }
  };

  const formatPrice = (pricing) => {
    if (!pricing) return 'Price not available';
    return `$${pricing.basePrice?.toFixed(2) || '0.00'}`;
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'bg-green-100 text-green-800',
      'discontinued': 'bg-red-100 text-red-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'unavailable': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || colors.active;
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Laboratory Catalog Management</h2>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <div className="flex-1 flex space-x-2">
              <Input
                placeholder="Search tests, CPT codes, LOINC codes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {testCategories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={searchCatalog} disabled={isLoading}>
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
            
            <div className="flex space-x-2">
              <Button onClick={() => setShowAddTest(true)} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Test
              </Button>
              <Button onClick={() => setShowCreatePanel(true)} variant="outline">
                <Package className="w-4 h-4 mr-2" />
                Create Panel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">
              Search Results ({searchResults.length} tests found)
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {searchResults.map((test) => (
                <div key={test.testId} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium text-lg">{test.testName}</h4>
                        <Badge className={getStatusColor(test.status)}>
                          {test.status}
                        </Badge>
                        <Badge variant="outline">{test.category}</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Test ID:</span>
                          <div className="font-mono">{test.testId}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">CPT Code:</span>
                          <div className="font-mono">{test.cptCodes?.[0] || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Turnaround:</span>
                          <div>{test.turnaroundTime || 'N/A'} hours</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Price:</span>
                          <div className="font-semibold">{formatPrice(test.pricing)}</div>
                        </div>
                      </div>
                      
                      {test.description && (
                        <div className="mt-2 text-sm text-gray-600">
                          {test.description}
                        </div>
                      )}
                      
                      {test.specimenTypes && (
                        <div className="mt-2">
                          <span className="text-sm text-gray-600">Specimen: </span>
                          <span className="text-sm">{test.specimenTypes.join(', ')}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedTest(test)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      
                      {test.coverageInfo && (
                        <Button size="sm" variant="outline">
                          <DollarSign className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {!isLoading && searchResults.length === 0 && (searchQuery || selectedCategory !== 'all') && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <div className="text-lg mb-2">No tests found</div>
              <div className="text-sm">Try adjusting your search criteria</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <div>Searching catalog...</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Details Dialog */}
      <Dialog open={!!selectedTest} onOpenChange={() => setSelectedTest(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test Details</DialogTitle>
          </DialogHeader>
          
          {selectedTest && (
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="clinical">Clinical</TabsTrigger>
                <TabsTrigger value="specimen">Specimen</TabsTrigger>
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="coverage">Coverage</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Test Name</label>
                    <div className="p-2 bg-gray-50 rounded">{selectedTest.testName}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Test ID</label>
                    <div className="p-2 bg-gray-50 rounded font-mono">{selectedTest.testId}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <div className="p-2 bg-gray-50 rounded">{selectedTest.category}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <Badge className={getStatusColor(selectedTest.status)}>
                      {selectedTest.status}
                    </Badge>
                  </div>
                </div>
                
                {selectedTest.description && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <div className="p-2 bg-gray-50 rounded">{selectedTest.description}</div>
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">CPT Codes</label>
                    <div className="p-2 bg-gray-50 rounded font-mono text-sm">
                      {selectedTest.cptCodes?.join(', ') || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">LOINC Codes</label>
                    <div className="p-2 bg-gray-50 rounded font-mono text-sm">
                      {selectedTest.loincCodes?.join(', ') || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Turnaround Time</label>
                    <div className="p-2 bg-gray-50 rounded">
                      {selectedTest.turnaroundTime || 'N/A'} hours
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="clinical" className="space-y-4">
                {selectedTest.clinicalIndications && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Clinical Indications</label>
                    <ul className="space-y-1">
                      {selectedTest.clinicalIndications.map((indication, index) => (
                        <li key={index} className="p-2 bg-gray-50 rounded text-sm">
                          • {indication}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {selectedTest.referenceRanges && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Reference Ranges</label>
                    <div className="space-y-2">
                      {selectedTest.referenceRanges.map((range, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded text-sm">
                          <div className="grid grid-cols-4 gap-2">
                            <div>Age: {range.ageMin || 0}-{range.ageMax || '∞'}</div>
                            <div>Gender: {range.gender || 'All'}</div>
                            <div>Normal: {range.lowNormal}-{range.highNormal} {range.unit}</div>
                            <div>Critical: {range.lowCritical}-{range.highCritical} {range.unit}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="specimen" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Specimen Types</label>
                    <div className="p-2 bg-gray-50 rounded">
                      {selectedTest.specimenTypes?.join(', ') || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Volume Required</label>
                    <div className="p-2 bg-gray-50 rounded">
                      {selectedTest.specimenVolume || 'N/A'}
                    </div>
                  </div>
                </div>
                
                {selectedTest.collectionInstructions && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Collection Instructions</label>
                    <div className="p-2 bg-gray-50 rounded text-sm">
                      {selectedTest.collectionInstructions}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="pricing" className="space-y-4">
                {selectedTest.pricing && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Base Price</label>
                      <div className="p-2 bg-gray-50 rounded font-semibold text-lg">
                        ${selectedTest.pricing.basePrice?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Member Price</label>
                      <div className="p-2 bg-gray-50 rounded font-semibold text-lg">
                        ${selectedTest.pricing.memberPrice?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Insurance Price</label>
                      <div className="p-2 bg-gray-50 rounded font-semibold text-lg">
                        ${selectedTest.pricing.insurancePrice?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="coverage" className="space-y-4">
                {selectedTest.insuranceCoverage?.length > 0 ? (
                  <div className="space-y-3">
                    {selectedTest.insuranceCoverage.map((coverage, index) => (
                      <div key={index} className="p-3 border rounded">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{coverage.planType}</span>
                          <Badge variant={coverage.covered ? 'default' : 'secondary'}>
                            {coverage.covered ? 'Covered' : 'Not Covered'}
                          </Badge>
                        </div>
                        {coverage.covered && (
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>Copay: ${coverage.copay || 0}</div>
                            <div>Coverage: {coverage.coveragePercentage || 0}%</div>
                            <div>Pre-auth: {coverage.preAuthRequired ? 'Required' : 'Not Required'}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div>No insurance coverage information available</div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CatalogManager;
```

### 5. Test Cases
```javascript
// backend/tests/laboratory/manageLabCatalog.test.js
const request = require('supertest');
const app = require('../../server');
const LaboratoryCatalogService = require('../../services/laboratoryCatalogService');

describe('Laboratory Catalog Management', () => {
  let authToken;
  let catalogService;

  beforeAll(async () => {
    catalogService = new LaboratoryCatalogService();
    await catalogService.initialize();
    // Setup test data
  });

  describe('POST /api/laboratory/catalog/search', () => {
    it('should search catalog by test name', async () => {
      const response = await request(app)
        .post('/api/laboratory/catalog/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: 'hemoglobin'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toBeInstanceOf(Array);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .post('/api/laboratory/catalog/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          category: 'hematology'
        })
        .expect(200);

      expect(response.body.data.results.every(test => test.category === 'hematology')).toBe(true);
    });

    it('should search by CPT code', async () => {
      const response = await request(app)
        .post('/api/laboratory/catalog/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: '85025'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/laboratory/catalog/add-test', () => {
    it('should add new test to catalog', async () => {
      const newTest = {
        testName: 'Custom Test Panel',
        category: 'chemistry',
        cptCodes: ['99999'],
        specimenTypes: ['serum'],
        pricing: {
          basePrice: 125.00
        },
        turnaroundTime: 24
      };

      const response = await request(app)
        .post('/api/laboratory/catalog/add-test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ testData: newTest })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.testName).toBe(newTest.testName);
    });

    it('should prevent duplicate test addition', async () => {
      const duplicateTest = {
        testName: 'Existing Test',
        testId: 'EXISTING_TEST_ID'
      };

      await request(app)
        .post('/api/laboratory/catalog/add-test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ testData: duplicateTest })
        .expect(500);
    });
  });

  describe('POST /api/laboratory/catalog/create-panel', () => {
    it('should create test panel successfully', async () => {
      const panelData = {
        name: 'Basic Metabolic Panel',
        description: 'Basic metabolic screening tests',
        category: 'chemistry',
        tests: [
          { testId: 'GLU', required: true, order: 1 },
          { testId: 'BUN', required: true, order: 2 },
          { testId: 'CREAT', required: true, order: 3 }
        ]
      };

      const response = await request(app)
        .post('/api/laboratory/catalog/create-panel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ panelData })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.testCount).toBe(3);
    });
  });

  describe('POST /api/laboratory/catalog/verify-coverage', () => {
    it('should verify insurance coverage for tests', async () => {
      const coverageRequest = {
        testIds: ['CBC', 'CMP', 'LIPID'],
        insuranceInfo: {
          planName: 'Medicare',
          memberId: '123456789'
        }
      };

      const response = await request(app)
        .post('/api/laboratory/catalog/verify-coverage')
        .set('Authorization', `Bearer ${authToken}`)
        .send(coverageRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(3);
    });
  });
});
```

## Dependencies
- `secureDataAccess` service for database operations
- `serviceAccountManager` for authentication
- `agentServiceWrapper` for clinical decision support
- Vendor API connections for catalog synchronization
- Insurance verification services
- Reference range management system
- Pricing and billing integration
- Search indexing capabilities

## Success Criteria
- [x] Comprehensive test catalog search and filtering
- [x] Multi-vendor catalog management
- [x] Real-time test availability tracking
- [x] Custom test and panel creation
- [x] Automated vendor catalog synchronization
- [x] Pricing management and history tracking
- [x] Insurance coverage verification
- [x] Clinical decision support integration
- [x] Reference range management
- [x] Search optimization and relevance scoring
- [x] Audit trails for all catalog changes
- [x] Role-based access control for catalog management