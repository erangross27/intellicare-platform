// GridFormatterService - Centralized grid formatting for all IntelliCare functions
// Handles consistent data display across thousands of functions

class GridFormatterService {
  constructor() {
    // Grid templates for different data types
    this.gridTemplates = {
      'patient-list': {
        title: 'Patients',
        israeli: {
          columns: ['firstName', 'lastName', 'nationalId', 'age', 'phone', 'healthFund'],
          headers: ['First Name', 'Last Name', 'National ID', 'Age', 'Phone', 'Health Fund']
        },
        us: {
          columns: ['firstName', 'lastName', 'ssn', 'age', 'phone', 'insurance'],
          headers: ['First Name', 'Last Name', 'SSN', 'Age', 'Phone', 'Insurance']
        }
      },

      'followup-list': {
        title: 'Follow-up Patients',
        columns: ['patientName', 'patientAge', 'followUpDate', 'followUpTime', 'doctor', 'department', 'reason', 'priority'],
        headers: ['Patient Name', 'Age', 'Follow-up Date', 'Time', 'Doctor', 'Department', 'Reason', 'Priority']
      },

      'appointment-list': {
        title: 'Appointments',
        columns: ['patientName', 'date', 'time', 'provider', 'type', 'status', 'duration'],
        headers: ['Patient Name', 'Date', 'Time', 'Provider', 'Type', 'Status', 'Duration']
      },

      'medical-records': {
        title: 'Medical Records',
        columns: ['patientName', 'recordType', 'date', 'provider', 'diagnosis', 'status'],
        headers: ['Patient Name', 'Record Type', 'Date', 'Provider', 'Diagnosis', 'Status']
      },

      'documents': {
        title: 'Documents',
        columns: ['patientName', 'documentType', 'uploadDate', 'status', 'provider'],
        headers: ['Patient Name', 'Document Type', 'Upload Date', 'Status', 'Provider']
      },

      'financial': {
        title: 'Financial Records',
        columns: ['patientName', 'amount', 'paymentStatus', 'insuranceInfo', 'date'],
        headers: ['Patient Name', 'Amount', 'Payment Status', 'Insurance', 'Date']
      }
    };

    // Function to grid template mappings
    this.functionMappings = require('./functionGridMappings');

    // Medical grid template service for advanced grid configs
    this.medicalGridTemplateService = require('./medicalGridTemplateService');
  }

  /**
   * Format function result data for grid display
   * @param {string} functionName - Name of the function that returned data
   * @param {object} data - Function result data
   * @param {string} locale - User locale (he-IL, en-US, etc.)
   * @param {object} practiceContext - Practice context for regional differences
   * @returns {object} Formatted grid data
   */
  formatForDisplay(functionName, data, locale = 'he-IL', practiceContext = {}) {
    console.log(`🎯 [GridFormatter] formatForDisplay called for: ${functionName}`);

    // Get grid configuration for this function
    const gridConfig = this.getGridConfig(functionName, practiceContext);

    console.log(`🎯 [GridFormatter] gridConfig result:`, {
      functionName,
      hasConfig: !!gridConfig,
      config: gridConfig ? Object.keys(gridConfig) : null
    });

    if (!gridConfig) {
      // No specific grid config, return data as-is
      console.log(`⚠️ [GridFormatter] No grid config found for ${functionName}, returning data as-is`);
      return data;
    }

    // Apply grid formatting
    const formattedData = {
      ...data,
      displayType: 'grid',  // CRITICAL: Frontend checks this to render grid UI
      gridFormat: true,
      skipClaudeFormatting: true, // CRITICAL: Tell frontend to display grid directly, not as Claude text
      gridConfig: gridConfig,
      displayTitle: gridConfig.title,
      columns: gridConfig.columns,
      headers: gridConfig.headers,
      hiddenColumns: gridConfig.hiddenColumns || [],
      // Include medical grid specific properties
      cellRenderers: gridConfig.cellRenderers,
      sortableColumns: gridConfig.sortableColumns,
      filterableColumns: gridConfig.filterableColumns,
      frozenColumns: gridConfig.frozenColumns,
      quickFilters: gridConfig.quickFilters,
      features: gridConfig.features,
      performance: gridConfig.performance
    };

    // Apply locale-specific formatting
    if (locale.startsWith('he')) {
      formattedData.locale = 'hebrew';
      formattedData.rtl = true;
    }

    // Apply security filtering based on user roles
    if (practiceContext.currentUser?.roles) {
      formattedData.data = this.applySecurity(formattedData.data, gridConfig, practiceContext.currentUser.roles);
    }

    return formattedData;
  }

  /**
   * Get grid configuration for a specific function
   * @param {string} functionName - Function name
   * @param {object} practiceContext - Practice context
   * @returns {object|null} Grid configuration
   */
  getGridConfig(functionName, practiceContext = {}) {
    console.log(`🔍 [GridFormatter] getGridConfig for: ${functionName}`);

    // Use medicalGridTemplateService - the ONLY source of truth for grid configs
    const medicalGridConfig = this.medicalGridTemplateService.getGridConfig(functionName);

    if (!medicalGridConfig) {
      console.log(`⚠️ [GridFormatter] No grid config found in medicalGridTemplateService for ${functionName}`);
      return null;
    }

    console.log(`✅ [GridFormatter] Found medical grid config for ${functionName}`);

    // Convert medicalGridConfig structure to frontend format
    const config = {
      title: medicalGridConfig.functionName.replace(/^get/, '').replace(/([A-Z])/g, ' $1').trim(),
      columns: medicalGridConfig.columns.map(col => col.field),
      headers: medicalGridConfig.columns.map(col => col.headerName),
      hiddenColumns: ['_id', 'createdBy', 'lastModifiedBy'],
      cellRenderers: medicalGridConfig.columns.reduce((acc, col) => {
        if (col.cellRenderer) acc[col.field] = col.cellRenderer;
        return acc;
      }, {}),
      sortableColumns: medicalGridConfig.columns.filter(col => col.sortable).map(col => col.field),
      filterableColumns: medicalGridConfig.columns.filter(col => col.filterable).map(col => col.field),
      frozenColumns: medicalGridConfig.columns.filter(col => col.frozen).map(col => col.field),
      quickFilters: medicalGridConfig.filters?.quickFilters || [],
      features: medicalGridConfig.features,
      performance: medicalGridConfig.performance
    };

    return config;
  }

  /**
   * Apply security filtering to grid data
   * @param {array} data - Grid data array
   * @param {object} gridConfig - Grid configuration
   * @param {array} userRoles - User roles
   * @returns {array} Filtered data
   */
  applySecurity(data, gridConfig, userRoles) {
    // Define sensitive fields that require elevated permissions
    const sensitiveFields = ['nationalId', 'ssn', 'phone', 'email', 'address'];

    // Check if user has permission to view sensitive data
    const hasElevatedPermission = userRoles.some(role =>
      ['doctor', 'nurse', 'admin', 'medical_director'].includes(role.toLowerCase())
    );

    if (hasElevatedPermission) {
      return data; // Full access
    }

    // Filter sensitive data for limited roles
    return data.map(item => {
      const filteredItem = { ...item };
      sensitiveFields.forEach(field => {
        if (filteredItem[field]) {
          filteredItem[field] = '***'; // Mask sensitive data
        }
      });
      return filteredItem;
    });
  }

  /**
   * Add new grid template
   * @param {string} templateName - Template name
   * @param {object} template - Template configuration
   */
  addGridTemplate(templateName, template) {
    this.gridTemplates[templateName] = template;
  }

  /**
   * Add function mapping
   * @param {string} functionName - Function name
   * @param {object} mapping - Grid mapping configuration
   */
  addFunctionMapping(functionName, mapping) {
    this.functionMappings[functionName] = mapping;
  }
}

module.exports = new GridFormatterService();