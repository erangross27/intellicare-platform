module.exports = {
  title: '💉 Basal Rate Adjustments',
  columns: ['Date', 'Time Block', 'Old Rate', 'New Rate', 'Reason'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Time Block': getValue(entry.timeBlock || entry.time),
      'Old Rate': getValue(entry.oldRate || entry.previousRate),
      'New Rate': getValue(entry.newRate || entry.rate),
      Reason: getValue(entry.reason || entry.rationale)
    }));
  }
};
