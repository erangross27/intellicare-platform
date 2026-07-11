# Export Vital Data

## Function Details
- **Name**: exportVitalData
- **Status**: Not Implemented
- **Priority**: Critical (Phase 1)
- **Estimated Time**: 3 hours

## Problem Description
Healthcare providers need to export patient vital signs data for various purposes including referrals, patient records transfer, research, reporting, and integration with external systems. The system must support multiple export formats (PDF, CSV, JSON, HL7), customizable date ranges, and maintain HIPAA compliance during data export.

## Implementation Steps

### 1. Create Export Service
```javascript
// backend/services/vitalDataExportService.js

const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const HL7 = require('hl7-standard');
const fs = require('fs').promises;
const crypto = require('crypto');

class VitalDataExportService {
  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('vital-export-service');
    this.exportTemplates = await this.loadExportTemplates();
  }

  async exportVitalData(patientId, options = {}, context) {
    const {
      format = 'pdf',
      startDate,
      endDate = new Date(),
      vitalTypes = 'all',
      includeChart = true,
      includeStatistics = true,
      includeAlerts = true,
      includeNotes = true,
      template = 'standard',
      encrypt = false,
      password = null,
      purpose = 'medical-record'
    } = options;

    // Validate export request
    await this.validateExportRequest(patientId, format, purpose, context);

    // Get patient information
    const patient = await SecureDataAccess.findById('patients', patientId, context);
    
    // Get vital signs data
    const vitalsData = await this.getVitalsForExport(patientId, {
      startDate,
      endDate,
      vitalTypes
    }, context);

    if (vitalsData.length === 0) {
      throw new Error('No vital signs data found for the specified criteria');
    }

    // Get additional data if requested
    let statistics = null;
    let alerts = null;
    
    if (includeStatistics) {
      statistics = await this.calculateExportStatistics(vitalsData);
    }
    
    if (includeAlerts) {
      alerts = await this.getAlertsForExport(patientId, { startDate, endDate }, context);
    }

    // Generate export based on format
    let exportResult;
    
    switch (format.toLowerCase()) {
      case 'pdf':
        exportResult = await this.generatePDF(patient, vitalsData, {
          statistics,
          alerts,
          includeChart,
          includeNotes,
          template
        });
        break;
      
      case 'csv':
        exportResult = await this.generateCSV(patient, vitalsData, { includeNotes });
        break;
      
      case 'excel':
        exportResult = await this.generateExcel(patient, vitalsData, {
          statistics,
          alerts,
          includeChart,
          includeNotes
        });
        break;
      
      case 'json':
        exportResult = await this.generateJSON(patient, vitalsData, {
          statistics,
          alerts,
          includeNotes
        });
        break;
      
      case 'hl7':
        exportResult = await this.generateHL7(patient, vitalsData);
        break;
      
      case 'fhir':
        exportResult = await this.generateFHIR(patient, vitalsData);
        break;
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    // Encrypt if requested
    if (encrypt && password) {
      exportResult = await this.encryptExport(exportResult, password);
    }

    // Create export record
    const exportRecord = await this.createExportRecord({
      patientId,
      format,
      purpose,
      recordCount: vitalsData.length,
      dateRange: { startDate, endDate },
      exportedBy: context.userId,
      practiceId: context.practiceId,
      encrypted: encrypt,
      fileSize: exportResult.data.length
    }, context);

    // Create audit log
    await AuditLog.create({
      action: 'EXPORT_VITAL_DATA',
      userId: context.userId,
      patientId,
      practiceId: context.practiceId,
      severity: 'high',
      details: {
        format,
        purpose,
        recordCount: vitalsData.length,
        encrypted: encrypt,
        exportId: exportRecord._id
      },
      timestamp: new Date()
    });

    return {
      success: true,
      data: exportResult.data,
      metadata: exportResult.metadata,
      exportId: exportRecord._id,
      filename: exportResult.filename
    };
  }

  async generatePDF(patient, vitalsData, options) {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });
    
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    
    // Header
    doc.fontSize(20).text('Vital Signs Report', { align: 'center' });
    doc.fontSize(12).moveDown();
    
    // Patient Information
    doc.fontSize(14).text('Patient Information', { underline: true });
    doc.fontSize(11);
    doc.text(`Name: ${patient.firstName} ${patient.lastName}`);
    doc.text(`MRN: ${patient.mrn}`);
    doc.text(`Date of Birth: ${new Date(patient.dateOfBirth).toLocaleDateString()}`);
    doc.text(`Report Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();
    
    // Summary Statistics
    if (options.statistics) {
      doc.fontSize(14).text('Summary Statistics', { underline: true });
      doc.fontSize(10);
      
      const stats = options.statistics;
      doc.text(`Total Readings: ${vitalsData.length}`);
      doc.text(`Date Range: ${vitalsData[0].dateRecorded} to ${vitalsData[vitalsData.length - 1].dateRecorded}`);
      
      if (stats.bloodPressure) {
        doc.text(`Average BP: ${stats.bloodPressure.avgSystolic}/${stats.bloodPressure.avgDiastolic} mmHg`);
      }
      if (stats.heartRate) {
        doc.text(`Average Heart Rate: ${stats.heartRate.average} bpm`);
      }
      if (stats.temperature) {
        doc.text(`Average Temperature: ${stats.temperature.average}°F`);
      }
      if (stats.oxygenSaturation) {
        doc.text(`Average O2 Saturation: ${stats.oxygenSaturation.average}%`);
      }
      
      doc.moveDown();
    }
    
    // Vital Signs Table
    doc.fontSize(14).text('Vital Signs Data', { underline: true });
    doc.fontSize(9);
    
    // Table header
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 150;
    const col3 = 250;
    const col4 = 350;
    const col5 = 450;
    
    doc.text('Date/Time', col1, tableTop);
    doc.text('BP (mmHg)', col2, tableTop);
    doc.text('HR (bpm)', col3, tableTop);
    doc.text('Temp (°F)', col4, tableTop);
    doc.text('O2 (%)', col5, tableTop);
    
    // Table rows
    let yPosition = tableTop + 20;
    
    vitalsData.forEach((vital, index) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }
      
      const date = new Date(vital.dateRecorded).toLocaleString();
      const bp = vital.vitals.bloodPressure ? 
        `${vital.vitals.bloodPressure.systolic}/${vital.vitals.bloodPressure.diastolic}` : '-';
      const hr = vital.vitals.heartRate?.value || '-';
      const temp = vital.vitals.temperature?.value || '-';
      const o2 = vital.vitals.oxygenSaturation?.value || '-';
      
      doc.text(date, col1, yPosition);
      doc.text(bp, col2, yPosition);
      doc.text(hr.toString(), col3, yPosition);
      doc.text(temp.toString(), col4, yPosition);
      doc.text(o2.toString(), col5, yPosition);
      
      // Add alerts if any
      if (vital.alerts && vital.alerts.length > 0) {
        doc.fontSize(8);
        doc.fillColor('red');
        doc.text(`  Alerts: ${vital.alerts.map(a => a.type).join(', ')}`, col1, yPosition + 12);
        doc.fillColor('black');
        doc.fontSize(9);
        yPosition += 12;
      }
      
      // Add notes if any
      if (options.includeNotes && vital.notes) {
        doc.fontSize(8);
        doc.fillColor('gray');
        doc.text(`  Notes: ${vital.notes}`, col1, yPosition + 12);
        doc.fillColor('black');
        doc.fontSize(9);
        yPosition += 12;
      }
      
      yPosition += 20;
    });
    
    // Add chart if requested
    if (options.includeChart && vitalsData.length > 1) {
      doc.addPage();
      doc.fontSize(14).text('Vital Signs Trends', { underline: true });
      // Chart generation would require additional charting library
      doc.fontSize(10).text('[Chart visualization would be inserted here]');
    }
    
    // Alerts section
    if (options.alerts && options.alerts.length > 0) {
      doc.addPage();
      doc.fontSize(14).text('Alerts and Warnings', { underline: true });
      doc.fontSize(10);
      
      options.alerts.forEach(alert => {
        doc.fillColor(alert.severity === 'critical' ? 'red' : 'orange');
        doc.text(`• ${new Date(alert.createdAt).toLocaleString()}: ${alert.message}`);
        doc.fillColor('black');
      });
    }
    
    // Footer
    doc.fontSize(8);
    doc.moveDown();
    doc.text('This report contains protected health information (PHI)', { align: 'center' });
    doc.text('Handle in accordance with HIPAA regulations', { align: 'center' });
    
    // Finalize PDF
    doc.end();
    
    return new Promise((resolve) => {
      doc.on('end', () => {
        const pdfData = Buffer.concat(chunks);
        resolve({
          data: pdfData,
          metadata: {
            format: 'pdf',
            mimeType: 'application/pdf',
            size: pdfData.length
          },
          filename: `vital_signs_${patient.mrn}_${Date.now()}.pdf`
        });
      });
    });
  }

  async generateCSV(patient, vitalsData, options) {
    const headers = [
      'Date',
      'Time',
      'Systolic BP',
      'Diastolic BP',
      'Heart Rate',
      'Respiratory Rate',
      'Temperature',
      'Temp Unit',
      'O2 Saturation',
      'O2 on Oxygen',
      'Weight',
      'Weight Unit',
      'Height',
      'Height Unit',
      'BMI',
      'Pain Score',
      'Blood Glucose',
      'Glucose Unit'
    ];
    
    if (options.includeNotes) {
      headers.push('Notes');
      headers.push('Recorded By');
    }
    
    let csv = headers.join(',') + '\n';
    
    vitalsData.forEach(vital => {
      const date = new Date(vital.dateRecorded);
      const row = [
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        vital.vitals.bloodPressure?.systolic || '',
        vital.vitals.bloodPressure?.diastolic || '',
        vital.vitals.heartRate?.value || '',
        vital.vitals.respiratoryRate?.value || '',
        vital.vitals.temperature?.value || '',
        vital.vitals.temperature?.unit || '',
        vital.vitals.oxygenSaturation?.value || '',
        vital.vitals.oxygenSaturation?.onOxygen || 'false',
        vital.vitals.weight?.value || '',
        vital.vitals.weight?.unit || '',
        vital.vitals.height?.value || '',
        vital.vitals.height?.unit || '',
        vital.vitals.bmi?.value || '',
        vital.vitals.painScore?.value || '',
        vital.vitals.bloodGlucose?.value || '',
        vital.vitals.bloodGlucose?.unit || ''
      ];
      
      if (options.includeNotes) {
        row.push(vital.notes ? `"${vital.notes.replace(/"/g, '""')}"` : '');
        row.push(vital.recordedBy || '');
      }
      
      csv += row.join(',') + '\n';
    });
    
    return {
      data: Buffer.from(csv),
      metadata: {
        format: 'csv',
        mimeType: 'text/csv',
        size: csv.length
      },
      filename: `vital_signs_${patient.mrn}_${Date.now()}.csv`
    };
  }

  async generateExcel(patient, vitalsData, options) {
    const workbook = new ExcelJS.Workbook();
    
    // Patient info sheet
    const infoSheet = workbook.addWorksheet('Patient Information');
    infoSheet.columns = [
      { header: 'Field', key: 'field', width: 20 },
      { header: 'Value', key: 'value', width: 30 }
    ];
    
    infoSheet.addRows([
      { field: 'Name', value: `${patient.firstName} ${patient.lastName}` },
      { field: 'MRN', value: patient.mrn },
      { field: 'Date of Birth', value: new Date(patient.dateOfBirth).toLocaleDateString() },
      { field: 'Report Date', value: new Date().toLocaleString() },
      { field: 'Total Records', value: vitalsData.length }
    ]);
    
    // Vital signs sheet
    const vitalsSheet = workbook.addWorksheet('Vital Signs');
    vitalsSheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Time', key: 'time', width: 10 },
      { header: 'Systolic', key: 'systolic', width: 10 },
      { header: 'Diastolic', key: 'diastolic', width: 10 },
      { header: 'Heart Rate', key: 'heartRate', width: 12 },
      { header: 'Resp Rate', key: 'respRate', width: 10 },
      { header: 'Temp', key: 'temp', width: 8 },
      { header: 'O2 Sat', key: 'o2sat', width: 8 },
      { header: 'Weight', key: 'weight', width: 10 },
      { header: 'BMI', key: 'bmi', width: 8 },
      { header: 'Pain', key: 'pain', width: 8 }
    ];
    
    if (options.includeNotes) {
      vitalsSheet.columns.push({ header: 'Notes', key: 'notes', width: 30 });
    }
    
    vitalsData.forEach(vital => {
      const date = new Date(vital.dateRecorded);
      const row = {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString(),
        systolic: vital.vitals.bloodPressure?.systolic,
        diastolic: vital.vitals.bloodPressure?.diastolic,
        heartRate: vital.vitals.heartRate?.value,
        respRate: vital.vitals.respiratoryRate?.value,
        temp: vital.vitals.temperature?.value,
        o2sat: vital.vitals.oxygenSaturation?.value,
        weight: vital.vitals.weight?.value,
        bmi: vital.vitals.bmi?.value,
        pain: vital.vitals.painScore?.value
      };
      
      if (options.includeNotes) {
        row.notes = vital.notes;
      }
      
      vitalsSheet.addRow(row);
    });
    
    // Apply formatting
    vitalsSheet.getRow(1).font = { bold: true };
    vitalsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Statistics sheet
    if (options.statistics) {
      const statsSheet = workbook.addWorksheet('Statistics');
      statsSheet.columns = [
        { header: 'Vital Sign', key: 'vital', width: 20 },
        { header: 'Average', key: 'average', width: 12 },
        { header: 'Min', key: 'min', width: 10 },
        { header: 'Max', key: 'max', width: 10 },
        { header: 'Std Dev', key: 'stdDev', width: 12 }
      ];
      
      // Add statistics rows
      const stats = options.statistics;
      if (stats.bloodPressure) {
        statsSheet.addRow({
          vital: 'Systolic BP',
          average: stats.bloodPressure.avgSystolic,
          min: stats.bloodPressure.minSystolic,
          max: stats.bloodPressure.maxSystolic,
          stdDev: stats.bloodPressure.stdDevSystolic
        });
        statsSheet.addRow({
          vital: 'Diastolic BP',
          average: stats.bloodPressure.avgDiastolic,
          min: stats.bloodPressure.minDiastolic,
          max: stats.bloodPressure.maxDiastolic,
          stdDev: stats.bloodPressure.stdDevDiastolic
        });
      }
      
      ['heartRate', 'temperature', 'oxygenSaturation', 'weight'].forEach(vital => {
        if (stats[vital]) {
          statsSheet.addRow({
            vital: vital.replace(/([A-Z])/g, ' $1').trim(),
            average: stats[vital].average,
            min: stats[vital].min,
            max: stats[vital].max,
            stdDev: stats[vital].stdDev
          });
        }
      });
    }
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    return {
      data: buffer,
      metadata: {
        format: 'excel',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: buffer.length
      },
      filename: `vital_signs_${patient.mrn}_${Date.now()}.xlsx`
    };
  }

  async generateJSON(patient, vitalsData, options) {
    const exportData = {
      patient: {
        id: patient._id,
        mrn: patient.mrn,
        name: `${patient.firstName} ${patient.lastName}`,
        dateOfBirth: patient.dateOfBirth
      },
      exportDate: new Date(),
      recordCount: vitalsData.length,
      dateRange: {
        start: vitalsData[0].dateRecorded,
        end: vitalsData[vitalsData.length - 1].dateRecorded
      },
      vitalSigns: vitalsData
    };
    
    if (options.statistics) {
      exportData.statistics = options.statistics;
    }
    
    if (options.alerts) {
      exportData.alerts = options.alerts;
    }
    
    const jsonString = JSON.stringify(exportData, null, 2);
    
    return {
      data: Buffer.from(jsonString),
      metadata: {
        format: 'json',
        mimeType: 'application/json',
        size: jsonString.length
      },
      filename: `vital_signs_${patient.mrn}_${Date.now()}.json`
    };
  }

  async generateHL7(patient, vitalsData) {
    // HL7 ORU (Observation Result) message
    const hl7Messages = [];
    
    vitalsData.forEach((vital, index) => {
      const message = {
        MSH: {
          sendingApplication: 'IntelliCare',
          sendingFacility: vital.practiceId,
          messageType: 'ORU^R01',
          messageControlId: `${Date.now()}_${index}`,
          processingId: 'P',
          versionId: '2.5'
        },
        PID: {
          patientId: patient._id,
          patientName: `${patient.lastName}^${patient.firstName}`,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          mrn: patient.mrn
        },
        OBR: {
          observationDate: vital.dateRecorded,
          orderingProvider: vital.recordedBy
        },
        OBX: []
      };
      
      // Add observations
      if (vital.vitals.bloodPressure) {
        message.OBX.push({
          valueType: 'NM',
          observationId: '8480-6',
          observationName: 'Systolic blood pressure',
          value: vital.vitals.bloodPressure.systolic,
          units: 'mm[Hg]'
        });
        message.OBX.push({
          valueType: 'NM',
          observationId: '8462-4',
          observationName: 'Diastolic blood pressure',
          value: vital.vitals.bloodPressure.diastolic,
          units: 'mm[Hg]'
        });
      }
      
      if (vital.vitals.heartRate) {
        message.OBX.push({
          valueType: 'NM',
          observationId: '8867-4',
          observationName: 'Heart rate',
          value: vital.vitals.heartRate.value,
          units: '/min'
        });
      }
      
      if (vital.vitals.temperature) {
        message.OBX.push({
          valueType: 'NM',
          observationId: '8310-5',
          observationName: 'Body temperature',
          value: vital.vitals.temperature.value,
          units: vital.vitals.temperature.unit === 'C' ? 'Cel' : '[degF]'
        });
      }
      
      if (vital.vitals.oxygenSaturation) {
        message.OBX.push({
          valueType: 'NM',
          observationId: '59408-5',
          observationName: 'Oxygen saturation',
          value: vital.vitals.oxygenSaturation.value,
          units: '%'
        });
      }
      
      hl7Messages.push(message);
    });
    
    // Convert to HL7 format (simplified - would need proper HL7 library)
    const hl7String = hl7Messages.map(msg => this.formatHL7Message(msg)).join('\n');
    
    return {
      data: Buffer.from(hl7String),
      metadata: {
        format: 'hl7',
        mimeType: 'application/x-hl7',
        size: hl7String.length
      },
      filename: `vital_signs_${patient.mrn}_${Date.now()}.hl7`
    };
  }

  async generateFHIR(patient, vitalsData) {
    // FHIR Bundle with Observation resources
    const bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      entry: []
    };
    
    // Add patient resource
    bundle.entry.push({
      resource: {
        resourceType: 'Patient',
        id: patient._id,
        identifier: [{
          system: 'http://hospital.org/mrn',
          value: patient.mrn
        }],
        name: [{
          family: patient.lastName,
          given: [patient.firstName]
        }],
        birthDate: patient.dateOfBirth,
        gender: patient.gender
      }
    });
    
    // Add observation resources
    vitalsData.forEach(vital => {
      // Blood pressure observation
      if (vital.vitals.bloodPressure) {
        bundle.entry.push({
          resource: {
            resourceType: 'Observation',
            id: `${vital._id}_bp`,
            status: 'final',
            category: [{
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs'
              }]
            }],
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '85354-9',
                display: 'Blood pressure panel'
              }]
            },
            subject: {
              reference: `Patient/${patient._id}`
            },
            effectiveDateTime: vital.dateRecorded,
            component: [
              {
                code: {
                  coding: [{
                    system: 'http://loinc.org',
                    code: '8480-6',
                    display: 'Systolic blood pressure'
                  }]
                },
                valueQuantity: {
                  value: vital.vitals.bloodPressure.systolic,
                  unit: 'mmHg',
                  system: 'http://unitsofmeasure.org'
                }
              },
              {
                code: {
                  coding: [{
                    system: 'http://loinc.org',
                    code: '8462-4',
                    display: 'Diastolic blood pressure'
                  }]
                },
                valueQuantity: {
                  value: vital.vitals.bloodPressure.diastolic,
                  unit: 'mmHg',
                  system: 'http://unitsofmeasure.org'
                }
              }
            ]
          }
        });
      }
      
      // Heart rate observation
      if (vital.vitals.heartRate) {
        bundle.entry.push({
          resource: {
            resourceType: 'Observation',
            id: `${vital._id}_hr`,
            status: 'final',
            category: [{
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs'
              }]
            }],
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '8867-4',
                display: 'Heart rate'
              }]
            },
            subject: {
              reference: `Patient/${patient._id}`
            },
            effectiveDateTime: vital.dateRecorded,
            valueQuantity: {
              value: vital.vitals.heartRate.value,
              unit: 'beats/minute',
              system: 'http://unitsofmeasure.org'
            }
          }
        });
      }
      
      // Add other vital signs similarly...
    });
    
    const fhirString = JSON.stringify(bundle, null, 2);
    
    return {
      data: Buffer.from(fhirString),
      metadata: {
        format: 'fhir',
        mimeType: 'application/fhir+json',
        size: fhirString.length
      },
      filename: `vital_signs_fhir_${patient.mrn}_${Date.now()}.json`
    };
  }

  async validateExportRequest(patientId, format, purpose, context) {
    // Check user permissions
    if (context.role !== 'provider' && context.role !== 'admin') {
      throw new Error('Insufficient permissions to export vital data');
    }
    
    // Validate purpose
    const validPurposes = [
      'medical-record',
      'referral',
      'patient-request',
      'research',
      'quality-improvement',
      'legal',
      'insurance',
      'transfer-of-care'
    ];
    
    if (!validPurposes.includes(purpose)) {
      throw new Error('Invalid export purpose specified');
    }
    
    // Check if patient belongs to practice
    const patient = await SecureDataAccess.findById('patients', patientId, context);
    if (!patient) {
      throw new Error('Patient not found or access denied');
    }
    
    // Check export restrictions
    const restrictions = await SecureDataAccess.findOne('exportrestrictions', {
      patientId,
      practiceId: context.practiceId
    }, context);
    
    if (restrictions) {
      if (restrictions.blockAllExports) {
        throw new Error('Exports are restricted for this patient');
      }
      if (restrictions.blockedFormats?.includes(format)) {
        throw new Error(`Export format ${format} is restricted for this patient`);
      }
    }
  }

  async getVitalsForExport(patientId, options, context) {
    const query = {
      patientId,
      practiceId: context.practiceId,
      isDeleted: false
    };
    
    if (options.startDate || options.endDate) {
      query.dateRecorded = {};
      if (options.startDate) query.dateRecorded.$gte = new Date(options.startDate);
      if (options.endDate) query.dateRecorded.$lte = new Date(options.endDate);
    }
    
    const vitals = await SecureDataAccess.query('vitalsigns', query, {
      sort: { dateRecorded: 1 }
    }, context);
    
    // Filter by vital types if specified
    if (options.vitalTypes !== 'all' && Array.isArray(options.vitalTypes)) {
      return vitals.map(v => {
        const filtered = { ...v, vitals: {} };
        options.vitalTypes.forEach(type => {
          if (v.vitals[type]) {
            filtered.vitals[type] = v.vitals[type];
          }
        });
        return filtered;
      });
    }
    
    return vitals;
  }

  async getAlertsForExport(patientId, options, context) {
    const query = {
      patientId,
      practiceId: context.practiceId
    };
    
    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) query.createdAt.$gte = new Date(options.startDate);
      if (options.endDate) query.createdAt.$lte = new Date(options.endDate);
    }
    
    return await SecureDataAccess.query('vitalalerts', query, {
      sort: { createdAt: 1 }
    }, context);
  }

  async calculateExportStatistics(vitalsData) {
    const stats = {};
    
    // Blood pressure statistics
    const bpValues = vitalsData
      .filter(v => v.vitals.bloodPressure)
      .map(v => v.vitals.bloodPressure);
    
    if (bpValues.length > 0) {
      const systolicValues = bpValues.map(bp => bp.systolic);
      const diastolicValues = bpValues.map(bp => bp.diastolic);
      
      stats.bloodPressure = {
        avgSystolic: Math.round(systolicValues.reduce((sum, v) => sum + v, 0) / systolicValues.length),
        avgDiastolic: Math.round(diastolicValues.reduce((sum, v) => sum + v, 0) / diastolicValues.length),
        minSystolic: Math.min(...systolicValues),
        maxSystolic: Math.max(...systolicValues),
        minDiastolic: Math.min(...diastolicValues),
        maxDiastolic: Math.max(...diastolicValues),
        stdDevSystolic: this.calculateStdDev(systolicValues),
        stdDevDiastolic: this.calculateStdDev(diastolicValues)
      };
    }
    
    // Calculate for other vitals
    const vitalTypes = ['heartRate', 'temperature', 'oxygenSaturation', 'weight'];
    vitalTypes.forEach(type => {
      const values = vitalsData
        .filter(v => v.vitals[type])
        .map(v => v.vitals[type].value || v.vitals[type]);
      
      if (values.length > 0) {
        stats[type] = {
          average: Math.round(values.reduce((sum, v) => sum + v, 0) / values.length * 10) / 10,
          min: Math.min(...values),
          max: Math.max(...values),
          stdDev: this.calculateStdDev(values)
        };
      }
    });
    
    return stats;
  }

  calculateStdDev(values) {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.round(Math.sqrt(variance) * 10) / 10;
  }

  async encryptExport(exportResult, password) {
    // Use AES-256 encryption
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(exportResult.data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Prepend IV for decryption
    const encryptedWithIv = Buffer.concat([iv, encrypted]);
    
    return {
      ...exportResult,
      data: encryptedWithIv,
      metadata: {
        ...exportResult.metadata,
        encrypted: true,
        encryptionMethod: algorithm
      }
    };
  }

  async createExportRecord(data, context) {
    return await SecureDataAccess.create('vitalexports', {
      ...data,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    }, context);
  }

  formatHL7Message(message) {
    // Simplified HL7 formatting - would need proper HL7 library
    let hl7 = `MSH|^~\\&|${message.MSH.sendingApplication}|${message.MSH.sendingFacility}||${message.MSH.messageType}|${message.MSH.messageControlId}|${message.MSH.processingId}|${message.MSH.versionId}\r`;
    hl7 += `PID|||${message.PID.patientId}||${message.PID.patientName}||${message.PID.dateOfBirth}|${message.PID.gender}|||||||${message.PID.mrn}\r`;
    hl7 += `OBR|1|||||||${message.OBR.observationDate}|||||||||${message.OBR.orderingProvider}\r`;
    
    message.OBX.forEach((obx, index) => {
      hl7 += `OBX|${index + 1}|${obx.valueType}|${obx.observationId}||${obx.value}|${obx.units}||||F|||${message.OBR.observationDate}\r`;
    });
    
    return hl7;
  }

  async loadExportTemplates() {
    // Load customizable export templates
    return {
      standard: 'default',
      detailed: 'comprehensive',
      summary: 'brief',
      research: 'anonymized'
    };
  }
}

module.exports = new VitalDataExportService();
```

### 2. Create Export API Endpoints
```javascript
// backend/routes/vitals.js (additions)

// Export vital data
router.post('/api/vitals/patient/:patientId/export', authenticate, authorize(['provider', 'admin']), async (req, res) => {
  try {
    const { patientId } = req.params;
    const {
      format = 'pdf',
      startDate,
      endDate,
      vitalTypes,
      includeChart = true,
      includeStatistics = true,
      includeAlerts = true,
      includeNotes = true,
      template = 'standard',
      encrypt = false,
      password,
      purpose = 'medical-record'
    } = req.body;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const result = await vitalDataExportService.exportVitalData(patientId, {
      format,
      startDate,
      endDate,
      vitalTypes,
      includeChart,
      includeStatistics,
      includeAlerts,
      includeNotes,
      template,
      encrypt,
      password,
      purpose
    }, context);

    // Set appropriate headers based on format
    const mimeType = result.metadata.mimeType;
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.data.length);
    
    // Send the file
    res.send(result.data);
  } catch (error) {
    console.error('Error exporting vital data:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get export history
router.get('/api/vitals/patient/:patientId/exports', authenticate, authorize(['provider', 'admin']), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 50 } = req.query;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    const exports = await SecureDataAccess.query('vitalexports', {
      patientId,
      practiceId: context.practiceId
    }, {
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    }, context);

    res.json({
      success: true,
      data: exports,
      count: exports.length
    });
  } catch (error) {
    console.error('Error retrieving export history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve export history'
    });
  }
});

// Download previous export
router.get('/api/vitals/exports/:exportId/download', authenticate, authorize(['provider', 'admin']), async (req, res) => {
  try {
    const { exportId } = req.params;

    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      role: req.user.role
    };

    // Get export record
    const exportRecord = await SecureDataAccess.findById('vitalexports', exportId, context);
    
    if (!exportRecord) {
      return res.status(404).json({
        success: false,
        error: 'Export not found'
      });
    }

    // Check if expired
    if (new Date() > new Date(exportRecord.expiresAt)) {
      return res.status(410).json({
        success: false,
        error: 'Export has expired'
      });
    }

    // Regenerate the export
    const result = await vitalDataExportService.exportVitalData(
      exportRecord.patientId,
      {
        format: exportRecord.format,
        startDate: exportRecord.dateRange.startDate,
        endDate: exportRecord.dateRange.endDate
      },
      context
    );

    res.setHeader('Content-Type', result.metadata.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (error) {
    console.error('Error downloading export:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download export'
    });
  }
});
```

## Required Endpoints

### POST /api/vitals/patient/:patientId/export
**Description**: Export vital signs data in various formats
**Access**: Providers, Admins
**Request Body**:
```json
{
  "format": "pdf",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "vitalTypes": ["bloodPressure", "heartRate"],
  "includeChart": true,
  "includeStatistics": true,
  "includeAlerts": true,
  "includeNotes": true,
  "template": "standard",
  "encrypt": false,
  "purpose": "referral"
}
```

### GET /api/vitals/patient/:patientId/exports
**Description**: Get export history for a patient
**Access**: Providers, Admins

### GET /api/vitals/exports/:exportId/download
**Description**: Re-download a previous export
**Access**: Providers, Admins

## Data Models Required

### VitalExports Collection
```javascript
{
  patientId: ObjectId,
  practiceId: String,
  format: String,
  purpose: String,
  recordCount: Number,
  dateRange: {
    startDate: Date,
    endDate: Date
  },
  exportedBy: ObjectId,
  encrypted: Boolean,
  fileSize: Number,
  createdAt: Date,
  expiresAt: Date
}
```

### ExportRestrictions Collection
```javascript
{
  patientId: ObjectId,
  practiceId: String,
  blockAllExports: Boolean,
  blockedFormats: [String],
  reason: String,
  setBy: ObjectId,
  setAt: Date
}
```

## Test Cases

### 1. PDF Export
- Export to PDF with all options
- Verify formatting correct
- Check chart inclusion
- Test encryption

### 2. CSV Export
- Export to CSV format
- Verify data integrity
- Check special character handling
- Test large datasets

### 3. Excel Export
- Export to Excel with multiple sheets
- Verify statistics sheet
- Check formatting preserved

### 4. JSON Export
- Export to JSON format
- Verify structure valid
- Check nested data preserved

### 5. HL7 Export
- Generate HL7 messages
- Verify LOINC codes
- Check message structure

### 6. FHIR Export
- Generate FHIR bundle
- Verify resource structure
- Check references valid

### 7. Permission Testing
- Non-provider attempt (should fail)
- Valid purpose required
- Audit trail created

### 8. Encryption
- Test password encryption
- Verify decryption works
- Check algorithm specification

## Dependencies
- PDFKit for PDF generation
- ExcelJS for Excel files
- Crypto for encryption
- SecureDataAccess service
- AuditLog for compliance

## Success Criteria
- [ ] All export formats functional
- [ ] Data integrity maintained
- [ ] HIPAA compliance ensured
- [ ] Audit trail complete
- [ ] Encryption works properly
- [ ] Statistics calculated correctly
- [ ] Charts included in PDF
- [ ] HL7/FHIR standards met
- [ ] Export history tracked
- [ ] Re-download capability

## Notes
- Consider adding watermarking for security
- May need digital signatures for legal purposes
- Future enhancement: batch export for multiple patients
- Consider adding export scheduling capability
- May need integration with external HIE systems