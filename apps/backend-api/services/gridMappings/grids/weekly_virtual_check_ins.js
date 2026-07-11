module.exports = {
  title: '💻 Weekly Virtual Check-Ins',
  columns: ['Date', 'Topics Discussed', 'Concerns', 'Action Items', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Topics Discussed': getValue(entry.topicsDiscussed || entry.topics),
      Concerns: getValue(entry.concerns || entry.issues),
      'Action Items': getValue(entry.actionItems || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
