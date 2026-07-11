module.exports = {
  title: '😣 Pain Assessment',
  columns: ['Date/Time', 'Pain Score', 'Location', 'Quality', 'Intervention'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      'Pain Score': getValue(entry.painScore || entry.score),
      Location: getValue(entry.location || entry.site),
      Quality: getValue(entry.quality || entry.description),
      Intervention: getValue(entry.intervention || entry.treatment)
    }));
  }
};
