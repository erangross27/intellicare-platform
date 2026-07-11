module.exports = {
  title: '🤰 Amniotic Fluid Assessment',
  columns: ['Date', 'AFI/MVP', 'Volume', 'Impression', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'AFI/MVP': getValue(entry.afi || entry.mvp || entry.measurement),
      Volume: getValue(entry.volume || entry.level),
      Impression: getValue(entry.impression || entry.assessment),
      Provider: getValue(entry.provider)
    }));
  }
};
