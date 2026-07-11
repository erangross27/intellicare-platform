module.exports = {
  title: '🔬 Mammography Reports',
  columns: ['Date', 'BI-RADS', 'Findings', 'Recommendation', 'Radiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'BI-RADS': getValue(entry.biRads || entry.birads),
      Findings: getValue(entry.findings || entry.results),
      Recommendation: getValue(entry.recommendation || entry.followUp),
      Radiologist: getValue(entry.radiologist || entry.provider)
    }));
  }
};
