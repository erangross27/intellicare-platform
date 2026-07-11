module.exports = {
  title: '🔬 Clinical Trial Documents',
  columns: ['Date', 'Trial Name', 'Status', 'Documents', 'Principal Investigator'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Trial Name': getValue(entry.trialName || entry.study),
      Status: getValue(entry.status || entry.enrollmentStatus),
      Documents: getValue(entry.documents || entry.formsCompleted),
      'Principal Investigator': getValue(entry.principalInvestigator || entry.provider)
    }));
  }
};
