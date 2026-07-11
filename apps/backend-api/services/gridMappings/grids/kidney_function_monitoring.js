module.exports = {
  title: '🫘 Kidney Function',
  columns: ['Date', 'Creatinine', 'eGFR', 'BUN', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Creatinine: getValue(entry.creatinine || entry.cr),
      eGFR: getValue(entry.egfr || entry.gfr),
      BUN: getValue(entry.bun || entry.bloodUreaNitrogen),
      Provider: getValue(entry.provider)
    }));
  }
};
