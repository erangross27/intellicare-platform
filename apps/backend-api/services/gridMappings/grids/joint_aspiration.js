module.exports = {
  title: '💉 Joint Aspiration',
  columns: ['Date', 'Joint', 'Volume', 'Analysis', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Joint: getValue(entry.joint || entry.location),
      Volume: getValue(entry.volume || entry.amountAspirared),
      Analysis: getValue(entry.analysis || entry.results),
      Provider: getValue(entry.provider)
    }));
  }
};
