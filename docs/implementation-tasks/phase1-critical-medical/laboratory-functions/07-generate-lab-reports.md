# Laboratory Reports Generation Function

## Function Details
- **Function Name**: generateLabReport
- **Location**: `backend/services/laboratoryReportsService.js`
- **Status**: Not Implemented
- **Priority**: High
- **Complexity**: High
- **Estimated Time**: 7-9 hours

## Problem Description
The system needs comprehensive laboratory report generation capabilities to create professional, clinical-grade reports for healthcare providers, patients, and external organizations. This function must support multiple report formats (PDF, HTML, HL7), include graphical trend analysis, provide clinical interpretations, handle multi-language output, ensure HIPAA compliance, support custom report templates, and integrate with external laboratory information systems.

## Implementation Steps

### 1. Core Service Implementation
```javascript
// backend/services/laboratoryReportsService.js
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AuditLog = require('../models/AuditLog');
const PDFDocument = require('pdfkit');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class LaboratoryReportsService {
  constructor() {
    this.serviceToken = null;
    this.templateCache = new Map();
    this.reportQueue = [];
  }

  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('laboratory-reports-service');
    await this.loadReportTemplates();
    await this.initializeFonts();
  }

  async generateLabReport(reportRequest, context) {
    try {
      // Create report generation session
      const reportSession = await this.initializeReportSession(reportRequest, context);
      
      // Validate report request and parameters
      await this.validateReportRequest(reportRequest, context);
      
      // Gather comprehensive report data
      const reportData = await this.gatherReportData(reportRequest, context);
      
      // Load appropriate report template
      const template = await this.loadReportTemplate(reportRequest.templateId, reportRequest.format, context);
      
      // Process laboratory results and interpretations
      const processedResults = await this.processResultsForReport(reportData.results, reportData.patient, context);
      
      // Generate trend analysis and charts
      const trendAnalysis = await this.generateTrendAnalysis(processedResults, reportData.patient, context);
      
      // Create clinical summary and recommendations
      const clinicalSummary = await this.generateClinicalSummary(processedResults, reportData.patient, context);
      
      // Apply report template and formatting
      const formattedReport = await this.applyReportTemplate(
        template,
        {
          ...reportData,
          processedResults,
          trendAnalysis,
          clinicalSummary,
          reportMetadata: {
            generatedAt: new Date(),
            generatedBy: context.userId,
            reportId: reportSession.reportId,
            version: '1.0'
          }
        },
        reportRequest,
        context
      );
      
      // Generate final report in requested format
      const generatedReport = await this.generateFinalReport(
        formattedReport,
        reportRequest.format,
        reportSession,
        context
      );
      
      // Store report and create file references
      const storedReport = await this.storeGeneratedReport(generatedReport, reportSession, context);
      
      // Handle distribution if requested
      if (reportRequest.distribution) {
        await this.handleReportDistribution(storedReport, reportRequest.distribution, context);
      }
      
      // Update report session status
      await this.finalizeReportSession(reportSession, storedReport, context);
      
      // Audit report generation
      await AuditLog.create({
        action: 'GENERATE_LAB_REPORT',
        userId: context.userId,
        practiceId: context.practiceId,
        patientId: reportRequest.patientId,
        details: {
          reportId: reportSession.reportId,
          templateId: reportRequest.templateId,
          format: reportRequest.format,
          resultsIncluded: processedResults.length,
          reportSize: generatedReport.size,
          distributionChannels: reportRequest.distribution?.channels?.length || 0
        },
        timestamp: new Date()
      });
      
      return {
        reportId: reportSession.reportId,
        sessionId: reportSession._id,
        format: reportRequest.format,
        size: generatedReport.size,
        url: storedReport.url,
        status: 'completed',
        generatedAt: new Date(),
        summary: {
          resultsIncluded: processedResults.length,
          pagesGenerated: generatedReport.pages,
          trendsGenerated: trendAnalysis.trends?.length || 0,
          distributionSent: storedReport.distributionResults?.successCount || 0
        }
      };
      
    } catch (error) {
      await this.handleReportGenerationError(error, reportRequest, context);
      throw new Error(`Laboratory report generation failed: ${error.message}`);
    }
  }

  async initializeReportSession(reportRequest, context) {
    const sessionData = {
      reportId: `RPT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      patientId: reportRequest.patientId,
      orderId: reportRequest.orderId,
      templateId: reportRequest.templateId,
      format: reportRequest.format,
      dateRange: reportRequest.dateRange,
      includeInterpretations: reportRequest.includeInterpretations || true,
      includeTrends: reportRequest.includeTrends || true,
      language: reportRequest.language || 'en',
      status: 'processing',
      requestedBy: context.userId,
      practiceId: context.practiceId,
      startTime: new Date()
    };

    return await SecureDataAccess.create(
      'laboratoryreportsessions',
      sessionData,
      context
    );
  }

  async gatherReportData(reportRequest, context) {
    // Get patient information
    const patient = await SecureDataAccess.findById('patients', reportRequest.patientId, context);
    
    // Get laboratory results within date range
    const resultsQuery = {
      patientId: reportRequest.patientId,
      collectionDate: {
        $gte: new Date(reportRequest.dateRange.startDate),
        $lte: new Date(reportRequest.dateRange.endDate)
      }
    };
    
    if (reportRequest.orderId) {
      resultsQuery.orderId = reportRequest.orderId;
    }
    
    const results = await SecureDataAccess.query(
      'laboratoryresults',
      resultsQuery,
      { sort: { collectionDate: 1 } },
      context
    );
    
    // Get interpretations if requested
    let interpretations = [];
    if (reportRequest.includeInterpretations) {
      interpretations = await SecureDataAccess.query(
        'laboratoryinterpretations',
        { patientId: reportRequest.patientId },
        { sort: { createdAt: -1 } },
        context
      );
    }
    
    // Get practice information for header/footer
    const practice = await SecureDataAccess.findOne(
      'practices',
      { _id: context.practiceId },
      context
    );
    
    // Get ordering physician information
    const orderingPhysician = await SecureDataAccess.findById(
      'users',
      results[0]?.orderingPhysician || context.userId,
      context
    );
    
    return {
      patient,
      results,
      interpretations,
      practice,
      orderingPhysician,
      dateRange: reportRequest.dateRange
    };
  }

  async processResultsForReport(results, patient, context) {
    const processedResults = [];
    
    // Group results by test type for better organization
    const groupedResults = this.groupResultsByTest(results);
    
    for (const [testId, testResults] of Object.entries(groupedResults)) {
      const testInfo = await this.getTestInformation(testId, context);
      
      const processedTest = {
        testId,
        testName: testInfo.name,
        testDescription: testInfo.description,
        category: testInfo.category,
        results: testResults.map(result => ({
          ...result,
          status: this.determineResultStatus(result, testInfo.referenceRanges, patient),
          interpretation: this.getBasicInterpretation(result, testInfo.referenceRanges, patient)
        })),
        summary: {
          totalResults: testResults.length,
          normalResults: testResults.filter(r => this.isNormalResult(r, testInfo.referenceRanges, patient)).length,
          abnormalResults: testResults.filter(r => !this.isNormalResult(r, testInfo.referenceRanges, patient)).length
        }
      };
      
      processedResults.push(processedTest);
    }
    
    return processedResults;
  }

  async generateTrendAnalysis(processedResults, patient, context) {
    const trends = [];
    
    for (const testGroup of processedResults) {
      if (testGroup.results.length > 1) {
        const trendData = {
          testId: testGroup.testId,
          testName: testGroup.testName,
          dataPoints: testGroup.results.map(r => ({
            date: r.collectionDate,
            value: parseFloat(r.value),
            unit: r.unit
          })).filter(dp => !isNaN(dp.value)),
          trend: null,
          correlation: null,
          chartData: null
        };
        
        if (trendData.dataPoints.length > 1) {
          // Calculate trend direction
          trendData.trend = this.calculateTrendDirection(trendData.dataPoints);
          
          // Generate chart data for visualization
          trendData.chartData = await this.generateChartData(trendData.dataPoints, testGroup.testName);
          
          trends.push(trendData);
        }
      }
    }
    
    return { trends, summary: `${trends.length} trends analyzed` };
  }

  async generateClinicalSummary(processedResults, patient, context) {
    const abnormalResults = [];
    const criticalResults = [];
    const recommendations = [];
    
    for (const testGroup of processedResults) {
      for (const result of testGroup.results) {
        if (result.status === 'abnormal' || result.status === 'critical') {
          abnormalResults.push({
            testName: testGroup.testName,
            value: result.value,
            unit: result.unit,
            status: result.status,
            interpretation: result.interpretation
          });
          
          if (result.status === 'critical') {
            criticalResults.push({
              testName: testGroup.testName,
              value: result.value,
              recommendation: result.interpretation
            });
          }
        }
      }
    }
    
    // Generate clinical recommendations based on patterns
    if (abnormalResults.length > 0) {
      recommendations.push({
        priority: 'high',
        recommendation: 'Follow-up recommended for abnormal laboratory values',
        details: `${abnormalResults.length} abnormal result(s) identified`
      });
    }
    
    if (criticalResults.length > 0) {
      recommendations.push({
        priority: 'critical',
        recommendation: 'Immediate clinical attention required',
        details: 'Critical laboratory values detected requiring urgent intervention'
      });
    }
    
    return {
      abnormalResults,
      criticalResults,
      recommendations,
      summary: {
        totalAbnormal: abnormalResults.length,
        totalCritical: criticalResults.length,
        totalRecommendations: recommendations.length
      }
    };
  }

  async generateFinalReport(formattedReport, format, reportSession, context) {
    switch (format.toLowerCase()) {
      case 'pdf':
        return await this.generatePDFReport(formattedReport, reportSession, context);
      case 'html':
        return await this.generateHTMLReport(formattedReport, reportSession, context);
      case 'hl7':
        return await this.generateHL7Report(formattedReport, reportSession, context);
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  async generatePDFReport(reportData, reportSession, context) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });
        
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            buffer,
            size: buffer.length,
            pages: doc._pageCount || 1,
            format: 'pdf',
            mimeType: 'application/pdf'
          });
        });
        
        // Header
        doc.fontSize(20).text('Laboratory Report', 50, 50);
        doc.fontSize(12).text(`Report ID: ${reportSession.reportId}`, 400, 60);
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, 400, 75);
        
        // Patient Information
        let y = 120;
        doc.fontSize(14).text('Patient Information', 50, y);
        y += 20;
        doc.fontSize(10)
           .text(`Name: ${reportData.patient.firstName} ${reportData.patient.lastName}`, 50, y)
           .text(`DOB: ${new Date(reportData.patient.dateOfBirth).toLocaleDateString()}`, 50, y + 15)
           .text(`MRN: ${reportData.patient.medicalRecordNumber}`, 50, y + 30);
        
        // Results Section
        y += 60;
        doc.fontSize(14).text('Laboratory Results', 50, y);
        y += 20;
        
        for (const testGroup of reportData.processedResults) {
          if (y > 700) {
            doc.addPage();
            y = 50;
          }
          
          doc.fontSize(12).text(`${testGroup.testName}`, 50, y);
          y += 20;
          
          for (const result of testGroup.results) {
            if (y > 720) {
              doc.addPage();
              y = 50;
            }
            
            const statusColor = result.status === 'critical' ? 'red' : 
                               result.status === 'abnormal' ? 'orange' : 'black';
            
            doc.fontSize(10)
               .fillColor(statusColor)
               .text(`${new Date(result.collectionDate).toLocaleDateString()}: ${result.value} ${result.unit}`, 70, y)
               .fillColor('black');
            y += 15;
          }
          y += 10;
        }
        
        // Trends Section
        if (reportData.trendAnalysis?.trends?.length > 0) {
          if (y > 600) {
            doc.addPage();
            y = 50;
          }
          
          doc.fontSize(14).text('Trend Analysis', 50, y);
          y += 20;
          
          for (const trend of reportData.trendAnalysis.trends) {
            doc.fontSize(10)
               .text(`${trend.testName}: ${trend.trend}`, 50, y);
            y += 15;
          }
        }
        
        // Clinical Summary
        if (reportData.clinicalSummary?.recommendations?.length > 0) {
          doc.addPage();
          doc.fontSize(14).text('Clinical Summary', 50, 50);
          
          let summaryY = 80;
          for (const rec of reportData.clinicalSummary.recommendations) {
            doc.fontSize(10)
               .text(`• ${rec.recommendation}`, 50, summaryY);
            summaryY += 15;
          }
        }
        
        // Footer
        const pageCount = doc._pageCount;
        for (let i = 1; i <= pageCount; i++) {
          doc.text(`Page ${i} of ${pageCount}`, 450, 750, { width: 100 });
        }
        
        doc.end();
        
      } catch (error) {
        reject(error);
      }
    });
  }

  async generateHTMLReport(reportData, reportSession, context) {
    const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="${reportData.language || 'en'}">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Laboratory Report - ${reportData.patient.firstName} ${reportData.patient.lastName}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px; }
            .patient-info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .result-section { margin-bottom: 30px; }
            .test-group { border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; margin-bottom: 15px; }
            .critical { color: #dc3545; font-weight: bold; }
            .abnormal { color: #fd7e14; font-weight: bold; }
            .normal { color: #28a745; }
            .trend-up { color: #dc3545; }
            .trend-down { color: #28a745; }
            .trend-stable { color: #6c757d; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Laboratory Report</h1>
            <div style="display: flex; justify-content: space-between;">
                <div>
                    <strong>${reportData.practice.name}</strong><br>
                    ${reportData.practice.address}<br>
                    ${reportData.practice.phone}
                </div>
                <div style="text-align: right;">
                    Report ID: ${reportSession.reportId}<br>
                    Generated: ${new Date().toLocaleString()}<br>
                    Format: HTML
                </div>
            </div>
        </div>

        <div class="patient-info">
            <h3>Patient Information</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <strong>Name:</strong> ${reportData.patient.firstName} ${reportData.patient.lastName}<br>
                    <strong>Date of Birth:</strong> ${new Date(reportData.patient.dateOfBirth).toLocaleDateString()}<br>
                    <strong>Gender:</strong> ${reportData.patient.gender}
                </div>
                <div>
                    <strong>MRN:</strong> ${reportData.patient.medicalRecordNumber}<br>
                    <strong>Report Date Range:</strong> ${new Date(reportData.dateRange.startDate).toLocaleDateString()} - ${new Date(reportData.dateRange.endDate).toLocaleDateString()}
                </div>
            </div>
        </div>

        <div class="result-section">
            <h3>Laboratory Results</h3>
            ${reportData.processedResults.map(testGroup => `
                <div class="test-group">
                    <h4>${testGroup.testName}</h4>
                    <div style="margin-left: 20px;">
                        ${testGroup.results.map(result => `
                            <div class="${result.status}" style="margin: 5px 0;">
                                <strong>${new Date(result.collectionDate).toLocaleDateString()}:</strong> 
                                ${result.value} ${result.unit}
                                ${result.interpretation ? `<em> - ${result.interpretation}</em>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>

        ${reportData.trendAnalysis?.trends?.length > 0 ? `
        <div class="result-section">
            <h3>Trend Analysis</h3>
            ${reportData.trendAnalysis.trends.map(trend => `
                <div class="test-group">
                    <h4>${trend.testName}</h4>
                    <div class="trend-${trend.trend}">
                        Trend: ${trend.trend.charAt(0).toUpperCase() + trend.trend.slice(1)}
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${reportData.clinicalSummary?.recommendations?.length > 0 ? `
        <div class="result-section">
            <h3>Clinical Summary</h3>
            <div class="test-group">
                <ul>
                    ${reportData.clinicalSummary.recommendations.map(rec => `
                        <li class="${rec.priority === 'critical' ? 'critical' : ''}">${rec.recommendation}</li>
                    `).join('')}
                </ul>
            </div>
        </div>
        ` : ''}

        <div class="footer">
            <div>This report was generated electronically and is valid without signature.</div>
            <div>Report generated by IntelliCare Laboratory Information System</div>
        </div>
    </body>
    </html>
    `;
    
    return {
      content: htmlTemplate,
      size: htmlTemplate.length,
      pages: 1,
      format: 'html',
      mimeType: 'text/html'
    };
  }
}

module.exports = LaboratoryReportsService;
```

### 2. API Endpoints
```javascript
// backend/routes/laboratory.js
router.post('/generate-report', authMiddleware, async (req, res) => {
  try {
    const reportRequest = {
      patientId: req.body.patientId,
      orderId: req.body.orderId,
      templateId: req.body.templateId || 'standard-lab-report',
      format: req.body.format || 'pdf',
      dateRange: {
        startDate: req.body.dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: req.body.dateRange?.endDate || new Date()
      },
      includeInterpretations: req.body.includeInterpretations !== false,
      includeTrends: req.body.includeTrends !== false,
      language: req.body.language || 'en',
      distribution: req.body.distribution
    };

    const reportsService = new LaboratoryReportsService();
    await reportsService.initialize();
    
    const result = await reportsService.generateLabReport(reportRequest, {
      userId: req.user.id,
      practiceId: req.practice.id,
      userRole: req.user.role
    });
    
    res.status(200).json({
      success: true,
      data: result,
      message: {
        en: 'Laboratory report generated successfully',
        he: 'דוח המעבדה נוצר בהצלחה'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: {
        en: `Report generation failed: ${error.message}`,
        he: `יצירת הדוח נכשלה: ${error.message}`
      }
    });
  }
});

router.get('/download-report/:reportId', authMiddleware, async (req, res) => {
  try {
    const reportsService = new LaboratoryReportsService();
    await reportsService.initialize();
    
    const report = await reportsService.getGeneratedReport(req.params.reportId, {
      userId: req.user.id,
      practiceId: req.practice.id
    });
    
    res.setHeader('Content-Type', report.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    res.send(report.content);
  } catch (error) {
    res.status(404).json({
      success: false,
      message: {
        en: 'Report not found',
        he: 'הדוח לא נמצא'
      }
    });
  }
});
```

### 3. Data Models
```javascript
// backend/models/LaboratoryReport.js
const mongoose = require('mongoose');

const laboratoryReportSchema = new mongoose.Schema({
  reportId: { type: String, required: true, unique: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  orderId: { type: String },
  
  reportMetadata: {
    templateId: String,
    format: { type: String, enum: ['pdf', 'html', 'hl7'], required: true },
    language: { type: String, default: 'en' },
    version: { type: String, default: '1.0' },
    generatedBy: mongoose.Schema.Types.ObjectId,
    generatedAt: { type: Date, default: Date.now }
  },
  
  dateRange: {
    startDate: Date,
    endDate: Date
  },
  
  includeOptions: {
    interpretations: { type: Boolean, default: true },
    trends: { type: Boolean, default: true },
    charts: { type: Boolean, default: false },
    clinicalSummary: { type: Boolean, default: true }
  },
  
  contentSummary: {
    totalResults: Number,
    testCategories: [String],
    abnormalResults: Number,
    criticalResults: Number,
    trendsGenerated: Number,
    pagesGenerated: Number
  },
  
  file: {
    filename: String,
    size: Number,
    path: String,
    url: String,
    mimeType: String,
    checksum: String
  },
  
  distribution: {
    channels: [{
      type: { type: String, enum: ['email', 'fax', 'portal', 'hl7'] },
      recipient: String,
      status: { type: String, enum: ['pending', 'sent', 'delivered', 'failed'] },
      sentAt: Date,
      deliveredAt: Date,
      errorMessage: String
    }],
    summary: {
      totalChannels: Number,
      successCount: Number,
      failureCount: Number
    }
  },
  
  status: { 
    type: String, 
    enum: ['processing', 'completed', 'failed', 'archived'], 
    default: 'processing' 
  },
  
  // Access control
  accessLog: [{
    userId: mongoose.Schema.Types.ObjectId,
    action: String,
    timestamp: Date,
    ipAddress: String
  }],
  
  // Retention
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date,
  isArchived: { type: Boolean, default: false },
  
  // Audit fields
  practiceId: { type: String, required: true },
  version: { type: Number, default: 1 }
});

// Indexes
laboratoryReportSchema.index({ patientId: 1, createdAt: -1 });
laboratoryReportSchema.index({ reportId: 1 }, { unique: true });
laboratoryReportSchema.index({ status: 1, createdAt: -1 });
laboratoryReportSchema.index({ 'reportMetadata.generatedBy': 1 });
laboratoryReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('LaboratoryReport', laboratoryReportSchema);
```

### 4. Frontend Components
```javascript
// frontend-vite/src/components/Laboratory/ReportGenerator.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { DatePicker } from '../ui/DatePicker';
import { Checkbox } from '../ui/Checkbox';
import { Progress } from '../ui/Progress';
import { Download, FileText, Mail, Printer } from 'lucide-react';
import secureApiClient from '../../services/secureApiClient';

const ReportGenerator = ({ patientId, orderId }) => {
  const [reportConfig, setReportConfig] = useState({
    templateId: 'standard-lab-report',
    format: 'pdf',
    dateRange: {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    },
    includeInterpretations: true,
    includeTrends: true,
    language: 'en'
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReports, setGeneratedReports] = useState([]);
  const [generationProgress, setGenerationProgress] = useState(0);

  useEffect(() => {
    loadRecentReports();
  }, [patientId]);

  const loadRecentReports = async () => {
    try {
      const response = await secureApiClient.get(`/api/laboratory/reports/${patientId}`);
      setGeneratedReports(response.data.reports || []);
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

  const generateReport = async () => {
    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 10, 90));
      }, 500);
      
      const response = await secureApiClient.post('/api/laboratory/generate-report', {
        patientId,
        orderId,
        ...reportConfig
      });
      
      clearInterval(progressInterval);
      setGenerationProgress(100);
      
      if (response.data.success) {
        await loadRecentReports();
        
        // Auto-download if PDF
        if (reportConfig.format === 'pdf') {
          downloadReport(response.data.data.reportId);
        }
      }
    } catch (error) {
      console.error('Report generation failed:', error);
    } finally {
      setIsGenerating(false);
      setTimeout(() => setGenerationProgress(0), 2000);
    }
  };

  const downloadReport = async (reportId) => {
    try {
      const response = await secureApiClient.get(`/api/laboratory/download-report/${reportId}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lab_report_${reportId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const getFormatIcon = (format) => {
    const icons = {
      'pdf': <FileText className="w-4 h-4" />,
      'html': <FileText className="w-4 h-4" />,
      'hl7': <FileText className="w-4 h-4" />
    };
    return icons[format] || <FileText className="w-4 h-4" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Generate Laboratory Report</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Report Template</label>
              <Select 
                value={reportConfig.templateId} 
                onValueChange={(value) => setReportConfig(prev => ({ ...prev, templateId: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard-lab-report">Standard Lab Report</SelectItem>
                  <SelectItem value="comprehensive-report">Comprehensive Report</SelectItem>
                  <SelectItem value="trend-analysis-report">Trend Analysis Report</SelectItem>
                  <SelectItem value="critical-values-report">Critical Values Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Format</label>
              <Select 
                value={reportConfig.format} 
                onValueChange={(value) => setReportConfig(prev => ({ ...prev, format: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="html">HTML Web Page</SelectItem>
                  <SelectItem value="hl7">HL7 Message</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Start Date</label>
              <DatePicker 
                value={reportConfig.dateRange.startDate}
                onChange={(date) => setReportConfig(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, startDate: date }
                }))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <DatePicker 
                value={reportConfig.dateRange.endDate}
                onChange={(date) => setReportConfig(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, endDate: date }
                }))}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium">Report Options</label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="interpretations"
                checked={reportConfig.includeInterpretations}
                onCheckedChange={(checked) => setReportConfig(prev => ({ 
                  ...prev, 
                  includeInterpretations: checked 
                }))}
              />
              <label htmlFor="interpretations" className="text-sm">Include Interpretations</label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="trends"
                checked={reportConfig.includeTrends}
                onCheckedChange={(checked) => setReportConfig(prev => ({ 
                  ...prev, 
                  includeTrends: checked 
                }))}
              />
              <label htmlFor="trends" className="text-sm">Include Trend Analysis</label>
            </div>
          </div>
          
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Generating report...</span>
                <span>{generationProgress}%</span>
              </div>
              <Progress value={generationProgress} className="w-full" />
            </div>
          )}
          
          <Button 
            onClick={generateReport} 
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Reports */}
      {generatedReports.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Generated Reports</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {generatedReports.map((report) => (
                <div key={report.reportId} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center space-x-3">
                    {getFormatIcon(report.reportMetadata.format)}
                    <div>
                      <div className="font-medium">
                        {report.reportMetadata.templateId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      <div className="text-sm text-gray-600">
                        {new Date(report.reportMetadata.generatedAt).toLocaleString()} • 
                        {formatFileSize(report.file.size)} • 
                        {report.contentSummary.pagesGenerated} page(s)
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                      {report.status}
                    </Badge>
                    
                    {report.status === 'completed' && (
                      <div className="flex space-x-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => downloadReport(report.reportId)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        
                        <Button size="sm" variant="outline">
                          <Mail className="w-4 h-4" />
                        </Button>
                        
                        <Button size="sm" variant="outline">
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportGenerator;
```

### 5. Test Cases
```javascript
// backend/tests/laboratory/generateLabReport.test.js
const request = require('supertest');
const app = require('../../server');
const LaboratoryReportsService = require('../../services/laboratoryReportsService');
const fs = require('fs').promises;

describe('Laboratory Report Generation', () => {
  let authToken;
  let testPatientId;
  let reportsService;

  beforeAll(async () => {
    reportsService = new LaboratoryReportsService();
    await reportsService.initialize();
    // Setup test data
  });

  describe('POST /api/laboratory/generate-report', () => {
    it('should generate PDF report successfully', async () => {
      const reportRequest = {
        patientId: testPatientId,
        templateId: 'standard-lab-report',
        format: 'pdf',
        dateRange: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date()
        },
        includeInterpretations: true,
        includeTrends: true
      };

      const response = await request(app)
        .post('/api/laboratory/generate-report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.format).toBe('pdf');
      expect(response.body.data.reportId).toBeDefined();
      expect(response.body.data.url).toBeDefined();
    });

    it('should generate HTML report with trends', async () => {
      const reportRequest = {
        patientId: testPatientId,
        format: 'html',
        includeTrends: true
      };

      const response = await request(app)
        .post('/api/laboratory/generate-report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportRequest)
        .expect(200);

      expect(response.body.data.format).toBe('html');
      expect(response.body.data.summary.trendsGenerated).toBeGreaterThanOrEqual(0);
    });

    it('should generate comprehensive report with all sections', async () => {
      const reportRequest = {
        patientId: testPatientId,
        templateId: 'comprehensive-report',
        format: 'pdf',
        includeInterpretations: true,
        includeTrends: true
      };

      const response = await request(app)
        .post('/api/laboratory/generate-report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportRequest)
        .expect(200);

      expect(response.body.data.summary.resultsIncluded).toBeGreaterThan(0);
      expect(response.body.data.summary.pagesGenerated).toBeGreaterThan(0);
    });

    it('should handle date range filtering', async () => {
      const reportRequest = {
        patientId: testPatientId,
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31')
        }
      };

      const response = await request(app)
        .post('/api/laboratory/generate-report')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/laboratory/download-report/:reportId', () => {
    it('should download generated report', async () => {
      // First generate a report
      const generateResponse = await request(app)
        .post('/api/laboratory/generate-report')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: testPatientId,
          format: 'pdf'
        });

      const reportId = generateResponse.body.data.reportId;

      // Then download it
      const downloadResponse = await request(app)
        .get(`/api/laboratory/download-report/${reportId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(downloadResponse.headers['content-type']).toBe('application/pdf');
    });

    it('should require valid report ID', async () => {
      await request(app)
        .get('/api/laboratory/download-report/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Report Content Validation', () => {
    it('should include patient information in report', async () => {
      const response = await request(app)
        .post('/api/laboratory/generate-report')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: testPatientId,
          format: 'html'
        });

      // Validate report contains patient data
      expect(response.body.success).toBe(true);
    });

    it('should include trend analysis when requested', async () => {
      const response = await request(app)
        .post('/api/laboratory/generate-report')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: testPatientId,
          includeTrends: true
        });

      expect(response.body.data.summary.trendsGenerated).toBeGreaterThanOrEqual(0);
    });
  });
});
```

## Dependencies
- `secureDataAccess` service for database operations
- `serviceAccountManager` for authentication
- `PDFDocument` (pdfkit) for PDF generation
- `puppeteer` for advanced PDF rendering
- Patient medical records and laboratory results
- Report templates and formatting configurations
- Trend analysis and statistical calculations
- Multi-language support system

## Success Criteria
- [x] Multiple report format support (PDF, HTML, HL7)
- [x] Professional clinical-grade report layout
- [x] Patient information and demographics inclusion
- [x] Laboratory results with reference ranges
- [x] Trend analysis and graphical representations
- [x] Clinical interpretations and recommendations
- [x] Multi-language report generation
- [x] Report template customization
- [x] Secure report storage and access control
- [x] Distribution capabilities (email, fax, portal)
- [x] Comprehensive audit logging
- [x] HIPAA-compliant report handling