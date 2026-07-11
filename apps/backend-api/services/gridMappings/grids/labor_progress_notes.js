module.exports = {
  title: '📊 Labor Progress',
  columns: ['Date/Time', 'Dilation', 'Station', 'Contractions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Dilation: getValue(entry.dilation || entry.cervicalDilation),
      Station: getValue(entry.station || entry.fetalStation),
      Contractions: getValue(entry.contractions || entry.contractionFrequency),
      Provider: getValue(entry.provider)
    }));
  }
};
