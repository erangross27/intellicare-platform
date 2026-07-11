module.exports = {
  title: '🔬 Microbiology Cultures',
  columns: ['Date', 'Specimen', 'Organism', 'Sensitivity', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Specimen: getValue(entry.specimen || entry.source),
      Organism: getValue(entry.organism || entry.pathogen),
      Sensitivity: getValue(entry.sensitivity || entry.antibioticSensitivity),
      Provider: getValue(entry.provider)
    }));
  }
};
