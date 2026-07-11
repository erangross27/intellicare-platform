module.exports = {
  title: '💧 Current Dialysis',
  columns: ['Date', 'Modality', 'Schedule', 'Access', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Modality: getValue(entry.modality || entry.type),
      Schedule: getValue(entry.schedule || entry.frequency),
      Access: getValue(entry.access || entry.accessType),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
