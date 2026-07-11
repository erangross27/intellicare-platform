module.exports = {
  title: '👶 APGAR Scores',
  columns: ['Date', '1 Minute', '5 Minutes', '10 Minutes', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      oneMinute: getValue(entry.oneMinute || entry.apgar1),
      fiveMinutes: getValue(entry.fiveMinutes || entry.apgar5),
      tenMinutes: getValue(entry.tenMinutes || entry.apgar10),
      Provider: getValue(entry.provider)
    }));
  }
};
