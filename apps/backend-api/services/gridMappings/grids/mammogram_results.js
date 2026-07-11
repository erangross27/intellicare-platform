module.exports = {
  title: '🩺 Mammogram Results',
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
      'BI-RADS': getValue(entry.birads || entry.biRadsScore),
      Findings: getValue(entry.findings || entry.impressions),
      Recommendation: getValue(entry.recommendation || entry.followUp),
      Radiologist: getValue(entry.radiologist || entry.provider)
    }));
  }
};
