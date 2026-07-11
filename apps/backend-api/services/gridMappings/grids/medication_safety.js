module.exports = {
  title: '⚠️ Medication Safety',
  columns: ['Date', 'Medication', 'Safety Concern', 'Action Taken', 'Provider'],
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
      'Safety Concern': getValue(entry.safetyConcern || entry.concern),
      'Action Taken': getValue(entry.actionTaken || entry.intervention),
      Provider: getValue(entry.provider)
    }));
  }
};
