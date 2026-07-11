module.exports = {
  title: '🤝 Psychosocial Support Services',
  columns: ['Date', 'Service Type', 'Referral', 'Status', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Service Type': getValue(entry.serviceType || entry.type),
      Referral: getValue(entry.referral || entry.referredTo),
      Status: getValue(entry.status || entry.outcome),
      Provider: getValue(entry.provider)
    }));
  }
};
