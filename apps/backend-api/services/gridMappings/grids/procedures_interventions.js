module.exports = {
  title: '⚕️ Procedures & Interventions',
  columns: ['Date', 'Procedure', 'Indication', 'Outcome', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.procedureName),
      Indication: getValue(entry.indication || entry.reason),
      Outcome: getValue(entry.outcome || entry.result),
      Provider: getValue(entry.provider)
    }));
  }
};
