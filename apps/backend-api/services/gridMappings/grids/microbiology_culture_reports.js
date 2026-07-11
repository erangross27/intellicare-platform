module.exports = {
  title: '🦠 Microbiology Culture Reports',
  columns: ['Date', 'Specimen', 'Organism', 'Sensitivities', 'Microbiologist'],
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
      Organism: getValue(entry.organism || entry.bacteria),
      Sensitivities: getValue(entry.sensitivities || entry.susceptibility),
      Microbiologist: getValue(entry.microbiologist || entry.provider)
    }));
  }
};
