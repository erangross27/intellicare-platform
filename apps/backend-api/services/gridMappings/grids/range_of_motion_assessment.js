module.exports = {
  title: '🔄 Range of Motion',
  columns: ['Date', 'Joint', 'Flexion', 'Extension', 'Provider'],
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
      Flexion: getValue(entry.flexion || entry.flexionDegrees),
      Extension: getValue(entry.extension || entry.extensionDegrees),
      Provider: getValue(entry.provider)
    }));
  }
};
