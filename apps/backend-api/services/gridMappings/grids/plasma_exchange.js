module.exports = {
  title: '🩸 Plasma Exchange',
  columns: ['Date', 'Volume Exchanged', 'Indication', 'Complications', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Volume Exchanged': getValue(entry.volumeExchanged || entry.volume),
      Indication: getValue(entry.indication || entry.reason),
      Complications: getValue(entry.complications || entry.issues),
      Provider: getValue(entry.provider)
    }));
  }
};
