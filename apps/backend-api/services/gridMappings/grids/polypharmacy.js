module.exports = {
  title: '💊 Polypharmacy',
  columns: ['Date', 'Total Medications', 'Risk Level', 'Optimization Plan', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Total Medications': getValue(entry.totalMedications || entry.count),
      'Risk Level': getValue(entry.riskLevel || entry.risk),
      'Optimization Plan': getValue(entry.optimizationPlan || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
