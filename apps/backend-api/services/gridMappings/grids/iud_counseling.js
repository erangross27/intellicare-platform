module.exports = {
  title: '💊 IUD Counseling',
  columns: ['Date', 'IUD Type', 'Discussion Topics', 'Decision', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'IUD Type': getValue(entry.iudType || entry.type),
      'Discussion Topics': getValue(entry.discussionTopics || entry.topics),
      Decision: getValue(entry.decision || entry.patientDecision),
      Provider: getValue(entry.provider)
    }));
  }
};
