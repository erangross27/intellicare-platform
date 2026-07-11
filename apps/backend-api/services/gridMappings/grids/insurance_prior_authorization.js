module.exports = {
  title: '📄 Prior Authorization',
  columns: ['Date', 'Medication/Service', 'Status', 'Approval Date', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Medication/Service': getValue(entry.medication || entry.service),
      Status: getValue(entry.status || entry.authorizationStatus),
      'Approval Date': entry.approvalDate ? new Date(entry.approvalDate).toLocaleDateString() : '-',
      Provider: getValue(entry.provider)
    }));
  }
};
