module.exports = {
  title: '🔒 Restraint Use',
  columns: ['Date/Time', 'Type', 'Reason', 'Reassessment', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Type: getValue(entry.type || entry.restraintType),
      Reason: getValue(entry.reason || entry.indication),
      Reassessment: getValue(entry.reassessment || entry.evaluation),
      Provider: getValue(entry.provider)
    }));
  }
};
