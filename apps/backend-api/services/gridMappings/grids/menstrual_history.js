module.exports = {
  title: '🩸 Menstrual History',
  columns: ['Date', 'Cycle Length', 'Flow', 'Symptoms', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Cycle Length': getValue(entry.cycleLength || entry.cycle),
      Flow: getValue(entry.flow || entry.heaviness),
      Symptoms: getValue(entry.symptoms || entry.associatedSymptoms),
      Provider: getValue(entry.provider)
    }));
  }
};
