module.exports = {
  title: '☠️ Toxicology Reports',
  columns: ['Date', 'Specimen', 'Substances Detected', 'Levels', 'Toxicologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Specimen: getValue(entry.specimen || entry.specimenType),
      'Substances Detected': getValue(entry.substancesDetected || entry.substances),
      Levels: getValue(entry.levels || entry.concentrations),
      Toxicologist: getValue(entry.toxicologist || entry.provider)
    }));
  }
};
