module.exports = {
  title: '📊 Contraction Monitoring',
  columns: ['Date/Time', 'Frequency', 'Duration', 'Intensity', 'Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.dateTime || entry.date ? new Date(entry.dateTime || entry.date).toLocaleString() : '-',
      Frequency: getValue(entry.frequency || entry.contractionsPerMinute),
      Duration: getValue(entry.duration || entry.contractionDuration),
      Intensity: getValue(entry.intensity || entry.strength),
      Nurse: getValue(entry.nurse || entry.provider)
    }));
  }
};
