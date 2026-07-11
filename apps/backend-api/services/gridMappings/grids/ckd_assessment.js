module.exports = {
  title: '🩺 Nephrology / Dialysis',
  columns: ['Date', 'eGFR', 'Creatinine', 'Treatment', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      eGFR: getValue(entry.egfr || entry.gfr),
      Creatinine: getValue(entry.creatinine),
      Treatment: getValue(entry.treatment || entry.plan || entry.dialysisType),
      Nephrologist: getValue(entry.provider || entry.nephrologist)
    }));
  }
};
