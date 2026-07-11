/**
 * Medical Report Generator Service
 * Generates comprehensive medical reports with multiple templates,
 * auto-population from patient data, graphs, and export capabilities
 */

const fs = require('fs').promises;
const path = require('path');

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class ReportGenerator {
  constructor() {
    this.initialized = false;
    this.serviceToken = null;
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
          'disposition', 'dischargeInstructions'
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
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      const secureConfigService = proxy.getService('secureConfigService');
      this.serviceToken = await serviceAccountManager.authenticate('report-generator');
      
      // Initialize secure config service
      await secureConfigService.initialize();
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      await getServiceProxy().getService('secureDataAccess').create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'reportGenerator',
        timestamp: new Date()
      }, this.getServiceContext());
      
      return this;
    } catch (error) {
      throw new Error(`Failed to initialize ReportGenerator: ${error.message}`);
    }
  }

  // Helper method to get service context for getServiceProxy().getService('secureDataAccess')
  getServiceContext(practiceId = 'global', operation = 'report-generation') {
    return {
      serviceId: 'report-generator',
      operation: operation,
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
      formatted.abnormal.push(isHebrew ? 'חמצן נמוך' : 'Low oxygen saturation');
    }

    return formatted;
  }

  /**
   * Format lab results
   */
  formatLabResults(labResults, isHebrew) {
    if (!labResults || !Array.isArray(labResults)) return null;

    return labResults.map(result => ({
      test: result.testName || result.name,
      value: result.value,
      unit: result.unit,
      referenceRange: result.referenceRange || result.normalRange,
      status: this.getLabStatus(result.value, result.referenceRange),
      date: result.date || result.timestamp
    }));
  }

  /**
   * Format medications
   */
  formatMedications(medications, isHebrew) {
    if (!medications || !Array.isArray(medications)) return null;

    return medications.map(med => ({
      name: med.name || med.medicationName,
      dosage: med.dosage,
      frequency: med.frequency,
      route: med.route,
      startDate: med.startDate,
      endDate: med.endDate,
      prescriber: med.prescriber,
      instructions: med.instructions
    }));
  }

  /**
   * Format allergies
   */
  formatAllergies(allergies, isHebrew) {
    if (!allergies || !Array.isArray(allergies)) return null;

    return allergies.map(allergy => ({
      allergen: allergy.allergen || allergy.substance,
      reaction: allergy.reaction,
      severity: allergy.severity,
      onset: allergy.onsetDate
    }));
  }

  /**
   * Format History of Present Illness
   */
  formatHPI(hpi, isHebrew) {
    if (typeof hpi === 'string') {
      return { narrative: hpi };
    }
    
    if (typeof hpi === 'object') {
      return {
        chiefComplaint: hpi.chiefComplaint,
        onset: hpi.onset,
        location: hpi.location,
        duration: hpi.duration,
        character: hpi.character,
        alleviatingFactors: hpi.alleviatingFactors,
        aggravatingFactors: hpi.aggravatingFactors,
        radiating: hpi.radiating,
        timing: hpi.timing,
        severity: hpi.severity,
        associatedSymptoms: hpi.associatedSymptoms
      };
    }
    
    return null;
  }

  /**
   * Format physical examination
   */
  formatPhysicalExam(physicalExam, isHebrew) {
    if (!physicalExam) return null;

    return {
      general: physicalExam.general,
      vitalSigns: physicalExam.vitalSigns,
      head: physicalExam.head,
      neck: physicalExam.neck,
      cardiovascular: physicalExam.cardiovascular,
      respiratory: physicalExam.respiratory,
      abdomen: physicalExam.abdomen,
      extremities: physicalExam.extremities,
      neurological: physicalExam.neurological,
      skin: physicalExam.skin
    };
  }

  /**
   * Format assessment
   */
  formatAssessment(assessment, isHebrew) {
    if (!assessment) return null;

    if (typeof assessment === 'string') {
      return { summary: assessment };
    }

    return {
      primaryDiagnosis: assessment.primaryDiagnosis,
      differentialDiagnosis: assessment.differentialDiagnosis,
      clinicalImpression: assessment.clinicalImpression,
      prognosis: assessment.prognosis
    };
  }

  /**
   * Format plan/recommendations
   */
  formatPlan(plan, isHebrew) {
    if (!plan) return null;

    if (typeof plan === 'string') {
      return { summary: plan };
    }

    return {
      diagnostic: plan.diagnostic,
      therapeutic: plan.therapeutic,
      monitoring: plan.monitoring,
      patientEducation: plan.patientEducation,
      followUp: plan.followUp
    };
  }

  /**
   * Format follow-up instructions
   */
  formatFollowUp(followUp, isHebrew) {
    if (!followUp) return null;

    return {
      appointment: followUp.appointment,
      instructions: followUp.instructions,
      precautions: followUp.precautions,
      emergencyContacts: followUp.emergencyContacts
    };
  }

  /**
   * Generate graphs for vital signs and lab results
   */
  generateGraphs(patientData, additionalData) {
    const graphs = {};

    // Vital signs trend
    if (patientData.vitalSigns || additionalData.vitalSigns) {
      graphs.vitalSignsTrend = this.generateVitalSignsGraph(
        patientData.vitalSigns || additionalData.vitalSigns
      );
    }

    // Lab results trend
    if (patientData.labResults || additionalData.labResults) {
      graphs.labResultsTrend = this.generateLabResultsGraph(
        patientData.labResults || additionalData.labResults
      );
    }

    return graphs;
  }

  /**
   * Generate vital signs graph data
   */
  generateVitalSignsGraph(vitalSigns) {
    const data = {
      type: 'line',
      datasets: [],
      options: {
        responsive: true,
        scales: {
          x: { type: 'time' },
          y: { beginAtZero: true }
        }
      }
    };

    if (Array.isArray(vitalSigns) && vitalSigns.length > 1) {
      // Blood pressure
      const bpData = vitalSigns
        .filter(vs => vs.bloodPressure)
        .map(vs => ({
          x: vs.timestamp || vs.date,
          y: vs.bloodPressure.systolic
        }));
      
      if (bpData.length > 0) {
        data.datasets.push({
          label: 'Systolic BP',
          data: bpData,
          borderColor: 'rgb(255, 99, 132)',
          tension: 0.1
        });
      }

      // Heart rate
      const hrData = vitalSigns
        .filter(vs => vs.heartRate)
        .map(vs => ({
          x: vs.timestamp || vs.date,
          y: vs.heartRate
        }));
      
      if (hrData.length > 0) {
        data.datasets.push({
          label: 'Heart Rate',
          data: hrData,
          borderColor: 'rgb(54, 162, 235)',
          tension: 0.1
        });
      }
    }

    return data;
  }

  /**
   * Generate lab results graph data
   */
  generateLabResultsGraph(labResults) {
    const data = {
      type: 'line',
      datasets: [],
      options: {
        responsive: true,
        scales: {
          x: { type: 'time' },
          y: { beginAtZero: true }
        }
      }
    };

    if (Array.isArray(labResults)) {
      // Group by test name
      const testGroups = {};
      labResults.forEach(result => {
        const testName = result.testName || result.name;
        if (!testGroups[testName]) testGroups[testName] = [];
        testGroups[testName].push(result);
      });

      // Create dataset for each test
      Object.entries(testGroups).forEach(([testName, results]) => {
        if (results.length > 1) {
          data.datasets.push({
            label: testName,
            data: results.map(result => ({
              x: result.date || result.timestamp,
              y: parseFloat(result.value) || 0
            })),
            borderColor: this.getRandomColor(),
            tension: 0.1
          });
        }
      });
    }

    return data;
  }

  /**
   * Map diagnoses to ICD-10 codes
   */
  mapDiagnosesToICD10(diagnoses) {
    return diagnoses.map(diagnosis => {
      const normalizedDiagnosis = diagnosis.toLowerCase().replace(/\s+/g, '_');
      return {
        diagnosis: diagnosis,
        icd10: this.icd10Codes[normalizedDiagnosis] || 'Not found',
        description: diagnosis
      };
    });
  }

  /**
   * Calculate age from date of birth
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
   * Calculate BMI
   */
  calculateBMI(weight, height) {
    if (!weight || !height) return null;
    
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    return Math.round(bmi * 10) / 10;
  }

  /**
   * Format address
   */
  formatAddress(address, isHebrew) {
    if (!address) return null;
    
    if (typeof address === 'string') return address;
    
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.zipCode) parts.push(address.zipCode);
    if (address.country) parts.push(address.country);
    
    return parts.join(', ');
  }

  /**
   * Get lab status based on reference range
   */
  getLabStatus(value, referenceRange) {
    if (!value || !referenceRange) return 'normal';
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'normal';
    
    // Parse reference range (e.g., "3.5-5.0" or "< 10" or "> 2")
    if (referenceRange.includes('-')) {
      const [min, max] = referenceRange.split('-').map(v => parseFloat(v.trim()));
      if (!isNaN(min) && !isNaN(max)) {
        if (numValue < min) return 'low';
        if (numValue > max) return 'high';
        return 'normal';
      }
    }
    
    return 'normal';
  }

  /**
   * Get random color for graphs
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

  /**
   * Export report to different formats
   */
  async exportReport(report, format = 'html', options = {}) {
    switch (format.toLowerCase()) {
      case 'html':
        return this.exportToHTML(report, options);
      case 'pdf':
        return this.exportToPDF(report, options);
      case 'json':
        return this.exportToJSON(report, options);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export to HTML
   */
  exportToHTML(report, options) {
    const isHebrew = report.metadata.language === 'he';
    
    let html = `
      <!DOCTYPE html>
      <html lang="${isHebrew ? 'he' : 'en'}" dir="${isHebrew ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${report.title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .section { margin-bottom: 25px; }
          .section-title { font-weight: bold; font-size: 18px; margin-bottom: 10px; color: #2c5aa0; }
          .patient-info { background-color: #f8f9fa; padding: 15px; border-radius: 5px; }
          .abnormal { color: #dc3545; font-weight: bold; }
          .normal { color: #28a745; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${report.title}</h1>
          <p>${isHebrew ? 'תאריך יצירה' : 'Generated'}: ${new Date(report.generatedAt).toLocaleString()}</p>
        </div>
    `;

    // Patient information
    if (report.patient) {
      html += `
        <div class="section">
          <div class="section-title">${isHebrew ? 'פרטי מטופל' : 'Patient Information'}</div>
          <div class="patient-info">
            <p><strong>${isHebrew ? 'שם' : 'Name'}:</strong> ${report.patient.name || 'N/A'}</p>
            <p><strong>${isHebrew ? 'תעודת זהות' : 'ID'}:</strong> ${report.patient.id || 'N/A'}</p>
            <p><strong>${isHebrew ? 'גיל' : 'Age'}:</strong> ${report.patient.age || 'N/A'}</p>
            <p><strong>${isHebrew ? 'מין' : 'Gender'}:</strong> ${report.patient.gender || 'N/A'}</p>
          </div>
        </div>
      `;
    }

    // Generate sections
    Object.entries(report.sections).forEach(([sectionKey, sectionData]) => {
      if (sectionData && sectionKey !== 'patientInfo') {
        html += `
          <div class="section">
            <div class="section-title">${this.getSectionTitle(sectionKey, isHebrew)}</div>
            <div>${this.formatSectionForHTML(sectionData, isHebrew)}</div>
          </div>
        `;
      }
    });

    html += `
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Export to JSON
   */
  exportToJSON(report, options) {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Export to PDF (placeholder - would need PDF library)
   */
  exportToPDF(report, options) {
    // This would require a PDF library like puppeteer or jsPDF
    // For now, return the HTML that could be converted to PDF
    return this.exportToHTML(report, options);
  }

  /**
   * Get section title in appropriate language
   */
  getSectionTitle(sectionKey, isHebrew) {
    const titles = {
      vitalSigns: { en: 'Vital Signs', he: 'סימנים חיוניים' },
      labResults: { en: 'Lab Results', he: 'תוצאות מעבדה' },
      medications: { en: 'Medications', he: 'תרופות' },
      allergies: { en: 'Allergies', he: 'אלרגיות' },
      assessment: { en: 'Assessment', he: 'הערכה' },
      plan: { en: 'Plan', he: 'תכנית' },
      recommendations: { en: 'Recommendations', he: 'המלצות' },
      followUp: { en: 'Follow Up', he: 'מעקב' }
    };
    
    const title = titles[sectionKey];
    return title ? (isHebrew ? title.he : title.en) : sectionKey;
  }

  /**
   * Format section data for HTML display
   */
  formatSectionForHTML(sectionData, isHebrew) {
    if (!sectionData) return 'N/A';
    
    if (typeof sectionData === 'string') {
      return `<p>${sectionData}</p>`;
    }
    
    if (Array.isArray(sectionData)) {
      return '<ul>' + sectionData.map(item => `<li>${JSON.stringify(item)}</li>`).join('') + '</ul>';
    }
    
    if (typeof sectionData === 'object') {
      return '<div>' + Object.entries(sectionData).map(([key, value]) => {
        return `<p><strong>${key}:</strong> ${typeof value === 'object' ? JSON.stringify(value) : value}</p>`;
      }).join('') + '</div>';
    }
    
    return '<p>N/A</p>';
  }
}

// Create instance
const reportGenerator = new ReportGenerator();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('reportGenerator', () => reportGenerator);
}

module.exports = reportGenerator;