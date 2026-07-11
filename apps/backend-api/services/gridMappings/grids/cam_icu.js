module.exports = {
  title: '🧠 CAM-ICU Assessment',
  columns: ['Date/Time', 'Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Delirium'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      'Feature 1': getValue(entry.feature1 || entry.acuteOnset),
      'Feature 2': getValue(entry.feature2 || entry.inattention),
      'Feature 3': getValue(entry.feature3 || entry.alteredConsciousness),
      'Feature 4': getValue(entry.feature4 || entry.disorganizedThinking),
      Delirium: getValue(entry.delirium || entry.result || entry.positive, 'Negative')
    }));
  }
};
