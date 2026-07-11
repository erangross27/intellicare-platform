module.exports = {
  title: '🧬 Genetic Oncology',
  columns: ['Date', 'Gene', 'Variant', 'Cancer Risk', 'Surveillance Plan'],
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
      'Cancer Risk': getValue(entry.cancerRisk || entry.risk),
      'Surveillance Plan': getValue(entry.surveillancePlan || entry.screening)
    }));
  }
};
