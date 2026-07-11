module.exports = {
  title: '⚠️ Medication Safety Alerts',
  columns: ['Date', 'Medication', 'Severity', 'Adverse Event', 'Reporting Source'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '-',
      Medication: getValue(entry.medicationName),
      Severity: getValue(entry.alertSeverityLevel),
      'Adverse Event': getValue(entry.adverseEventType),
      'Reporting Source': getValue(entry.reportingSource)
    }));
  }
};
