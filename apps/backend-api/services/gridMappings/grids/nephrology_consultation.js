module.exports = {
  title: '🫘 Nephrology Consultation',
  columns: ['Date', 'Indication', 'eGFR', 'Recommendations', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Indication: getValue(entry.indication || entry.reason),
      eGFR: getValue(entry.egfr || entry.kidneyFunction),
      Recommendations: getValue(entry.recommendations || entry.plan),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
