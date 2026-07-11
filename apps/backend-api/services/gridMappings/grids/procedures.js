module.exports = {
  title: '⚕️ Procedures',
  columns: ['Date', 'Procedure Name', 'Indication', 'Outcome', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Procedure Name': getValue(entry.procedureName || entry.name),
      Indication: getValue(entry.indication || entry.reason),
      Outcome: getValue(entry.outcome || entry.result),
      Provider: getValue(entry.provider)
    }));
  }
};
