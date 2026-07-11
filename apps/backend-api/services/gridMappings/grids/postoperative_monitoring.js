module.exports = {
  title: '👁️ Postoperative Monitoring',
  columns: ['Date', 'Parameter', 'Frequency', 'Alert Criteria', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Parameter: getValue(entry.parameter || entry.vitalSign),
      Frequency: getValue(entry.frequency || entry.schedule),
      'Alert Criteria': getValue(entry.alertCriteria || entry.thresholds),
      Provider: getValue(entry.provider)
    }));
  }
};
