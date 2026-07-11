module.exports = {
  title: '🫀 Echocardiogram Reports',
  columns: ['Date', 'Ejection Fraction', 'Findings', 'Interpretation', 'Cardiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Ejection Fraction': getValue(entry.ejectionFraction || entry.ef),
      Findings: getValue(entry.findings || entry.results),
      Interpretation: getValue(entry.interpretation || entry.impression),
      Cardiologist: getValue(entry.cardiologist || entry.provider)
    }));
  }
};
