module.exports = {
  title: '📊 Performance Status',
  columns: ['Date', 'ECOG', 'Karnofsky', 'Activities', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      ECOG: getValue(entry.ecog || entry.ecogScore),
      Karnofsky: getValue(entry.karnofsky || entry.karnofskyScore),
      Activities: getValue(entry.activities || entry.functionalStatus),
      Provider: getValue(entry.provider)
    }));
  }
};
