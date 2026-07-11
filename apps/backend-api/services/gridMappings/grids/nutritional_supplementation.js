module.exports = {
  title: '💊 Nutritional Supplementation',
  columns: ['Date', 'Supplement', 'Dosage', 'Indication', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Supplement: getValue(entry.supplement || entry.name),
      Dosage: getValue(entry.dosage || entry.dose),
      Indication: getValue(entry.indication || entry.reason),
      Provider: getValue(entry.provider)
    }));
  }
};
