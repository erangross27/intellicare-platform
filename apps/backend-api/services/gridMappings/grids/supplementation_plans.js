module.exports = {
  title: '💊 Supplementation Plans',
  columns: ['Date', 'Supplement', 'Dosage', 'Frequency', 'Provider'],
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
      Frequency: getValue(entry.frequency || entry.schedule),
      Provider: getValue(entry.provider)
    }));
  }
};
