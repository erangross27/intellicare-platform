module.exports = {
  title: '🫘 Diabetic Nephropathy',
  columns: ['Date', 'Stage', 'Albuminuria', 'eGFR', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Stage: getValue(entry.stage || entry.ckdStage),
      Albuminuria: getValue(entry.albuminuria || entry.uacr),
      eGFR: getValue(entry.egfr || entry.eGFR),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
