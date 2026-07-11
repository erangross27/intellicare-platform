module.exports = {
  title: '📋 Prior Authorization Status',
  columns: ['Date', 'Service/Medication', 'Status', 'Insurance', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Service/Medication': getValue(entry.serviceMedication || entry.item),
      Status: getValue(entry.status || entry.authorizationStatus),
      Insurance: getValue(entry.insurance || entry.payer),
      Provider: getValue(entry.provider)
    }));
  }
};
