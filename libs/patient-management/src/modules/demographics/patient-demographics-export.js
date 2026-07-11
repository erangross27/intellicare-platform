/**
 * Patient Demographics Export Module
 * Handles exporting patient demographic data in various formats
 */

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientDemographicsExport {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-demographics-export');
    this.initialized = true;
    console.log('✅ [PatientDemographicsExport] Service initialized');
  }

  /**
   * Export patient demographics to CSV format
   * @param {Object} filters - Export filters
   * @param {Object} practiceContext - Practice context
   * @param {Object} options - Export options
   * @returns {Object} Export result
   */
  async exportToCSV(filters = {}, practiceContext, options = {}) {
    console.log('📊 [PatientDemographicsExport] Exporting to CSV');

    try {
      const exportData = await this.getExportData(filters, practiceContext, options);
      if (!exportData.success) {
        return exportData;
      }

      const csvContent = this.generateCSVContent(exportData.demographics, options);
      const filename = this.generateFilename('demographics_export', 'csv', practiceContext);

      return {
        success: true,
        content: csvContent,
        filename,
        contentType: 'text/csv',
        recordCount: exportData.demographics.length,
        message: 'Demographics exported to CSV successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDemographicsExport] CSV export failed:', error);
      return {
        success: false,
        error: 'CSV_EXPORT_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Export patient demographics to Excel format
   * @param {Object} filters - Export filters
   * @param {Object} practiceContext - Practice context
   * @param {Object} options - Export options
   * @returns {Object} Export result
   */
  async exportToExcel(filters = {}, practiceContext, options = {}) {
    console.log('📊 [PatientDemographicsExport] Exporting to Excel');

    try {
      const exportData = await this.getExportData(filters, practiceContext, options);
      if (!exportData.success) {
        return exportData;
      }

      const excelData = this.formatForExcel(exportData.demographics, options);
      const filename = this.generateFilename('demographics_export', 'xlsx', practiceContext);

      return {
        success: true,
        data: excelData,
        filename,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        recordCount: exportData.demographics.length,
        message: 'Demographics exported to Excel successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDemographicsExport] Excel export failed:', error);
      return {
        success: false,
        error: 'EXCEL_EXPORT_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Export patient demographics to PDF format
   * @param {Object} filters - Export filters
   * @param {Object} practiceContext - Practice context
   * @param {Object} options - Export options
   * @returns {Object} Export result
   */
  async exportToPDF(filters = {}, practiceContext, options = {}) {
    console.log('📊 [PatientDemographicsExport] Exporting to PDF');

    try {
      const exportData = await this.getExportData(filters, practiceContext, options);
      if (!exportData.success) {
        return exportData;
      }

      const pdfData = await this.generatePDFReport(exportData.demographics, practiceContext, options);
      const filename = this.generateFilename('demographics_report', 'pdf', practiceContext);

      return {
        success: true,
        data: pdfData,
        filename,
        contentType: 'application/pdf',
        recordCount: exportData.demographics.length,
        message: 'Demographics report generated successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDemographicsExport] PDF export failed:', error);
      return {
        success: false,
        error: 'PDF_EXPORT_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Get export data based on filters
   */
  async getExportData(filters, practiceContext, options) {
    const context = {
      serviceId: 'patient-demographics-export',
      operation: 'get-export-data',
      practiceId: practiceContext.practiceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };

    const query = {
      ...filters,
      practiceId: practiceContext.practiceId
    };

    const queryOptions = {
      limit: options.limit || 10000,
      skip: options.skip || 0,
      sort: options.sort || { lastName: 1, firstName: 1 }
    };

    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    const results = await secureDataAccess.query('patients', query, queryOptions, context);

    return {
      success: true,
      demographics: results
    };
  }

  /**
   * Generate CSV content from demographics data
   */
  generateCSVContent(demographics, options) {
    const fields = options.fields || [
      'firstName', 'lastName', 'dateOfBirth', 'gender', 'email', 'phone',
      'street', 'city', 'state', 'zipCode', 'maritalStatus', 'emergencyContact'
    ];

    const headers = fields.map(field => this.getFieldDisplayName(field)).join(',');
    
    const rows = demographics.map(patient => {
      return fields.map(field => {
        const value = patient[field] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',');
    });

    return [headers, ...rows].join('\n');
  }

  /**
   * Format data for Excel export
   */
  formatForExcel(demographics, options) {
    const fields = options.fields || [
      'firstName', 'lastName', 'dateOfBirth', 'gender', 'email', 'phone',
      'street', 'city', 'state', 'zipCode', 'maritalStatus'
    ];

    return {
      headers: fields.map(field => this.getFieldDisplayName(field)),
      rows: demographics.map(patient => {
        return fields.map(field => patient[field] || '');
      })
    };
  }

  /**
   * Generate PDF report
   */
  async generatePDFReport(demographics, practiceContext, options) {
    // This would typically use a PDF generation library
    // For now, return formatted text data that can be converted to PDF
    const reportData = {
      title: 'Patient Demographics Report',
      practice: practiceContext.practiceName || 'Healthcare Practice',
      generatedDate: new Date().toISOString(),
      totalPatients: demographics.length,
      data: demographics.map(patient => ({
        name: `${patient.firstName || ''} ${patient.lastName || ''}`,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        contact: {
          email: patient.email,
          phone: patient.phone
        },
        address: this.formatAddress(patient)
      }))
    };

    return reportData;
  }

  /**
   * Format address for display
   */
  formatAddress(patient) {
    const parts = [];
    if (patient.street) parts.push(patient.street);
    if (patient.city) parts.push(patient.city);
    if (patient.state) parts.push(patient.state);
    if (patient.zipCode) parts.push(patient.zipCode);
    return parts.join(', ');
  }

  /**
   * Get display name for field
   */
  getFieldDisplayName(field) {
    const displayNames = {
      firstName: 'First Name',
      lastName: 'Last Name',
      dateOfBirth: 'Date of Birth',
      gender: 'Gender',
      email: 'Email',
      phone: 'Phone',
      street: 'Street',
      city: 'City',
      state: 'State',
      zipCode: 'ZIP Code',
      maritalStatus: 'Marital Status',
      emergencyContact: 'Emergency Contact'
    };
    return displayNames[field] || field;
  }

  /**
   * Generate filename for export
   */
  generateFilename(prefix, extension, practiceContext) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const clinicPrefix = practiceContext.practiceSubdomain || 'practice';
    return `${prefix}_${clinicPrefix}_${timestamp}.${extension}`;
  }
}

const patientDemographicsExport = new PatientDemographicsExport();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientDemographicsExport', () => patientDemographicsExport);
}

module.exports = patientDemographicsExport;