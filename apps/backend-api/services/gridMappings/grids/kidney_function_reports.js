module.exports = {
  title: '🫘 Kidney Function Reports',
  columns: ['Date', 'Creatinine', 'eGFR', 'BUN', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Creatinine: getValue(entry.creatinine || entry.serumCreatinine),
      eGFR: getValue(entry.egfr || entry.eGFR),
      BUN: getValue(entry.bun || entry.BUN),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
