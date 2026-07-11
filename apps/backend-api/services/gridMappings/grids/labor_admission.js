module.exports = {
  title: '🤰 Labor Admission',
  columns: ['Date/Time', 'Gestational Age', 'Dilation', 'Effacement', 'Station'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.ga),
      Dilation: getValue(entry.dilation || entry.cervicalDilation),
      Effacement: getValue(entry.effacement || entry.cervicalEffacement),
      Station: getValue(entry.station || entry.fetalStation)
    }));
  }
};
