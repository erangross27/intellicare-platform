module.exports = {
  title: '🔬 Colonoscopy Reports',
  columns: ['Date', 'Indication', 'Findings', 'Biopsies', 'Gastroenterologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Indication: getValue(entry.indication || entry.reason),
      Findings: getValue(entry.findings || entry.results),
      Biopsies: getValue(entry.biopsies || entry.samplesCollected),
      Gastroenterologist: getValue(entry.gastroenterologist || entry.provider)
    }));
  }
};
