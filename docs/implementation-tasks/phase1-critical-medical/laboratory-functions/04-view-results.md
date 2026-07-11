# View Lab Results - Implementation Task

## Function Details
- **Function Name**: `viewResults`
- **Location**: `backend/services/labResultsViewingService.js`
- **Status**: Not Implemented
- **Priority**: High
- **Estimated Time**: 2-3 days
- **Complexity**: Medium

## Problem Description
Implement comprehensive laboratory results viewing functionality that allows healthcare providers to efficiently search, filter, sort, and display lab results with advanced visualization options. The system must support trend analysis, comparison views, critical value highlighting, and integration with patient medical records. Multi-format export and printing capabilities are required.

## Implementation Steps

### 1. Lab Results Viewing Service Implementation

```javascript
// File: backend/services/labResultsViewingService.js
const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const ChartGenerationService = require('./chartGenerationService');
const ExportService = require('./exportService');

class LabResultsViewingService {
  constructor() {
    this.viewTypes = {
      'list': 'Standard list view',
      'timeline': 'Timeline/chronological view',
      'trends': 'Trend analysis with charts',
      'comparison': 'Side-by-side comparison',
      'critical': 'Critical values only',
      'summary': 'Summary report view'
    };

    this.sortOptions = {
      'date_desc': { resultDate: -1 },
      'date_asc': { resultDate: 1 },
      'test_name': { testName: 1 },
      'critical_first': { isCritical: -1, resultDate: -1 },
      'abnormal_first': { abnormalFlag: -1, resultDate: -1 }
    };

    this.filterCategories = {
      'chemistry': 'Clinical Chemistry',
      'hematology': 'Hematology',
      'microbiology': 'Microbiology',
      'immunology': 'Immunology',
      'pathology': 'Pathology'
    };
  }

  async viewResults(viewRequest, context) {
    try {
      // Validate view request
      await this.validateViewRequest(viewRequest, context);

      // Build query based on filters
      const query = await this.buildResultsQuery(viewRequest, context);

      // Execute query with pagination
      const results = await this.executeQuery(query, viewRequest, context);

      // Enhance results with additional data
      const enhancedResults = await this.enhanceResults(results, viewRequest, context);

      // Generate view-specific formatting
      const formattedView = await this.formatForView(enhancedResults, viewRequest, context);

      // Create audit log
      await this.createAuditLog(viewRequest, formattedView.metadata, context);

      return formattedView;

    } catch (error) {
      await AuditLog.create({
        action: 'VIEW_LAB_RESULTS_ERROR',
        error: error.message,
        userId: context.userId,
        practiceId: context.practiceId,
        timestamp: new Date()
      });
      throw error;
    }
  }

  async buildResultsQuery(viewRequest, context) {
    const query = {
      practiceId: context.practiceId
    };

    // Patient filter
    if (viewRequest.patientId) {
      query.patientId = viewRequest.patientId;
    }

    // Date range filter
    if (viewRequest.startDate || viewRequest.endDate) {
      query.resultDate = {};
      if (viewRequest.startDate) {
        query.resultDate.$gte = new Date(viewRequest.startDate);
      }
      if (viewRequest.endDate) {
        query.resultDate.$lte = new Date(viewRequest.endDate);
      }
    }

    // Test code filter
    if (viewRequest.testCodes && viewRequest.testCodes.length > 0) {
      query.testCode = { $in: viewRequest.testCodes };
    }

    // Test category filter
    if (viewRequest.categories && viewRequest.categories.length > 0) {
      query.category = { $in: viewRequest.categories };
    }

    // Critical values filter
    if (viewRequest.criticalOnly) {
      query.isCritical = true;
    }

    // Abnormal values filter
    if (viewRequest.abnormalOnly) {
      query.abnormalFlag = { $in: ['H', 'L', 'HH', 'LL', 'A'] };
    }

    // Provider filter
    if (viewRequest.providerId) {
      // Get orders from this provider and filter results
      const orders = await SecureDataAccess.query('lab_orders',
        { orderingProviderId: viewRequest.providerId },
        { fields: ['orderNumber'] },
        context
      );
      const orderNumbers = orders.map(o => o.orderNumber);
      query.orderNumber = { $in: orderNumbers };
    }

    // Laboratory filter
    if (viewRequest.laboratoryId) {
      query.laboratoryId = viewRequest.laboratoryId;
    }

    // Status filter
    if (viewRequest.status) {
      query.resultStatus = viewRequest.status;
    }

    // Text search
    if (viewRequest.searchText) {
      query.$or = [
        { testName: { $regex: viewRequest.searchText, $options: 'i' } },
        { result: { $regex: viewRequest.searchText, $options: 'i' } },
        { patientName: { $regex: viewRequest.searchText, $options: 'i' } }
      ];
    }

    return query;
  }

  async executeQuery(query, viewRequest, context) {
    const options = {
      sort: this.sortOptions[viewRequest.sortBy] || { resultDate: -1 },
      limit: viewRequest.limit || 100,
      skip: (viewRequest.page - 1) * (viewRequest.limit || 100) || 0
    };

    // Include related data based on view type
    switch (viewRequest.viewType) {
      case 'timeline':
      case 'trends':
        options.include = ['patient', 'orderInfo'];
        break;
      case 'comparison':
        options.include = ['patient', 'previousResults'];
        break;
      default:
        options.include = ['patient'];
    }

    const results = await SecureDataAccess.query('lab_results', query, options, context);
    
    // Get total count for pagination
    const totalCount = await SecureDataAccess.count('lab_results', query, context);

    return {
      results,
      totalCount,
      page: viewRequest.page || 1,
      limit: viewRequest.limit || 100,
      totalPages: Math.ceil(totalCount / (viewRequest.limit || 100))
    };
  }

  async enhanceResults(queryResults, viewRequest, context) {
    const enhancedResults = [];

    for (const result of queryResults.results) {
      const enhanced = { ...result };

      // Add patient information if not included
      if (!enhanced.patient && result.patientId) {
        const patients = await SecureDataAccess.query('patients',
          { _id: result.patientId },
          { fields: ['firstName', 'lastName', 'mrn', 'dateOfBirth'] },
          context
        );
        enhanced.patient = patients[0] || null;
      }

      // Add reference range interpretation
      enhanced.interpretation = await this.interpretResult(result);

      // Add trend data if requested
      if (['timeline', 'trends'].includes(viewRequest.viewType)) {
        enhanced.trendData = await this.getTrendData(result, context);
      }

      // Add comparison data if requested
      if (viewRequest.viewType === 'comparison') {
        enhanced.comparisonData = await this.getComparisonData(result, context);
      }

      enhancedResults.push(enhanced);
    }

    return {
      ...queryResults,
      results: enhancedResults
    };
  }

  async formatForView(enhancedResults, viewRequest, context) {
    const baseResult = {
      metadata: {
        viewType: viewRequest.viewType,
        totalCount: enhancedResults.totalCount,
        page: enhancedResults.page,
        totalPages: enhancedResults.totalPages,
        filters: this.summarizeFilters(viewRequest),
        generatedAt: new Date()
      }
    };

    switch (viewRequest.viewType) {
      case 'list':
        return {
          ...baseResult,
          data: await this.formatListView(enhancedResults.results, context)
        };
      
      case 'timeline':
        return {
          ...baseResult,
          data: await this.formatTimelineView(enhancedResults.results, context)
        };
      
      case 'trends':
        return {
          ...baseResult,
          data: await this.formatTrendsView(enhancedResults.results, context)
        };
      
      case 'comparison':
        return {
          ...baseResult,
          data: await this.formatComparisonView(enhancedResults.results, context)
        };
      
      case 'critical':
        return {
          ...baseResult,
          data: await this.formatCriticalView(enhancedResults.results, context)
        };
      
      case 'summary':
        return {
          ...baseResult,
          data: await this.formatSummaryView(enhancedResults.results, context)
        };
      
      default:
        return {
          ...baseResult,
          data: enhancedResults.results
        };
    }
  }

  async formatListView(results, context) {
    return {
      type: 'list',
      results: results.map(result => ({
        id: result._id,
        patientName: result.patient ? `${result.patient.firstName} ${result.patient.lastName}` : 'Unknown',
        patientMRN: result.patient?.mrn,
        testName: result.testName,
        testCode: result.testCode,
        result: result.result,
        units: result.units,
        referenceRange: result.referenceRange,
        abnormalFlag: result.abnormalFlag,
        interpretation: result.interpretation,
        resultDate: result.resultDate,
        performingLab: result.performingLab,
        isCritical: result.isCritical,
        criticalLevel: result.criticalLevel,
        orderNumber: result.orderNumber
      }))
    };
  }

  async formatTimelineView(results, context) {
    // Group results by patient and test
    const timelineData = {};
    
    for (const result of results) {
      const patientKey = result.patientId;
      const testKey = result.testCode;
      
      if (!timelineData[patientKey]) {
        timelineData[patientKey] = {
          patient: result.patient,
          tests: {}
        };
      }
      
      if (!timelineData[patientKey].tests[testKey]) {
        timelineData[patientKey].tests[testKey] = {
          testName: result.testName,
          testCode: result.testCode,
          units: result.units,
          referenceRange: result.referenceRange,
          timeline: []
        };
      }
      
      timelineData[patientKey].tests[testKey].timeline.push({
        date: result.resultDate,
        value: result.result,
        abnormalFlag: result.abnormalFlag,
        isCritical: result.isCritical,
        orderNumber: result.orderNumber,
        performingLab: result.performingLab
      });
    }

    // Sort timeline points by date
    Object.values(timelineData).forEach(patient => {
      Object.values(patient.tests).forEach(test => {
        test.timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
      });
    });

    return {
      type: 'timeline',
      patients: timelineData
    };
  }

  async formatTrendsView(results, context) {
    const chartService = new ChartGenerationService();
    const trendsData = {};

    // Group by test code
    const resultsByTest = results.reduce((acc, result) => {
      if (!acc[result.testCode]) {
        acc[result.testCode] = {
          testName: result.testName,
          testCode: result.testCode,
          units: result.units,
          referenceRange: result.referenceRange,
          results: []
        };
      }
      acc[result.testCode].results.push(result);
      return acc;
    }, {});

    // Generate trend charts for each test
    for (const [testCode, testData] of Object.entries(resultsByTest)) {
      const chartData = await chartService.generateTrendChart({
        testName: testData.testName,
        testCode: testCode,
        units: testData.units,
        referenceRange: testData.referenceRange,
        dataPoints: testData.results.map(r => ({
          date: r.resultDate,
          value: parseFloat(r.result) || r.result,
          abnormal: r.abnormalFlag !== 'N',
          critical: r.isCritical
        }))
      });

      trendsData[testCode] = {
        ...testData,
        chartData,
        statistics: this.calculateTrendStatistics(testData.results)
      };
    }

    return {
      type: 'trends',
      trends: trendsData
    };
  }

  async formatComparisonView(results, context) {
    const comparisonData = {
      type: 'comparison',
      comparisons: []
    };

    // Group by patient and test for comparison
    const grouped = results.reduce((acc, result) => {
      const key = `${result.patientId}-${result.testCode}`;
      if (!acc[key]) {
        acc[key] = {
          patient: result.patient,
          testName: result.testName,
          testCode: result.testCode,
          units: result.units,
          referenceRange: result.referenceRange,
          results: []
        };
      }
      acc[key].results.push(result);
      return acc;
    }, {});

    // Create comparisons
    for (const group of Object.values(grouped)) {
      if (group.results.length >= 2) {
        // Sort by date
        group.results.sort((a, b) => new Date(b.resultDate) - new Date(a.resultDate));
        
        const latest = group.results[0];
        const previous = group.results[1];
        
        comparisonData.comparisons.push({
          patient: group.patient,
          test: {
            name: group.testName,
            code: group.testCode,
            units: group.units,
            referenceRange: group.referenceRange
          },
          current: {
            value: latest.result,
            date: latest.resultDate,
            abnormal: latest.abnormalFlag !== 'N',
            critical: latest.isCritical
          },
          previous: {
            value: previous.result,
            date: previous.resultDate,
            abnormal: previous.abnormalFlag !== 'N',
            critical: previous.isCritical
          },
          change: this.calculateChange(latest.result, previous.result),
          trend: this.determineTrend(latest.result, previous.result, group.referenceRange)
        });
      }
    }

    return comparisonData;
  }

  async formatCriticalView(results, context) {
    const criticalResults = results.filter(r => r.isCritical);
    
    return {
      type: 'critical',
      criticalCount: criticalResults.length,
      results: criticalResults.map(result => ({
        id: result._id,
        patientName: result.patient ? `${result.patient.firstName} ${result.patient.lastName}` : 'Unknown',
        patientMRN: result.patient?.mrn,
        testName: result.testName,
        value: `${result.result} ${result.units}`,
        criticalLevel: result.criticalLevel,
        referenceRange: result.referenceRange,
        resultDate: result.resultDate,
        timeSinceResult: this.calculateTimeSince(result.resultDate),
        orderNumber: result.orderNumber,
        acknowledged: result.acknowledgedAt ? true : false,
        acknowledgedBy: result.acknowledgedBy
      })),
      summary: {
        panicValues: criticalResults.filter(r => r.criticalLevel === 'panic').length,
        criticalValues: criticalResults.filter(r => r.criticalLevel === 'critical').length,
        unacknowledged: criticalResults.filter(r => !r.acknowledgedAt).length
      }
    };
  }

  async formatSummaryView(results, context) {
    const summary = {
      type: 'summary',
      totalResults: results.length,
      dateRange: {
        earliest: results.reduce((min, r) => r.resultDate < min ? r.resultDate : min, new Date()),
        latest: results.reduce((max, r) => r.resultDate > max ? r.resultDate : max, new Date('1900-01-01'))
      },
      breakdown: {
        byCategory: {},
        byAbnormalFlag: {
          normal: 0,
          low: 0,
          high: 0,
          abnormal: 0
        },
        byCriticalLevel: {
          normal: 0,
          abnormal: 0,
          critical: 0,
          panic: 0
        },
        byLaboratory: {},
        byStatus: {}
      },
      topTests: {}
    };

    // Calculate breakdown statistics
    for (const result of results) {
      // Category breakdown
      const category = result.category || 'uncategorized';
      summary.breakdown.byCategory[category] = (summary.breakdown.byCategory[category] || 0) + 1;

      // Abnormal flag breakdown
      switch (result.abnormalFlag) {
        case 'N':
          summary.breakdown.byAbnormalFlag.normal++;
          break;
        case 'L':
        case 'LL':
          summary.breakdown.byAbnormalFlag.low++;
          break;
        case 'H':
        case 'HH':
          summary.breakdown.byAbnormalFlag.high++;
          break;
        default:
          summary.breakdown.byAbnormalFlag.abnormal++;
      }

      // Critical level breakdown
      const criticalLevel = result.criticalLevel || 'normal';
      summary.breakdown.byCriticalLevel[criticalLevel]++;

      // Laboratory breakdown
      const lab = result.performingLab || 'unknown';
      summary.breakdown.byLaboratory[lab] = (summary.breakdown.byLaboratory[lab] || 0) + 1;

      // Status breakdown
      const status = result.resultStatus || 'unknown';
      summary.breakdown.byStatus[status] = (summary.breakdown.byStatus[status] || 0) + 1;

      // Top tests
      summary.topTests[result.testCode] = (summary.topTests[result.testCode] || 0) + 1;
    }

    // Convert top tests to sorted array
    summary.topTests = Object.entries(summary.topTests)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([testCode, count]) => {
        const result = results.find(r => r.testCode === testCode);
        return {
          testCode,
          testName: result?.testName,
          count
        };
      });

    return summary;
  }

  // Helper methods
  async interpretResult(result) {
    const interpretation = {
      status: 'normal',
      significance: 'within_normal_limits',
      recommendations: []
    };

    if (result.isCritical) {
      interpretation.status = 'critical';
      interpretation.significance = 'immediate_attention_required';
      interpretation.recommendations.push('Contact physician immediately');
    } else if (result.abnormalFlag && result.abnormalFlag !== 'N') {
      interpretation.status = 'abnormal';
      interpretation.significance = 'outside_reference_range';
      
      if (result.abnormalFlag === 'H' || result.abnormalFlag === 'HH') {
        interpretation.recommendations.push('Consider clinical correlation for elevated value');
      } else if (result.abnormalFlag === 'L' || result.abnormalFlag === 'LL') {
        interpretation.recommendations.push('Consider clinical correlation for low value');
      }
    }

    return interpretation;
  }

  async getTrendData(result, context) {
    const historicalResults = await SecureDataAccess.query('lab_results',
      {
        patientId: result.patientId,
        testCode: result.testCode,
        resultDate: { $lt: result.resultDate }
      },
      { 
        sort: { resultDate: -1 },
        limit: 10
      },
      context
    );

    return {
      hasHistory: historicalResults.length > 0,
      pointCount: historicalResults.length,
      trend: historicalResults.length > 1 ? this.calculateTrend(historicalResults) : 'insufficient_data'
    };
  }

  calculateChange(current, previous) {
    const currentNum = parseFloat(current);
    const previousNum = parseFloat(previous);
    
    if (isNaN(currentNum) || isNaN(previousNum)) {
      return { type: 'text_comparison', current, previous };
    }

    const difference = currentNum - previousNum;
    const percentChange = previousNum !== 0 ? (difference / previousNum) * 100 : 0;

    return {
      type: 'numeric',
      difference: difference.toFixed(2),
      percentChange: percentChange.toFixed(1),
      direction: difference > 0 ? 'increased' : difference < 0 ? 'decreased' : 'unchanged'
    };
  }

  calculateTimeSince(resultDate) {
    const now = new Date();
    const diffMs = now - new Date(resultDate);
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Less than 1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  }

  calculateTrendStatistics(results) {
    const values = results
      .map(r => parseFloat(r.result))
      .filter(v => !isNaN(v))
      .sort((a, b) => a - b);

    if (values.length === 0) return null;

    return {
      min: values[0],
      max: values[values.length - 1],
      mean: values.reduce((sum, v) => sum + v, 0) / values.length,
      median: values.length % 2 === 0 
        ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
        : values[Math.floor(values.length / 2)],
      count: values.length
    };
  }

  summarizeFilters(viewRequest) {
    const filters = {};
    
    if (viewRequest.patientId) filters.patient = 'specific';
    if (viewRequest.startDate || viewRequest.endDate) filters.dateRange = 'applied';
    if (viewRequest.testCodes?.length) filters.tests = viewRequest.testCodes.length;
    if (viewRequest.criticalOnly) filters.criticalOnly = true;
    if (viewRequest.abnormalOnly) filters.abnormalOnly = true;
    
    return filters;
  }

  async validateViewRequest(request, context) {
    if (request.page && request.page < 1) {
      throw new Error('Page number must be greater than 0');
    }
    
    if (request.limit && (request.limit < 1 || request.limit > 1000)) {
      throw new Error('Limit must be between 1 and 1000');
    }
  }

  async createAuditLog(viewRequest, metadata, context) {
    await AuditLog.create({
      action: 'VIEW_LAB_RESULTS',
      userId: context.userId,
      practiceId: context.practiceId,
      details: {
        viewType: viewRequest.viewType,
        resultsCount: metadata.totalCount,
        filters: metadata.filters
      },
      timestamp: new Date()
    });
  }
}

module.exports = LabResultsViewingService;
```

### 2. API Endpoints

```javascript
// File: backend/routes/labResultsViewing.js
const express = require('express');
const router = express.Router();
const LabResultsViewingService = require('../services/labResultsViewingService');
const { requireAuth } = require('../middleware/auth');

router.get('/view', requireAuth, async (req, res) => {
  try {
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'lab-results-viewing-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_LAB_RESULTS_VIEWING_KEY')
    };

    const viewRequest = {
      viewType: req.query.viewType || 'list',
      patientId: req.query.patientId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      testCodes: req.query.testCodes ? req.query.testCodes.split(',') : null,
      categories: req.query.categories ? req.query.categories.split(',') : null,
      criticalOnly: req.query.criticalOnly === 'true',
      abnormalOnly: req.query.abnormalOnly === 'true',
      providerId: req.query.providerId,
      laboratoryId: req.query.laboratoryId,
      status: req.query.status,
      searchText: req.query.searchText,
      sortBy: req.query.sortBy || 'date_desc',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 100
    };

    const viewingService = new LabResultsViewingService();
    const result = await viewingService.viewResults(viewRequest, context);

    res.json({
      success: true,
      view: result,
      message: {
        he: 'תוצאות מעבדה נטענו בהצלחה',
        en: 'Lab results loaded successfully'
      }
    });

  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה בטעינת תוצאות מעבדה',
        en: 'Error loading lab results'
      },
      details: error.message
    });
  }
});

router.get('/export', requireAuth, async (req, res) => {
  try {
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'lab-results-viewing-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_LAB_RESULTS_VIEWING_KEY')
    };

    const viewRequest = {
      viewType: 'list',
      patientId: req.query.patientId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      testCodes: req.query.testCodes ? req.query.testCodes.split(',') : null,
      exportFormat: req.query.format || 'csv',
      limit: 10000 // High limit for exports
    };

    const viewingService = new LabResultsViewingService();
    const result = await viewingService.viewResults(viewRequest, context);

    const exportService = new ExportService();
    const exportedData = await exportService.exportLabResults(result, viewRequest.exportFormat);

    res.setHeader('Content-Type', exportedData.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportedData.filename}"`);
    res.send(exportedData.content);

  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה בייצוא תוצאות',
        en: 'Error exporting results'
      },
      details: error.message
    });
  }
});
```

### 3. Frontend Component

```jsx
// File: frontend-vite/src/components/lab/LabResultsViewer.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Search, Filter, Download, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import secureApi from '../../services/secureApiClient';

const LabResultsViewer = ({ patientId }) => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewType, setViewType] = useState('list');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    criticalOnly: false,
    abnormalOnly: false,
    searchText: ''
  });
  const [sortBy, setSortBy] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (patientId) {
      loadResults();
    }
  }, [patientId, viewType, filters, sortBy, currentPage]);

  const loadResults = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        viewType,
        sortBy,
        page: currentPage.toString(),
        limit: '50'
      });

      if (patientId) params.append('patientId', patientId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.criticalOnly) params.append('criticalOnly', 'true');
      if (filters.abnormalOnly) params.append('abnormalOnly', 'true');
      if (filters.searchText) params.append('searchText', filters.searchText);

      const response = await secureApi.get(`/api/lab-results/view?${params}`);
      setResults(response.data.view);
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportResults = async (format) => {
    try {
      const params = new URLSearchParams({
        format,
        patientId: patientId || '',
        startDate: filters.startDate || '',
        endDate: filters.endDate || ''
      });

      const response = await secureApi.get(`/api/lab-results/export?${params}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lab_results.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting results:', error);
    }
  };

  const getAbnormalColor = (flag) => {
    const colors = {
      'H': 'bg-red-100 text-red-800',
      'HH': 'bg-red-100 text-red-800',
      'L': 'bg-blue-100 text-blue-800',
      'LL': 'bg-blue-100 text-blue-800',
      'A': 'bg-yellow-100 text-yellow-800',
      'N': 'bg-green-100 text-green-800'
    };
    return colors[flag] || 'bg-gray-100 text-gray-800';
  };

  const renderListView = () => (
    <div className="space-y-3">
      {results.data.results.map((result) => (
        <Card key={result.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-medium">{result.testName}</h4>
                  <Badge variant="outline" className="text-xs">
                    {result.testCode}
                  </Badge>
                  {result.isCritical && (
                    <Badge className="bg-red-100 text-red-800">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Critical
                    </Badge>
                  )}
                </div>
                
                <div className="text-sm text-gray-600">
                  Patient: {result.patientName} | MRN: {result.patientMRN}
                </div>
                <div className="text-sm text-gray-600">
                  Lab: {result.performingLab} | Order: {result.orderNumber}
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-lg">{result.result}</span>
                  <span className="text-sm text-gray-500">{result.units}</span>
                  {result.abnormalFlag !== 'N' && (
                    <Badge className={getAbnormalColor(result.abnormalFlag)}>
                      {result.abnormalFlag}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  Range: {result.referenceRange}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(result.resultDate).toLocaleDateString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderTrendsView = () => (
    <div className="space-y-6">
      {Object.entries(results.data.trends || {}).map(([testCode, trendData]) => (
        <Card key={testCode}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {trendData.testName} ({testCode})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-50 rounded flex items-center justify-center mb-4">
              <span className="text-gray-500">Chart visualization would go here</span>
            </div>
            
            {trendData.statistics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Latest:</span>
                  <div>{trendData.results[0]?.result} {trendData.units}</div>
                </div>
                <div>
                  <span className="font-medium">Average:</span>
                  <div>{trendData.statistics.mean?.toFixed(2)} {trendData.units}</div>
                </div>
                <div>
                  <span className="font-medium">Range:</span>
                  <div>{trendData.statistics.min} - {trendData.statistics.max}</div>
                </div>
                <div>
                  <span className="font-medium">Count:</span>
                  <div>{trendData.statistics.count} results</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderCriticalView = () => (
    <div className="space-y-4">
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-800">Critical Values Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-red-600">
                {results.data.summary?.panicValues || 0}
              </div>
              <div className="text-sm text-red-800">Panic Values</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {results.data.summary?.criticalValues || 0}
              </div>
              <div className="text-sm text-orange-800">Critical Values</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {results.data.summary?.unacknowledged || 0}
              </div>
              <div className="text-sm text-yellow-800">Unacknowledged</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {results.data.results?.map((result) => (
          <Card key={result.id} className="border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="font-medium">{result.testName}</span>
                    <Badge className="bg-red-100 text-red-800">
                      {result.criticalLevel?.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {result.patientName} | {result.timeSinceResult}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg text-red-700">
                    {result.value}
                  </div>
                  <div className="text-xs text-gray-500">
                    Normal: {result.referenceRange}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Lab Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* View Type Selector */}
            <div>
              <label className="block text-sm font-medium mb-2">View Type</label>
              <div className="flex gap-2">
                {[
                  { value: 'list', label: 'List', icon: Filter },
                  { value: 'trends', label: 'Trends', icon: TrendingUp },
                  { value: 'critical', label: 'Critical', icon: AlertTriangle }
                ].map(type => (
                  <Button
                    key={type.value}
                    variant={viewType === type.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewType(type.value)}
                  >
                    <type.icon className="h-4 w-4 mr-1" />
                    {type.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({...prev, startDate: e.target.value}))}
                  className="w-full border rounded px-3 py-1 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({...prev, endDate: e.target.value}))}
                  className="w-full border rounded px-3 py-1 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.searchText}
                    onChange={(e) => setFilters(prev => ({...prev, searchText: e.target.value}))}
                    className="w-full border rounded pl-8 pr-3 py-1 text-sm"
                    placeholder="Search tests..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full border rounded px-3 py-1 text-sm"
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="test_name">Test Name</option>
                  <option value="critical_first">Critical First</option>
                  <option value="abnormal_first">Abnormal First</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.criticalOnly}
                  onChange={(e) => setFilters(prev => ({...prev, criticalOnly: e.target.checked}))}
                  className="rounded"
                />
                <span className="text-sm">Critical only</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.abnormalOnly}
                  onChange={(e) => setFilters(prev => ({...prev, abnormalOnly: e.target.checked}))}
                  className="rounded"
                />
                <span className="text-sm">Abnormal only</span>
              </label>
            </div>

            {/* Export Options */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportResults('csv')}>
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportResults('pdf')}>
                <Download className="h-4 w-4 mr-1" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Display */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-gray-500">Loading results...</div>
          </CardContent>
        </Card>
      ) : results ? (
        <div>
          {viewType === 'list' && renderListView()}
          {viewType === 'trends' && renderTrendsView()}
          {viewType === 'critical' && renderCriticalView()}
          
          {/* Pagination */}
          {results.metadata?.totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  Previous
                </Button>
                <span className="px-3 py-1 text-sm">
                  Page {currentPage} of {results.metadata.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === results.metadata.totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-gray-500">No results found</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LabResultsViewer;
```

## Test Cases

### Unit Tests

```javascript
// File: backend/tests/labResultsViewingService.test.js
const LabResultsViewingService = require('../services/labResultsViewingService');

describe('LabResultsViewingService', () => {
  let service;
  let mockContext;

  beforeEach(() => {
    service = new LabResultsViewingService();
    mockContext = {
      userId: 'user123',
      practiceId: 'clinic123'
    };
  });

  test('should build query correctly with filters', async () => {
    const viewRequest = {
      patientId: 'patient123',
      criticalOnly: true,
      startDate: '2024-01-01'
    };

    const query = await service.buildResultsQuery(viewRequest, mockContext);
    expect(query.patientId).toBe('patient123');
    expect(query.isCritical).toBe(true);
    expect(query.resultDate.$gte).toEqual(new Date('2024-01-01'));
  });

  test('should calculate change correctly', () => {
    const change = service.calculateChange('150', '100');
    expect(change.type).toBe('numeric');
    expect(change.direction).toBe('increased');
    expect(parseFloat(change.difference)).toBe(50);
  });

  test('should format time since correctly', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = service.calculateTimeSince(twoHoursAgo);
    expect(result).toBe('2 hours ago');
  });
});
```

## Dependencies
- SecureDataAccess service
- Chart generation service
- Export service
- Audit logging system

## Success Criteria
- [ ] Multiple view types implemented (list, trends, comparison, critical)
- [ ] Advanced filtering and sorting working
- [ ] Trend analysis with statistical calculations
- [ ] Critical value highlighting and alerts
- [ ] Export functionality in multiple formats
- [ ] Pagination for large result sets
- [ ] Patient and test-specific filtering
- [ ] Real-time result interpretation
- [ ] Performance optimized for large datasets
- [ ] Complete audit trail for data access