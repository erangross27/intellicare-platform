module.exports = {
  title: '🔬 Prostate Cancer Screening',
  columns: ['Date', 'PSA', 'DRE', 'Recommendation', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      PSA: getValue(entry.psa || entry.psaLevel),
      DRE: getValue(entry.dre || entry.digitalRectalExam),
      Recommendation: getValue(entry.recommendation || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
