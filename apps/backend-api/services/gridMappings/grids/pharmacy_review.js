module.exports = {
  title: '💊 Pharmacy Review',
  columns: ['Date', 'Review Type', 'Findings', 'Recommendations', 'Pharmacist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Review Type': getValue(entry.reviewType || entry.type),
      Findings: getValue(entry.findings || entry.issues),
      Recommendations: getValue(entry.recommendations || entry.suggestions),
      Pharmacist: getValue(entry.pharmacist || entry.provider)
    }));
  }
};
