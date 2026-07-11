module.exports = {
  title: '🫘 Kidney Disease Progression Timeline',
  columns: ['Date', 'CKD Stage', 'eGFR', 'Trend', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'CKD Stage': getValue(entry.ckdStage || entry.stage),
      eGFR: getValue(entry.egfr || entry.eGFR),
      Trend: getValue(entry.trend || entry.progression),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
