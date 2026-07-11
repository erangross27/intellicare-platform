module.exports = {
  title: '🫁 Asthma Management Notes',
  columns: ['Date', 'Peak Flow', 'Symptoms', 'Treatment', 'Pulmonologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Peak Flow': getValue(entry.peakFlow || entry.pef),
      Symptoms: getValue(entry.symptoms || entry.presentation),
      Treatment: getValue(entry.treatment || entry.medications),
      Pulmonologist: getValue(entry.pulmonologist || entry.provider)
    }));
  }
};
