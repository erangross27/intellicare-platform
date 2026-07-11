module.exports = {
  title: '🔬 Dermatology Procedure Notes',
  columns: ['Date', 'Procedure', 'Site', 'Findings', 'Dermatologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.procedureType),
      Site: getValue(entry.site || entry.location),
      Findings: getValue(entry.findings || entry.results),
      Dermatologist: getValue(entry.dermatologist || entry.provider)
    }));
  }
};
