module.exports = {
  title: '🫁 COPD Assessments',
  columns: ['Date', 'FEV1', 'Symptoms', 'Exacerbations', 'Pulmonologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      FEV1: getValue(entry.fev1 || entry.FEV1),
      Symptoms: getValue(entry.symptoms || entry.presentation),
      Exacerbations: getValue(entry.exacerbations || entry.exacerbationHistory),
      Pulmonologist: getValue(entry.pulmonologist || entry.provider)
    }));
  }
};
