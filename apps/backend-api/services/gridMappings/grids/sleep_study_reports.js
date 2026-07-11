module.exports = {
  title: '😴 Sleep Study Reports',
  columns: ['Date', 'AHI', 'Sleep Efficiency', 'Diagnosis', 'Sleep Specialist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      AHI: getValue(entry.ahi || entry.apneaHypopneaIndex),
      'Sleep Efficiency': getValue(entry.sleepEfficiency || entry.efficiency),
      Diagnosis: getValue(entry.diagnosis || entry.interpretation),
      'Sleep Specialist': getValue(entry.sleepSpecialist || entry.provider)
    }));
  }
};
