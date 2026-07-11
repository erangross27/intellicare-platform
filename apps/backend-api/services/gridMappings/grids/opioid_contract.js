module.exports = {
  title: '📋 Opioid Contract',
  columns: ['Date', 'Agreement Type', 'Terms', 'Status', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Agreement Type': getValue(entry.agreementType || entry.type),
      Terms: getValue(entry.terms || entry.conditions),
      Status: getValue(entry.status || entry.compliance),
      Provider: getValue(entry.provider)
    }));
  }
};
