module.exports = {
  title: '📋 ACMG Guidelines Reference',
  columns: ['Date', 'Guideline', 'Variant Classification', 'Recommendation', 'Geneticist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Guideline: getValue(entry.guideline || entry.reference),
      'Variant Classification': getValue(entry.variantClassification || entry.classification),
      Recommendation: getValue(entry.recommendation || entry.action),
      Geneticist: getValue(entry.geneticist || entry.provider)
    }));
  }
};
