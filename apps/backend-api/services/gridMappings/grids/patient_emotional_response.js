module.exports = {
  title: '💭 Patient Emotional Response',
  columns: ['Date', 'Response', 'Triggers', 'Support Provided', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Response: getValue(entry.response || entry.emotion),
      Triggers: getValue(entry.triggers || entry.causes),
      'Support Provided': getValue(entry.supportProvided || entry.intervention),
      Provider: getValue(entry.provider)
    }));
  }
};
