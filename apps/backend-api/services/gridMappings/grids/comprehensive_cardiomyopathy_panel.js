module.exports = {
  title: '🧬 Cardiomyopathy Panel',
  columns: ['Date', 'Gene', 'Variant', 'Classification', 'Clinical Significance'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Gene: getValue(entry.gene),
      Variant: getValue(entry.variant || entry.mutation),
      Classification: getValue(entry.classification || entry.category),
      'Clinical Significance': getValue(entry.clinicalSignificance || entry.significance)
    }));
  }
};
