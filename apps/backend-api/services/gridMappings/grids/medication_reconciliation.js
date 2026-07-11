module.exports = {
  title: '🔄 Medication Reconciliation',
  columns: ['Date', 'Medication', 'Home vs Hospital', 'Action Taken', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Medication: getValue(entry.medication || entry.drug),
      comparison: getValue(entry.comparison || entry.discrepancy),
      action: getValue(entry.action || entry.resolution),
      Provider: getValue(entry.provider)
    }));
  }
};
