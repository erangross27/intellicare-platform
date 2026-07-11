module.exports = {
  title: '👶 Labor Assessment',
  columns: ['Date/Time', 'Contractions', 'Dilation', 'Station', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Contractions: getValue(entry.contractions || entry.contractionPattern),
      Dilation: getValue(entry.dilation || entry.cervicalDilation),
      Station: getValue(entry.station || entry.fetalStation),
      Provider: getValue(entry.provider)
    }));
  }
};
