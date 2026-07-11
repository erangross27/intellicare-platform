module.exports = {
  title: '🦠 Antibiogram Reports',
  columns: ['Date', 'Organism', 'Antibiotic', 'Sensitivity', 'Microbiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Organism: getValue(entry.organism || entry.bacteria),
      Antibiotic: getValue(entry.antibiotic || entry.drug),
      Sensitivity: getValue(entry.sensitivity || entry.susceptibility),
      Microbiologist: getValue(entry.microbiologist || entry.provider)
    }));
  }
};
