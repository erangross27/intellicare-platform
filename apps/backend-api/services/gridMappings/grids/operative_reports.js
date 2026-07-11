module.exports = {
  title: '🔪 Surgical History',
  columns: ['Date', 'Procedure', 'Surgeon', 'Indication', 'Outcome'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : (entry.surgeryDate ? new Date(entry.surgeryDate).toLocaleDateString() : '-'),
      Procedure: getValue(entry.procedure || entry.operation || entry.surgeryType),
      Surgeon: getValue(entry.surgeon || entry.provider || entry.operatingSurgeon),
      Indication: getValue(entry.indication || entry.reason),
      Outcome: getValue(entry.outcome || entry.result || entry.status)
    }));
  }
};
