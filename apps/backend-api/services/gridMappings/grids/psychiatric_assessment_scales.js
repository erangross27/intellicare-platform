module.exports = {
  title: '📊 Psychiatric Assessment Scales',
  columns: ['Date', 'Scale Name', 'Score', 'Interpretation', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Scale Name': getValue(entry.scaleName || entry.scale),
      Score: getValue(entry.score || entry.value),
      Interpretation: getValue(entry.interpretation || entry.meaning),
      Provider: getValue(entry.provider)
    }));
  }
};
