module.exports = {
  title: '🫁 Pleural Effusion',
  columns: ['Date', 'Side', 'Size', 'Intervention', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Side: getValue(entry.side || entry.location),
      Size: getValue(entry.size || entry.volume),
      Intervention: getValue(entry.intervention || entry.treatment),
      Provider: getValue(entry.provider)
    }));
  }
};
