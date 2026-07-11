module.exports = {
  title: '⚡ Seizure Monitoring',
  columns: ['Date/Time', 'Type', 'Duration', 'Intervention', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Type: getValue(entry.type || entry.seizureType),
      Duration: getValue(entry.duration || entry.length),
      Intervention: getValue(entry.intervention || entry.treatment),
      Provider: getValue(entry.provider)
    }));
  }
};
