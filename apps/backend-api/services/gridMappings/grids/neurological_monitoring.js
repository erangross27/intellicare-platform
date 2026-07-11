module.exports = {
  title: '🧠 Neurological Monitoring',
  columns: ['Date/Time', 'GCS', 'Pupils', 'Motor Response', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      GCS: getValue(entry.gcs || entry.glasgowComaScale),
      Pupils: getValue(entry.pupils || entry.pupilResponse),
      'Motor Response': getValue(entry.motorResponse || entry.movement),
      Provider: getValue(entry.provider)
    }));
  }
};
