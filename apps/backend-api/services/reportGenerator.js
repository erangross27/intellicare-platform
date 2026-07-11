/**
 * Medical Report Generator Service
 * Generates comprehensive medical reports with multiple templates,
 * auto-population from patient data, graphs, and export capabilities
 */

const fs = require('fs').promises;
const path = require('path');

const serviceAccountManager = require('./serviceAccountManager');
const SecureDataAccess = require('./secureDataAccess');
const secureConfigService = require('./secureConfigService');

class ReportGenerator {
  constructor() {
    this.initialized = false;
    // Report templates
    this.templates = {
      discharge: {
        name: 'Discharge Summary',
        hebrewName: 'סיכום שחרור',
        sections: [
          'patientInfo', 'admissionDate', 'dischargeDate', 'admittingDiagnosis',
          'dischargeDiagnosis', 'hospitalCourse', 'procedures', 'medications',
          'labResults', 'vitalSigns', 'followUp', 'recommendations'
        ]
      },
      consultation: {
        name: 'Consultation Report',
        hebrewName: 'דוח ייעוץ',
        sections: [
          'patientInfo', 'referringPhysician', 'reasonForConsult', 'chiefComplaint',
          'historyOfPresentIllness', 'pastMedicalHistory', 'medications', 'allergies',
          'physicalExam', 'assessment', 'recommendations', 'followUp'
        ]
      },
      progress: {
        name: 'Progress Note',
        hebrewName: 'רשומת מעקב',
        sections: [
          'patientInfo', 'date', 'subjective', 'objective', 'vitalSigns',
          'labResults', 'assessment', 'plan', 'medications'
        ]
      },
      operative: {
        name: 'Operative Report',
        hebrewName: 'דוח ניתוח',
        sections: [
          'patientInfo', 'dateOfProcedure', 'preoperativeDiagnosis', 'postoperativeDiagnosis',
          'procedure', 'surgeon', 'assistant', 'anesthesia', 'findings',
          'technique', 'complications', 'estimatedBloodLoss', 'specimens', 'disposition'
        ]
      },
      emergency: {
        name: 'Emergency Department Report',
        hebrewName: 'דוח חדר מיון',
        sections: [
          'patientInfo', 'arrivalTime', 'chiefComplaint', 'triageLevel', 'vitalSigns',
          'historyOfPresentIllness', 'physicalExam', 'diagnosticTests', 'treatment',
          'disposition', 'discharge Instructions'
        ]
      }
    };

    // ICD-10 codes (common examples)
    this.icd10Codes = {
      // Cardiovascular
      'hypertension': 'I10',
      'myocardial_infarction': 'I21.9',
      'heart_failure': 'I50.9',
      'atrial_fibrillation': 'I48.91',
      
      // Respiratory
      'pneumonia': 'J18.9',
      'asthma': 'J45.909',
      'copd': 'J44.0',
      'covid19': 'U07.1',
      
      // Endocrine
      'diabetes_type2': 'E11.9',
      'diabetes_type1': 'E10.9',
      'hypothyroidism': 'E03.9',
      'hyperthyroidism': 'E05.90',
      
      // Gastrointestinal
      'gastroenteritis': 'K52.9',
      'appendicitis': 'K35.80',
      'cholecystitis': 'K81.9',
      
      // Musculoskeletal
      'back_pain': 'M54.5',
      'osteoarthritis': 'M19.90',
      'fracture': 'S72.90'
    };
  }
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate('report-generator');
      
      // Initialize secure config service
      await secureConfigService.initialize();
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      await SecureDataAccess.insert('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'reportGenerator',
        timestamp: new Date()
      }, this.getServiceContext());
      
      return this;
    } catch (error) {
      throw new Error(`Failed to initialize ReportGenerator: ${error.message}`);
    }
  }

  // Helper method to get service context for SecureDataAccess
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'report-generator',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: practiceId
    };
  }


  /**
   * Generate medical report
   */
  async generateReport(template, patientData, additionalData = {}, language = 'en') {
    const isHebrew = language === 'he';
    const selectedTemplate = this.templates[template];
    
    if (!selectedTemplate) {
      throw new Error(isHebrew ? 'תבנית לא נמצאה' : 'Template not found');
    }

    const report = {
      type: template,
      title: isHebrew ? selectedTemplate.hebrewName : selectedTemplate.name,
      generatedAt: new Date().toISOString(),
      patient: this.formatPatientInfo(patientData, isHebrew),
      sections: {},
      metadata: {
        language: language,
        version: '1.0',
        generatedBy: 'IntelliCare Medical System'
      }
    };

    // Generate each section
    for (const section of selectedTemplate.sections) {
      report.sections[section] = await this.generateSection(
        section, 
        patientData, 
        additionalData, 
        isHebrew
      );
    }

    // Add graphs if vital signs or lab results present
    if (report.sections.vitalSigns || report.sections.labResults) {
      report.graphs = this.generateGraphs(patientData, additionalData);
    }

    // Add ICD-10 codes
    if (additionalData.diagnoses) {
      report.icd10Codes = this.mapDiagnosesToICD10(additionalData.diagnoses);
    }

    return report;
  }

  /**
   * Generate specific section
   */
  async generateSection(sectionType, patientData, additionalData, isHebrew) {
    switch (sectionType) {
      case 'patientInfo':
        return this.formatPatientInfo(patientData, isHebrew);
      
      case 'vitalSigns':
        return this.formatVitalSigns(additionalData.vitalSigns || patientData.vitalSigns, isHebrew);
      
      case 'labResults':
        return this.formatLabResults(additionalData.labResults || patientData.labResults, isHebrew);
      
      case 'medications':
        return this.formatMedications(additionalData.medications || patientData.medications, isHebrew);
      
      case 'allergies':
        return this.formatAllergies(patientData.allergies, isHebrew);
      
      case 'historyOfPresentIllness':
        return this.formatHPI(additionalData.hpi || patientData.medicalHistory, isHebrew);
      
      case 'physicalExam':
        return this.formatPhysicalExam(additionalData.physicalExam, isHebrew);
      
      case 'assessment':
        return this.formatAssessment(additionalData.assessment, isHebrew);
      
      case 'plan':
      case 'recommendations':
        return this.formatPlan(additionalData.plan || additionalData.recommendations, isHebrew);
      
      case 'followUp':
        return this.formatFollowUp(additionalData.followUp, isHebrew);
      
      default:
        return additionalData[sectionType] || null;
    }
  }

  /**
   * Format patient information
   */
  formatPatientInfo(patientData, isHebrew) {
    if (!patientData) return null;

    return {
      name: patientData.name || `${patientData.firstName} ${patientData.lastName}`,
      id: patientData.idNumber || patientData.nationalId || patientData.ssn,
      dateOfBirth: patientData.dateOfBirth,
      age: this.calculateAge(patientData.dateOfBirth),
      gender: patientData.gender,
      address: this.formatAddress(patientData.address, isHebrew),
      phone: patientData.phone,
      email: patientData.email,
      insurance: patientData.insurance,
      primaryPhysician: patientData.primaryPhysician
    };
  }

  /**
   * Format vital signs with trends
   */
  formatVitalSigns(vitalSigns, isHebrew) {
    if (!vitalSigns) return null;

    const formatted = {
      current: {},
      trends: [],
      abnormal: []
    };

    // Handle array of readings or single reading
    const readings = Array.isArray(vitalSigns) ? vitalSigns : [vitalSigns];
    const latest = readings[readings.length - 1];

    // Format current vital signs
    if (latest.bloodPressure) {
      formatted.current.bloodPressure = `${latest.bloodPressure.systolic}/${latest.bloodPressure.diastolic} mmHg`;
    }
    if (latest.heartRate) {
      formatted.current.heartRate = `${latest.heartRate} bpm`;
    }
    if (latest.temperature) {
      formatted.current.temperature = `${latest.temperature}°C`;
    }
    if (latest.respiratoryRate) {
      formatted.current.respiratoryRate = `${latest.respiratoryRate} /min`;
    }
    if (latest.oxygenSaturation) {
      formatted.current.oxygenSaturation = `${latest.oxygenSaturation}%`;
    }
    if (latest.weight) {
      formatted.current.weight = `${latest.weight} kg`;
    }
    if (latest.height) {
      formatted.current.height = `${latest.height} cm`;
      formatted.current.bmi = this.calculateBMI(latest.weight, latest.height);
    }

    // Identify abnormal values
    if (latest.bloodPressure) {
      if (latest.bloodPressure.systolic > 140 || latest.bloodPressure.diastolic > 90) {
        formatted.abnormal.push(isHebrew ? 'לחץ דם גבוה' : 'Hypertension');
      }
      if (latest.bloodPressure.systolic < 90 || latest.bloodPressure.diastolic < 60) {
        formatted.abnormal.push(isHebrew ? 'לחץ דם נמוך' : 'Hypotension');
      }
    }

    if (latest.heartRate > 100) {
      formatted.abnormal.push(isHebrew ? 'דופק מהיר' : 'Tachycardia');
    } else if (latest.heartRate < 60) {
      formatted.abnormal.push(isHebrew ? 'דופק איטי' : 'Bradycardia');
    }

    if (latest.temperature > 37.5) {
      formatted.abnormal.push(isHebrew ? 'חום' : 'Fever');
    }

    if (latest.oxygenSaturation < 95) {
      formatted.abnormal.push(isHebrew ? 'רוויון חמצן נמוך' : 'Low oxygen saturation');
    }

    // Add trends if multiple readings
    if (readings.length > 1) {
      formatted.trends = this.calculateTrends(readings, isHebrew);
    }

    return formatted;
  }

  /**
   * Format lab results with interpretation
   */
  formatLabResults(labResults, isHebrew) {
    if (!labResults) return null;

    const formatted = {
      results: [],
      abnormal: [],
      critical: []
    };

    for (const [test, value] of Object.entries(labResults)) {
      const result = {
        test: test,
        value: value,
        unit: this.getLabUnit(test),
        reference: this.getLabReference(test),
        flag: this.getLabFlag(test, value)
      };

      formatted.results.push(result);

      if (result.flag === 'HIGH' || result.flag === 'LOW') {
        formatted.abnormal.push({
          test: test,
          value: value,
          flag: result.flag
        });
      }

      if (result.flag === 'CRITICAL') {
        formatted.critical.push({
          test: test,
          value: value,
          action: isHebrew ? 'נדרשת התערבות מיידית' : 'Immediate intervention required'
        });
      }
    }

    return formatted;
  }

  /**
   * Format medications list
   */
  formatMedications(medications, isHebrew) {
    if (!medications || medications.length === 0) return null;

    return medications.map(med => ({
      name: med.name || med.medicationName,
      dosage: med.dosage,
      frequency: med.frequency,
      route: med.route || 'PO',
      startDate: med.startDate,
      endDate: med.endDate,
      indication: med.indication,
      prescriber: med.prescriber,
      notes: med.notes
    }));
  }

  /**
   * Format allergies
   */
  formatAllergies(allergies, isHebrew) {
    if (!allergies || allergies.length === 0) {
      return isHebrew ? 'אין אלרגיות ידועות' : 'No known allergies';
    }

    return allergies.map(allergy => ({
      allergen: typeof allergy === 'string' ? allergy : allergy.allergen,
      reaction: typeof allergy === 'object' ? allergy.reaction : 'Unknown',
      severity: typeof allergy === 'object' ? allergy.severity : 'Unknown'
    }));
  }

  /**
   * Generate graphs for visualization
   */
  generateGraphs(patientData, additionalData) {
    const graphs = [];

    // Vital signs trend graph
    if (additionalData.vitalSignsHistory) {
      graphs.push({
        type: 'line',
        title: 'Vital Signs Trends',
        data: this.prepareVitalSignsGraphData(additionalData.vitalSignsHistory)
      });
    }

    // Lab results comparison graph
    if (additionalData.labResultsHistory) {
      graphs.push({
        type: 'bar',
        title: 'Lab Results Comparison',
        data: this.prepareLabResultsGraphData(additionalData.labResultsHistory)
      });
    }

    // Medication timeline
    if (patientData.medications && patientData.medications.length > 3) {
      graphs.push({
        type: 'timeline',
        title: 'Medication Timeline',
        data: this.prepareMedicationTimeline(patientData.medications)
      });
    }

    return graphs;
  }

  /**
   * Prepare vital signs data for graphing
   */
  prepareVitalSignsGraphData(vitalSignsHistory) {
    const data = {
      labels: [],
      datasets: []
    };

    // Extract timestamps
    data.labels = vitalSignsHistory.map(vs => 
      new Date(vs.timestamp || vs.date).toLocaleDateString()
    );

    // Blood pressure
    if (vitalSignsHistory.some(vs => vs.bloodPressure)) {
      data.datasets.push({
        label: 'Systolic BP',
        data: vitalSignsHistory.map(vs => vs.bloodPressure?.systolic || null),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1
      });
      data.datasets.push({
        label: 'Diastolic BP',
        data: vitalSignsHistory.map(vs => vs.bloodPressure?.diastolic || null),
        borderColor: 'rgb(54, 162, 235)',
        tension: 0.1
      });
    }

    // Heart rate
    if (vitalSignsHistory.some(vs => vs.heartRate)) {
      data.datasets.push({
        label: 'Heart Rate',
        data: vitalSignsHistory.map(vs => vs.heartRate || null),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      });
    }

    return data;
  }

  /**
   * Export report as HTML
   */
  async exportAsHTML(report, language = 'en') {
    const isHebrew = language === 'he';
    const direction = isHebrew ? 'rtl' : 'ltr';

    let html = `
<!DOCTYPE html>
<html lang="${language}" dir="${direction}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 20px;
            direction: ${direction};
        }
        .header {
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .section {
            margin-bottom: 20px;
        }
        .section-title {
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
            font-size: 1.2em;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: ${isHebrew ? 'right' : 'left'};
        }
        th {
            background-color: #f2f2f2;
        }
        .abnormal {
            color: red;
            font-weight: bold;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 0.9em;
            color: #666;
        }
        @media print {
            .no-print {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.title}</h1>
        <p>${isHebrew ? 'תאריך:' : 'Date:'} ${new Date(report.generatedAt).toLocaleString(language)}</p>
    </div>
`;

    // Add patient info section
    if (report.patient) {
      html += this.generateHTMLSection('Patient Information', report.patient, isHebrew);
    }

    // Add other sections
    for (const [sectionName, sectionData] of Object.entries(report.sections)) {
      if (sectionData) {
        const title = this.getSectionTitle(sectionName, isHebrew);
        html += this.generateHTMLSection(title, sectionData, isHebrew);
      }
    }

    // Add footer
    html += `
    <div class="footer">
        <p>${isHebrew ? 'הופק על ידי מערכת IntelliCare' : 'Generated by IntelliCare Medical System'}</p>
        <p>${isHebrew ? 'זהו מסמך רפואי רשמי' : 'This is an official medical document'}</p>
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Generate HTML section
   */
  generateHTMLSection(title, data, isHebrew) {
    let html = `
    <div class="section">
        <div class="section-title">${title}</div>`;

    if (typeof data === 'string') {
      html += `<p>${data}</p>`;
    } else if (Array.isArray(data)) {
      html += '<ul>';
      for (const item of data) {
        if (typeof item === 'object') {
          html += `<li>${JSON.stringify(item)}</li>`;
        } else {
          html += `<li>${item}</li>`;
        }
      }
      html += '</ul>';
    } else if (typeof data === 'object') {
      html += '<table>';
      for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined) {
          html += `
            <tr>
                <td><strong>${this.formatFieldName(key, isHebrew)}</strong></td>
                <td>${this.formatFieldValue(value)}</td>
            </tr>`;
        }
      }
      html += '</table>';
    }

    html += '</div>';
    return html;
  }

  /**
   * Export report as PDF (requires puppeteer)
   */
  async exportAsPDF(report, outputPath, language = 'en') {
    // Note: This is a placeholder. In production, you would use puppeteer or similar
    // to convert HTML to PDF
    const html = await this.exportAsHTML(report, language);
    
    // Simplified - just save as HTML for now
    // In production: use puppeteer to convert to PDF
    const htmlPath = outputPath.replace('.pdf', '.html');
    await fs.writeFile(htmlPath, html);
    
    return {
      success: true,
      path: htmlPath,
      note: 'Saved as HTML. Install puppeteer for PDF conversion'
    };
  }

  /**
   * Helper: Calculate age
   */
  calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Helper: Calculate BMI
   */
  calculateBMI(weight, height) {
    if (!weight || !height) return null;
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    return bmi.toFixed(1);
  }

  /**
   * Helper: Format address
   */
  formatAddress(address, isHebrew) {
    if (!address) return null;
    if (typeof address === 'string') return address;
    
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.state || address.district) parts.push(address.state || address.district);
    if (address.postalCode) parts.push(address.postalCode);
    if (address.country) parts.push(address.country);
    
    return parts.join(', ');
  }

  /**
   * Helper: Map diagnoses to ICD-10 codes
   */
  mapDiagnosesToICD10(diagnoses) {
    const mapped = [];
    
    for (const diagnosis of diagnoses) {
      const normalized = diagnosis.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const code = this.icd10Codes[normalized];
      
      mapped.push({
        diagnosis: diagnosis,
        code: code || 'R69',  // R69 = Illness, unspecified
        description: code ? 'Mapped' : 'Unspecified'
      });
    }
    
    return mapped;
  }

  /**
   * Helper: Get lab unit
   */
  getLabUnit(test) {
    const units = {
      hemoglobin: 'g/dL',
      wbc: 'K/µL',
      platelets: 'K/µL',
      glucose: 'mg/dL',
      creatinine: 'mg/dL',
      sodium: 'mEq/L',
      potassium: 'mEq/L'
    };
    return units[test.toLowerCase()] || '';
  }

  /**
   * Helper: Get lab reference range
   */
  getLabReference(test) {
    const references = {
      hemoglobin: '13.5-17.5',
      wbc: '4.5-11.0',
      platelets: '150-400',
      glucose: '70-100',
      creatinine: '0.7-1.3',
      sodium: '136-145',
      potassium: '3.5-5.0'
    };
    return references[test.toLowerCase()] || 'N/A';
  }

  /**
   * Helper: Get lab flag
   */
  getLabFlag(test, value) {
    // Simplified flagging logic
    const ranges = {
      hemoglobin: { min: 13.5, max: 17.5, criticalLow: 7, criticalHigh: 20 },
      potassium: { min: 3.5, max: 5.0, criticalLow: 2.5, criticalHigh: 6.5 },
      glucose: { min: 70, max: 100, criticalLow: 50, criticalHigh: 500 }
    };
    
    const range = ranges[test.toLowerCase()];
    if (!range) return 'NORMAL';
    
    if (value <= range.criticalLow || value >= range.criticalHigh) return 'CRITICAL';
    if (value < range.min) return 'LOW';
    if (value > range.max) return 'HIGH';
    return 'NORMAL';
  }

  /**
   * Helper: Get section title
   */
  getSectionTitle(section, isHebrew) {
    const titles = {
      patientInfo: isHebrew ? 'פרטי המטופל' : 'Patient Information',
      vitalSigns: isHebrew ? 'סימנים חיוניים' : 'Vital Signs',
      labResults: isHebrew ? 'תוצאות מעבדה' : 'Laboratory Results',
      medications: isHebrew ? 'תרופות' : 'Medications',
      allergies: isHebrew ? 'אלרגיות' : 'Allergies',
      assessment: isHebrew ? 'הערכה' : 'Assessment',
      plan: isHebrew ? 'תוכנית טיפול' : 'Treatment Plan',
      followUp: isHebrew ? 'מעקב' : 'Follow-up'
    };
    return titles[section] || section;
  }

  /**
   * Helper: Format field name
   */
  formatFieldName(field, isHebrew) {
    const translations = {
      name: isHebrew ? 'שם' : 'Name',
      id: isHebrew ? 'ת.ז.' : 'ID',
      dateOfBirth: isHebrew ? 'תאריך לידה' : 'Date of Birth',
      age: isHebrew ? 'גיל' : 'Age',
      gender: isHebrew ? 'מין' : 'Gender',
      address: isHebrew ? 'כתובת' : 'Address',
      phone: isHebrew ? 'טלפון' : 'Phone',
      email: isHebrew ? 'דוא"ל' : 'Email',
      bloodPressure: isHebrew ? 'לחץ דם' : 'Blood Pressure',
      heartRate: isHebrew ? 'דופק' : 'Heart Rate',
      temperature: isHebrew ? 'חום' : 'Temperature'
    };
    return translations[field] || field;
  }

  /**
   * Helper: Format field value
   */
  formatFieldValue(value) {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return JSON.stringify(value);
    }
    return value.toString();
  }

  /**
   * Helper: Calculate trends
   */
  calculateTrends(readings, isHebrew) {
    const trends = [];
    
    if (readings.length < 2) return trends;
    
    const first = readings[0];
    const last = readings[readings.length - 1];
    
    // Blood pressure trend
    if (first.bloodPressure && last.bloodPressure) {
      const systolicChange = last.bloodPressure.systolic - first.bloodPressure.systolic;
      if (Math.abs(systolicChange) > 10) {
        trends.push(isHebrew
          ? `לחץ דם ${systolicChange > 0 ? 'עולה' : 'יורד'}`
          : `Blood pressure ${systolicChange > 0 ? 'increasing' : 'decreasing'}`
        );
      }
    }
    
    // Heart rate trend
    if (first.heartRate && last.heartRate) {
      const hrChange = last.heartRate - first.heartRate;
      if (Math.abs(hrChange) > 10) {
        trends.push(isHebrew
          ? `דופק ${hrChange > 0 ? 'עולה' : 'יורד'}`
          : `Heart rate ${hrChange > 0 ? 'increasing' : 'decreasing'}`
        );
      }
    }
    
    return trends;
  }

  /**
   * Helper: Format HPI
   */
  formatHPI(hpi, isHebrew) {
    if (!hpi) return null;
    
    if (typeof hpi === 'string') return hpi;
    
    if (Array.isArray(hpi)) {
      return hpi.join('\n');
    }
    
    if (typeof hpi === 'object') {
      const formatted = [];
      if (hpi.chiefComplaint) {
        formatted.push(`${isHebrew ? 'תלונה עיקרית:' : 'Chief Complaint:'} ${hpi.chiefComplaint}`);
      }
      if (hpi.onset) {
        formatted.push(`${isHebrew ? 'התחלה:' : 'Onset:'} ${hpi.onset}`);
      }
      if (hpi.duration) {
        formatted.push(`${isHebrew ? 'משך:' : 'Duration:'} ${hpi.duration}`);
      }
      if (hpi.quality) {
        formatted.push(`${isHebrew ? 'אופי:' : 'Quality:'} ${hpi.quality}`);
      }
      return formatted.join('\n');
    }
    
    return null;
  }

  /**
   * Helper: Format physical exam
   */
  formatPhysicalExam(exam, isHebrew) {
    if (!exam) return null;
    
    if (typeof exam === 'string') return exam;
    
    const systems = [];
    
    if (exam.general) {
      systems.push(`${isHebrew ? 'כללי:' : 'General:'} ${exam.general}`);
    }
    if (exam.heent) {
      systems.push(`HEENT: ${exam.heent}`);
    }
    if (exam.cardiovascular) {
      systems.push(`${isHebrew ? 'לב וכלי דם:' : 'Cardiovascular:'} ${exam.cardiovascular}`);
    }
    if (exam.respiratory) {
      systems.push(`${isHebrew ? 'נשימה:' : 'Respiratory:'} ${exam.respiratory}`);
    }
    if (exam.abdomen) {
      systems.push(`${isHebrew ? 'בטן:' : 'Abdomen:'} ${exam.abdomen}`);
    }
    if (exam.neurological) {
      systems.push(`${isHebrew ? 'נוירולוגי:' : 'Neurological:'} ${exam.neurological}`);
    }
    
    return systems.join('\n');
  }

  /**
   * Helper: Format assessment
   */
  formatAssessment(assessment, isHebrew) {
    if (!assessment) return null;
    
    if (typeof assessment === 'string') return assessment;
    
    if (Array.isArray(assessment)) {
      return assessment.map((item, index) => `${index + 1}. ${item}`).join('\n');
    }
    
    if (typeof assessment === 'object') {
      const formatted = [];
      if (assessment.primaryDiagnosis) {
        formatted.push(`${isHebrew ? 'אבחנה ראשית:' : 'Primary Diagnosis:'} ${assessment.primaryDiagnosis}`);
      }
      if (assessment.differentialDiagnosis) {
        formatted.push(`${isHebrew ? 'אבחנה מבדלת:' : 'Differential Diagnosis:'} ${assessment.differentialDiagnosis.join(', ')}`);
      }
      return formatted.join('\n');
    }
    
    return null;
  }

  /**
   * Helper: Format plan
   */
  formatPlan(plan, isHebrew) {
    if (!plan) return null;
    
    if (typeof plan === 'string') return plan;
    
    if (Array.isArray(plan)) {
      return plan.map((item, index) => `${index + 1}. ${item}`).join('\n');
    }
    
    if (typeof plan === 'object') {
      const formatted = [];
      if (plan.medications) {
        formatted.push(`${isHebrew ? 'תרופות:' : 'Medications:'} ${plan.medications.join(', ')}`);
      }
      if (plan.tests) {
        formatted.push(`${isHebrew ? 'בדיקות:' : 'Tests:'} ${plan.tests.join(', ')}`);
      }
      if (plan.procedures) {
        formatted.push(`${isHebrew ? 'פרוצדורות:' : 'Procedures:'} ${plan.procedures.join(', ')}`);
      }
      if (plan.followUp) {
        formatted.push(`${isHebrew ? 'מעקב:' : 'Follow-up:'} ${plan.followUp}`);
      }
      return formatted.join('\n');
    }
    
    return null;
  }

  /**
   * Helper: Format follow-up
   */
  formatFollowUp(followUp, isHebrew) {
    if (!followUp) return null;
    
    if (typeof followUp === 'string') return followUp;
    
    if (typeof followUp === 'object') {
      const formatted = [];
      if (followUp.date) {
        formatted.push(`${isHebrew ? 'תאריך:' : 'Date:'} ${followUp.date}`);
      }
      if (followUp.provider) {
        formatted.push(`${isHebrew ? 'רופא:' : 'Provider:'} ${followUp.provider}`);
      }
      if (followUp.reason) {
        formatted.push(`${isHebrew ? 'סיבה:' : 'Reason:'} ${followUp.reason}`);
      }
      return formatted.join('\n');
    }
    
    return null;
  }

  /**
   * Helper: Prepare lab results graph data
   */
  prepareLabResultsGraphData(labHistory) {
    const data = {
      labels: [],
      datasets: []
    };
    
    // Get unique tests
    const tests = new Set();
    labHistory.forEach(result => {
      Object.keys(result).forEach(test => {
        if (test !== 'date' && test !== 'timestamp') {
          tests.add(test);
        }
      });
    });
    
    // Create dataset for each test
    tests.forEach(test => {
      data.datasets.push({
        label: test,
        data: labHistory.map(result => result[test] || null),
        backgroundColor: this.getRandomColor()
      });
    });
    
    // Set labels
    data.labels = labHistory.map(result => 
      new Date(result.date || result.timestamp).toLocaleDateString()
    );
    
    return data;
  }

  /**
   * Helper: Prepare medication timeline
   */
  prepareMedicationTimeline(medications) {
    return medications.map(med => ({
      name: med.name || med.medicationName,
      start: med.startDate,
      end: med.endDate || 'ongoing',
      dosage: med.dosage
    }));
  }

  /**
   * Helper: Get random color for graphs
   */
  getRandomColor() {
    const colors = [
      'rgb(255, 99, 132)',
      'rgb(54, 162, 235)',
      'rgb(255, 205, 86)',
      'rgb(75, 192, 192)',
      'rgb(153, 102, 255)',
      'rgb(255, 159, 64)'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

module.exports = new ReportGenerator();