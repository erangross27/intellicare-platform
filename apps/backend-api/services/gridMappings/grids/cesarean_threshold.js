module.exports = {
  title: '🤰 Cesarean Threshold',
  columns: ['Date', 'Indication', 'Threshold Met', 'Decision', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Indication: getValue(entry.indication || entry.reason),
      'Threshold Met': getValue(entry.thresholdMet || entry.met, 'No'),
      Decision: getValue(entry.decision || entry.plan),
      Provider: getValue(entry.provider || entry.obstetrician)
    }));
  }
};
