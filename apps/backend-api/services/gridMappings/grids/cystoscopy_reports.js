module.exports = {
  title: '🔬 Cystoscopy Reports',
  columns: ['Date', 'Indication', 'Findings', 'Biopsies', 'Urologist'],
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
      Urologist: getValue(entry.urologist || entry.provider)
    }));
  }
};
