module.exports = {
  title: '📋 Pre-Admission Testing',
  columns: ['Date', 'Procedure', 'Tests Completed', 'Clearance', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.plannedSurgery),
      'Tests Completed': getValue(entry.testsCompleted || entry.labs),
      Clearance: getValue(entry.clearance || entry.medicalClearance),
      Provider: getValue(entry.provider)
    }));
  }
};
