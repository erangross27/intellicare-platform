module.exports = {
  title: '📅 Estimated Delivery Date',
  columns: ['Date Recorded', 'EDD', 'Method', 'Gestational Age', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      EDD: getValue(entry.edd || entry.estimatedDeliveryDate),
      Method: getValue(entry.method || entry.calculationMethod),
      'Gestational Age': getValue(entry.gestationalAge || entry.ga),
      Provider: getValue(entry.provider)
    }));
  }
};
