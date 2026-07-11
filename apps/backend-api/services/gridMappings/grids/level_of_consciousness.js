module.exports = {
  title: '🧠 Level of Consciousness',
  columns: ['Date/Time', 'GCS Score', 'Pupils', 'Response', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      'GCS Score': getValue(entry.gcsScore || entry.glasgowComaScale),
      Pupils: getValue(entry.pupils || entry.pupilReaction),
      Response: getValue(entry.response || entry.neurologicalResponse),
      Provider: getValue(entry.provider)
    }));
  }
};
