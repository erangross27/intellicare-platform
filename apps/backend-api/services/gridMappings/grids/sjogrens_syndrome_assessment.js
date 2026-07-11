module.exports = {
  title: '💧 Sjögren\'s Syndrome Assessment',
  columns: ['Date', 'Symptoms', 'Antibodies', 'Treatment', 'Rheumatologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Symptoms: getValue(entry.symptoms || entry.presentation),
      Antibodies: getValue(entry.antibodies || entry.labs),
      Treatment: getValue(entry.treatment || entry.therapy),
      Rheumatologist: getValue(entry.rheumatologist || entry.provider)
    }));
  }
};
