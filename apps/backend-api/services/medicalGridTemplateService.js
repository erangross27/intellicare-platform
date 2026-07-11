/**
 * Medical Grid Template Service
 * Provides grid configurations for all 184 medical GET functions
 * Central source of truth for grid column definitions and formatting
 */

const { getFunctions } = require('../medical-grid-system/configs/ALL_GET_FUNCTIONS');

class MedicalGridTemplateService {
  constructor() {
    this.gridConfigurations = new Map();
    this.initializeGridTemplates();
  }

  /**
   * Initialize grid templates for all 185 GET functions
   */
  initializeGridTemplates() {
    getFunctions.forEach(func => {
      const gridConfig = this.generateGridConfig(func);
      this.gridConfigurations.set(func.name, gridConfig);
    });

    console.log(`✅ Initialized ${this.gridConfigurations.size} medical grid templates`);
  }

  /**
   * Generate grid configuration for a specific function
   */
  generateGridConfig(func) {
    const columns = this.getColumnsForFunction(func);
    const filters = this.getFiltersForFunction(func);
    const actions = this.getActionsForFunction(func);
    const formatters = this.getFormattersForFunction(func);

    return {
      functionName: func.name,
      category: func.category,
      collection: func.collection,
      priority: func.priority,
      gridType: 'medical-data',
      columns,
      filters,
      actions,
      formatters,
      features: {
        sortable: true,
        filterable: true,
        exportable: true,
        selectable: func.priority !== 'CRITICAL', // Critical records shouldn't be bulk selected
        editable: func.priority !== 'CRITICAL', // Critical records need special edit flow
        realTimeUpdates: func.priority === 'CRITICAL',
        auditTrail: func.priority === 'CRITICAL' || func.category === 'Core Medical Records',
        virtualScrolling: true,
        pagination: {
          enabled: true,
          defaultPageSize: func.priority === 'CRITICAL' ? 50 : 100,
          pageSizeOptions: [25, 50, 100, 250, 500]
        }
      },
      performance: {
        cacheEnabled: true,
        cacheDuration: func.priority === 'CRITICAL' ? 30 : 300, // seconds
        indexedFields: this.getIndexedFields(func),
        lazyLoad: true
      }
    };
  }

  /**
   * Get column definitions for a specific function
   */
  getColumnsForFunction(func) {
    // Special case: listAllPatients uses custom patient list columns
    if (func.name === 'listAllPatients') {
      return [
        {
          id: 'patientName',
          field: 'patientName',
          headerName: 'Patient Name',
          width: 200,
          sortable: true,
          filterable: true,
          frozen: true
        },
        {
          id: 'dateOfBirth',
          field: 'dateOfBirth',
          headerName: 'Date of Birth',
          width: 130,
          sortable: true,
          filterable: true
        },
        {
          id: 'gender',
          field: 'gender',
          headerName: 'Gender',
          width: 100,
          sortable: true,
          filterable: true
        },
        {
          id: 'phone',
          field: 'phone',
          headerName: 'Phone',
          width: 150,
          sortable: true,
          filterable: true
        },
        {
          id: 'email',
          field: 'email',
          headerName: 'Email',
          width: 200,
          sortable: true,
          filterable: true
        },
        {
          id: 'status',
          field: 'status',
          headerName: 'Status',
          width: 120,
          sortable: true,
          filterable: true
        },
        {
          id: 'doctorSummary',
          field: 'doctorSummary',
          headerName: 'Doctor Summary',
          width: 300,
          sortable: true,
          filterable: true
        }
      ];
    }

    const baseColumns = [];

    // Patient name column (almost always first)
    if (!func.name.includes('Summary') && !func.name.includes('Statistics')) {
      baseColumns.push({
        id: 'patientName',
        field: 'patientName',
        headerName: 'Patient Name',
        width: 200,
        sortable: true,
        filterable: true,
        frozen: true, // Keep visible when scrolling horizontally
        cellRenderer: 'LinkRenderer',
        cellRendererParams: {
          linkTo: 'patient'
        }
      });
    }

    // Category-specific columns
    const categoryColumns = this.getCategorySpecificColumns(func);

    // Status column (common to most grids)
    if (!func.name.includes('History') && !func.name.includes('Log')) {
      baseColumns.push({
        id: 'status',
        field: 'status',
        headerName: 'Status',
        width: 120,
        sortable: true,
        filterable: true,
        cellRenderer: 'StatusBadgeRenderer',
        filterOptions: this.getStatusOptions(func.category)
      });
    }

    // Date column
    baseColumns.push({
      id: 'date',
      field: func.name.includes('Appointment') ? 'appointmentDate' :
              func.name.includes('Visit') ? 'visitDate' :
              func.name.includes('Report') ? 'reportDate' : 'date',
      headerName: 'Date',
      width: 120,
      sortable: true,
      filterable: true,
      cellRenderer: 'DateRenderer',
      filter: 'DateRangeFilter'
    });

    // Provider/Author column
    baseColumns.push({
      id: 'provider',
      field: func.name.includes('Report') ? 'author' : 'provider',
      headerName: func.name.includes('Report') ? 'Author' : 'Provider',
      width: 180,
      sortable: true,
      filterable: true
    });

    return [...baseColumns, ...categoryColumns];
  }

  /**
   * Get category-specific columns
   */
  getCategorySpecificColumns(func) {
    const columns = [];

    switch (func.category) {
      case 'Core Medical Records':
        if (func.name === 'getMedications') {
          columns.push(
            { id: 'medicationName', field: 'medicationName', headerName: 'Medication', width: 250 },
            { id: 'dosage', field: 'dosage', headerName: 'Dosage', width: 120 },
            { id: 'frequency', field: 'frequency', headerName: 'Frequency', width: 150 },
            { id: 'route', field: 'route', headerName: 'Route', width: 100 }
          );
        } else if (func.name === 'getAllergies') {
          columns.push(
            { id: 'allergen', field: 'allergen', headerName: 'Allergen', width: 250 },
            { id: 'severity', field: 'severity', headerName: 'Severity', width: 120, cellRenderer: 'SeverityRenderer' },
            { id: 'reaction', field: 'reaction', headerName: 'Reaction', width: 300 }
          );
        } else if (func.name === 'getVitalSignsLogs') {
          columns.push(
            { id: 'bloodPressure', field: 'bloodPressure', headerName: 'BP', width: 100 },
            { id: 'heartRate', field: 'heartRate', headerName: 'HR', width: 80 },
            { id: 'temperature', field: 'temperature', headerName: 'Temp', width: 80 },
            { id: 'respiratoryRate', field: 'respiratoryRate', headerName: 'RR', width: 80 },
            { id: 'oxygenSaturation', field: 'oxygenSaturation', headerName: 'O2', width: 80 }
          );
        } else if (func.name === 'getLabResults') {
          columns.push(
            { id: 'testName', field: 'testName', headerName: 'Test', width: 200 },
            { id: 'result', field: 'result', headerName: 'Result', width: 120, cellRenderer: 'LabResultRenderer' },
            { id: 'referenceRange', field: 'referenceRange', headerName: 'Reference', width: 150 },
            { id: 'flag', field: 'flag', headerName: 'Flag', width: 80, cellRenderer: 'FlagRenderer' }
          );
        }
        break;

      case 'Hospital & Emergency':
        columns.push(
          { id: 'chiefComplaint', field: 'chiefComplaint', headerName: 'Chief Complaint', width: 250 },
          { id: 'triageLevel', field: 'triageLevel', headerName: 'Triage', width: 100, cellRenderer: 'TriageRenderer' },
          { id: 'disposition', field: 'disposition', headerName: 'Disposition', width: 150 }
        );

        if (func.name.includes('ICU')) {
          columns.push(
            { id: 'ventilatorSettings', field: 'ventilatorSettings', headerName: 'Vent', width: 200 },
            { id: 'vasopressors', field: 'vasopressors', headerName: 'Pressors', width: 150 }
          );
        }
        break;

      case 'Surgical & Operative':
        columns.push(
          { id: 'procedureName', field: 'procedureName', headerName: 'Procedure', width: 300 },
          { id: 'surgeon', field: 'surgeon', headerName: 'Surgeon', width: 180 },
          { id: 'duration', field: 'duration', headerName: 'Duration', width: 100 },
          { id: 'complications', field: 'complications', headerName: 'Complications', width: 200 }
        );
        break;

      case 'Cardiology':
        if (func.name.includes('ECG') || func.name.includes('EKG')) {
          columns.push(
            { id: 'rhythm', field: 'rhythm', headerName: 'Rhythm', width: 150 },
            { id: 'rate', field: 'rate', headerName: 'Rate', width: 80 },
            { id: 'prInterval', field: 'prInterval', headerName: 'PR', width: 80 },
            { id: 'qrsComplex', field: 'qrsComplex', headerName: 'QRS', width: 80 }
          );
        } else if (func.name.includes('Echo')) {
          columns.push(
            { id: 'ejectionFraction', field: 'ejectionFraction', headerName: 'EF%', width: 80 },
            { id: 'wallMotion', field: 'wallMotion', headerName: 'Wall Motion', width: 150 },
            { id: 'valves', field: 'valves', headerName: 'Valves', width: 200 }
          );
        }
        break;

      case 'Imaging':
        columns.push(
          { id: 'modality', field: 'modality', headerName: 'Modality', width: 120 },
          { id: 'bodyPart', field: 'bodyPart', headerName: 'Body Part', width: 150 },
          { id: 'findings', field: 'findings', headerName: 'Findings', width: 300 },
          { id: 'impression', field: 'impression', headerName: 'Impression', width: 300 }
        );
        break;

      case 'Pediatrics':
        columns.push(
          { id: 'age', field: 'age', headerName: 'Age', width: 100 },
          { id: 'weight', field: 'weight', headerName: 'Weight', width: 100 },
          { id: 'height', field: 'height', headerName: 'Height', width: 100 }
        );

        if (func.name.includes('Growth')) {
          columns.push(
            { id: 'weightPercentile', field: 'weightPercentile', headerName: 'Wt %ile', width: 90 },
            { id: 'heightPercentile', field: 'heightPercentile', headerName: 'Ht %ile', width: 90 }
          );
        }
        break;

      case 'Diagnostic':
        columns.push(
          { id: 'specimen', field: 'specimen', headerName: 'Specimen', width: 150 },
          { id: 'collectionDate', field: 'collectionDate', headerName: 'Collected', width: 150 },
          { id: 'resultDate', field: 'resultDate', headerName: 'Resulted', width: 150 }
        );
        break;

      default:
        // Generic columns for other categories
        columns.push(
          { id: 'description', field: 'description', headerName: 'Description', width: 300 },
          { id: 'notes', field: 'notes', headerName: 'Notes', width: 300 }
        );
    }

    return columns;
  }

  /**
   * Get filter configuration for function
   */
  getFiltersForFunction(func) {
    const filters = {
      quickFilters: [],
      advancedFilters: [],
      savedFilters: true,
      customFilters: []
    };

    // Common quick filters
    filters.quickFilters.push(
      { id: 'today', label: 'Today', type: 'date', value: 'today' },
      { id: 'thisWeek', label: 'This Week', type: 'date', value: 'thisWeek' },
      { id: 'thisMonth', label: 'This Month', type: 'date', value: 'thisMonth' }
    );

    // Priority-based filters
    if (func.priority === 'CRITICAL') {
      filters.quickFilters.push(
        { id: 'critical', label: 'Critical Only', type: 'severity', value: 'critical' },
        { id: 'urgent', label: 'Urgent', type: 'priority', value: 'urgent' }
      );
    }

    // Category-specific filters
    if (func.category === 'Diagnostic') {
      filters.quickFilters.push(
        { id: 'abnormal', label: 'Abnormal Only', type: 'result', value: 'abnormal' },
        { id: 'pending', label: 'Pending Results', type: 'status', value: 'pending' }
      );
    }

    if (func.category === 'Hospital & Emergency') {
      filters.quickFilters.push(
        { id: 'admitted', label: 'Currently Admitted', type: 'status', value: 'admitted' },
        { id: 'discharge', label: 'Pending Discharge', type: 'status', value: 'pendingDischarge' }
      );
    }

    // Advanced filters
    filters.advancedFilters = [
      { id: 'dateRange', label: 'Date Range', type: 'dateRange' },
      { id: 'provider', label: 'Provider', type: 'multiSelect' },
      { id: 'status', label: 'Status', type: 'multiSelect' },
      { id: 'search', label: 'Text Search', type: 'text' }
    ];

    return filters;
  }

  /**
   * Get row actions for function
   */
  getActionsForFunction(func) {
    const actions = {
      row: [],
      bulk: [],
      contextMenu: []
    };

    // Common row actions
    actions.row = [
      { id: 'view', label: 'View Details', icon: 'visibility', handler: 'viewDetails' },
      { id: 'edit', label: 'Edit', icon: 'edit', handler: 'editRecord', enabled: func.priority !== 'CRITICAL' },
      { id: 'print', label: 'Print', icon: 'print', handler: 'printRecord' },
      { id: 'export', label: 'Export PDF', icon: 'download', handler: 'exportPDF' }
    ];

    // Add critical actions for high priority
    if (func.priority === 'CRITICAL' || func.priority === 'HIGH') {
      actions.row.push(
        { id: 'flag', label: 'Flag for Review', icon: 'flag', handler: 'flagRecord' },
        { id: 'notify', label: 'Send Notification', icon: 'notifications', handler: 'sendNotification' }
      );
    }

    // Bulk actions
    actions.bulk = [
      { id: 'exportSelected', label: 'Export Selected', icon: 'download', handler: 'bulkExport' },
      { id: 'printSelected', label: 'Print Selected', icon: 'print', handler: 'bulkPrint' }
    ];

    // Only allow bulk delete for non-critical records
    if (func.priority !== 'CRITICAL') {
      actions.bulk.push(
        { id: 'archiveSelected', label: 'Archive Selected', icon: 'archive', handler: 'bulkArchive' }
      );
    }

    // Context menu actions
    actions.contextMenu = [
      { id: 'copy', label: 'Copy', handler: 'copyCell' },
      { id: 'copyRow', label: 'Copy Row', handler: 'copyRow' },
      { id: 'openNewTab', label: 'Open in New Tab', handler: 'openNewTab' }
    ];

    return actions;
  }

  /**
   * Get data formatters for function
   */
  getFormattersForFunction(func) {
    const formatters = {
      date: (value) => {
        if (!value) return '--';
        const date = new Date(value);
        return date.toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric'
        });
      },
      datetime: (value) => {
        if (!value) return '--';
        const date = new Date(value);
        return date.toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      },
      time: (value) => {
        if (!value) return '--';
        const date = new Date(value);
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
      },
      currency: (value) => {
        if (value == null) return '--';
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value);
      },
      percentage: (value) => {
        if (value == null) return '--';
        return `${value}%`;
      },
      boolean: (value) => value ? 'Yes' : 'No',
      nullValue: () => '--'
    };

    // Add category-specific formatters
    if (func.category === 'Diagnostic') {
      formatters.labResult = (value, referenceRange) => {
        const isHigh = value > referenceRange?.max;
        const isLow = value < referenceRange?.min;
        return {
          value,
          flag: isHigh ? 'H' : isLow ? 'L' : '',
          color: isHigh || isLow ? 'red' : 'green'
        };
      };
    }

    if (func.category === 'Cardiology') {
      formatters.bloodPressure = (systolic, diastolic) => `${systolic}/${diastolic}`;
      formatters.heartRate = (value) => `${value} bpm`;
    }

    if (func.category === 'Core Medical Records' && func.name === 'getAllergies') {
      formatters.severity = (value) => {
        const severityMap = {
          'mild': { color: 'yellow', icon: 'info' },
          'moderate': { color: 'orange', icon: 'warning' },
          'severe': { color: 'red', icon: 'error' },
          'life-threatening': { color: 'darkred', icon: 'dangerous' }
        };
        return severityMap[value?.toLowerCase()] || { color: 'gray', icon: 'help' };
      };
    }

    return formatters;
  }

  /**
   * Get indexed fields for performance optimization
   */
  getIndexedFields(func) {
    const fields = ['patientId', 'date', 'status', 'practiceId'];

    if (func.priority === 'CRITICAL') {
      fields.push('severity', 'triageLevel', 'critical');
    }

    if (func.category === 'Diagnostic') {
      fields.push('result.isAbnormal', 'resultDate');
    }

    return fields;
  }

  /**
   * Get status options based on category
   */
  getStatusOptions(category) {
    const baseStatuses = ['Active', 'Completed', 'Cancelled'];

    const categoryStatuses = {
      'Core Medical Records': ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'No Show'],
      'Hospital & Emergency': ['Admitted', 'In Treatment', 'Stable', 'Critical', 'Discharged', 'Transferred'],
      'Diagnostic': ['Ordered', 'Scheduled', 'In Process', 'Resulted', 'Reviewed', 'Abnormal'],
      'Surgical & Operative': ['Pre-Op', 'In OR', 'Post-Op', 'Recovery', 'Discharged'],
      'Imaging': ['Scheduled', 'In Progress', 'Complete', 'Read', 'Finalized']
    };

    return categoryStatuses[category] || baseStatuses;
  }

  /**
   * Get grid configuration for a specific function
   */
  getGridConfig(functionName) {
    return this.gridConfigurations.get(functionName);
  }

  /**
   * Get all grid configurations
   */
  getAllGridConfigs() {
    return Array.from(this.gridConfigurations.values());
  }

  /**
   * Update grid configuration
   */
  updateGridConfig(functionName, updates) {
    const current = this.gridConfigurations.get(functionName);
    if (current) {
      this.gridConfigurations.set(functionName, {
        ...current,
        ...updates
      });
      return true;
    }
    return false;
  }

  /**
   * Get grids by category
   */
  getGridsByCategory(category) {
    return Array.from(this.gridConfigurations.values())
      .filter(config => config.category === category);
  }

  /**
   * Get grids by priority
   */
  getGridsByPriority(priority) {
    return Array.from(this.gridConfigurations.values())
      .filter(config => config.priority === priority);
  }
}

// Export singleton instance
module.exports = new MedicalGridTemplateService();