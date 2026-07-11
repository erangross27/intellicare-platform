module.exports = {
  title: '🚭 Nicotine Replacement',
  columns: ['Date', 'Type', 'Dose', 'Adherence', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Type: getValue(entry.type || entry.product),
      Dose: getValue(entry.dose || entry.dosage),
      Adherence: getValue(entry.adherence || entry.compliance),
      Provider: getValue(entry.provider)
    }));
  }
};
