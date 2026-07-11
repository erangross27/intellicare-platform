module.exports = {
  title: '🩺 Second Opinion Reports',
  columns: ['Date', 'Original Diagnosis', 'Second Opinion', 'Recommendations', 'Consultant'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Original Diagnosis': getValue(entry.originalDiagnosis || entry.original),
      'Second Opinion': getValue(entry.secondOpinion || entry.opinion),
      Recommendations: getValue(entry.recommendations || entry.suggestions),
      Consultant: getValue(entry.consultant || entry.provider)
    }));
  }
};
