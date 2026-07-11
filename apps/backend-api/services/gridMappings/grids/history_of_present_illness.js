module.exports = {
  title: '📋 History of Present Illness',
  columns: ['Date', 'Chief Complaint', 'Onset', 'Course', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Chief Complaint': getValue(entry.chiefComplaint || entry.complaint),
      Onset: getValue(entry.onset || entry.startDate),
      Course: getValue(entry.course || entry.progression),
      Provider: getValue(entry.provider)
    }));
  }
};
