module.exports = {
  title: '🔪 Operative Technique',
  columns: ['Date', 'Technique', 'Steps', 'Instruments', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Technique: getValue(entry.technique || entry.method),
      Steps: getValue(entry.steps || entry.procedureSteps),
      Instruments: getValue(entry.instruments || entry.equipment),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
