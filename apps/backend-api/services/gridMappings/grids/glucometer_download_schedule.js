module.exports = {
  title: '📱 Glucometer Download Schedule',
  columns: ['Date', 'Frequency', 'Next Download', 'Review Method', 'Endocrinologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Frequency: getValue(entry.frequency || entry.howOften),
      'Next Download': entry.nextDownload ? new Date(entry.nextDownload).toLocaleDateString() : '-',
      'Review Method': getValue(entry.reviewMethod || entry.method),
      Endocrinologist: getValue(entry.endocrinologist || entry.provider)
    }));
  }
};
