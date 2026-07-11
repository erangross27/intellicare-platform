module.exports = {
  title: '📋 Prior Authorization Forms',
  columns: ['Date', 'Service/Medication', 'Justification', 'Status', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Service/Medication': getValue(entry.serviceMedication || entry.request),
      Justification: getValue(entry.justification || entry.medicalNecessity),
      Status: getValue(entry.status || entry.approvalStatus),
      Provider: getValue(entry.provider)
    }));
  }
};
