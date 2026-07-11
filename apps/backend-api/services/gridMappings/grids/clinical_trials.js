module.exports = {
  title: '🔬 Clinical Trials',
  columns: ['Date', 'Trial Name', 'Phase', 'Status', 'Coordinator'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Trial Name': getValue(entry.trialName || entry.studyName || entry.protocol),
      Phase: getValue(entry.phase),
      Status: getValue(entry.status || entry.enrollmentStatus),
      Coordinator: getValue(entry.coordinator || entry.provider)
    }));
  }
};
