module.exports = {
  title: '🔬 Liver Biopsy',
  columns: ['Date', 'Indication', 'Findings', 'Fibrosis Stage', 'Provider'],
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
      Findings: getValue(entry.findings || entry.pathology),
      'Fibrosis Stage': getValue(entry.fibrosisStage || entry.stage),
      Provider: getValue(entry.provider)
    }));
  }
};
