module.exports = {
  title: '🏖️ Respite Care',
  columns: ['Date', 'Service Type', 'Duration', 'Provider', 'Caregiver'],
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
      Duration: getValue(entry.duration || entry.length),
      Provider: getValue(entry.provider),
      Caregiver: getValue(entry.caregiver || entry.family)
    }));
  }
};
