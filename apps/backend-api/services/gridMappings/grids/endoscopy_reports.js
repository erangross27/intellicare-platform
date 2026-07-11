module.exports = {
  title: '🔬 Endoscopy Reports',
  columns: ['Date', 'Type', 'Findings', 'Biopsies', 'Gastroenterologist'],
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
      Findings: getValue(entry.findings || entry.results),
      Biopsies: getValue(entry.biopsies || entry.samplesCollected),
      Gastroenterologist: getValue(entry.gastroenterologist || entry.provider)
    }));
  }
};
