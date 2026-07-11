module.exports = {
  title: '🔬 Variant Interpretation Guidelines',
  columns: ['Date', 'Variant', 'Classification', 'Evidence', 'Geneticist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Variant: getValue(entry.variant || entry.variantName),
      Classification: getValue(entry.classification || entry.pathogenicity),
      Evidence: getValue(entry.evidence || entry.supportingData),
      Geneticist: getValue(entry.geneticist || entry.provider)
    }));
  }
};
