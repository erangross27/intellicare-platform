module.exports = {
  title: '💧 Dialysis Run Sheets',
  columns: ['Date', 'Duration', 'Pre Weight', 'Post Weight', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Duration: getValue(entry.duration || entry.treatmentTime),
      'Pre Weight': getValue(entry.preWeight || entry.preDialysisWeight),
      'Post Weight': getValue(entry.postWeight || entry.postDialysisWeight),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
