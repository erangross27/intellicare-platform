module.exports = {
  title: '🦠 Respiratory Infections',
  columns: ['Date', 'Infection Type', 'Symptoms', 'Treatment', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Infection Type': getValue(entry.infectionType || entry.diagnosis),
      Symptoms: getValue(entry.symptoms || entry.presentation),
      Treatment: getValue(entry.treatment || entry.therapy),
      Provider: getValue(entry.provider)
    }));
  }
};
