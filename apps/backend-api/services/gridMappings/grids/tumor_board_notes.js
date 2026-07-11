module.exports = {
  title: '🎗️ Tumor Board Notes',
  columns: ['Date', 'Case Presentation', 'Discussion', 'Recommendation', 'Specialists'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Case Presentation': getValue(entry.casePresentation || entry.presentation),
      Discussion: getValue(entry.discussion || entry.notes),
      Recommendation: getValue(entry.recommendation || entry.decision),
      Specialists: getValue(entry.specialists || entry.attendees)
    }));
  }
};
