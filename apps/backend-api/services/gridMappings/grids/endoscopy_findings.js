module.exports = {
  title: '🔬 Endoscopy Findings',
  columns: ['Date', 'Type', 'Location', 'Findings', 'Gastroenterologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Type: getValue(entry.type || entry.procedureType),
      Location: getValue(entry.location || entry.site),
      Findings: getValue(entry.findings || entry.results),
      Gastroenterologist: getValue(entry.gastroenterologist || entry.provider)
    }));
  }
};
