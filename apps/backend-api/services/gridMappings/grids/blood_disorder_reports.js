module.exports = {
  title: '🩸 Blood Disorder Reports',
  columns: ['Date', 'Disorder', 'Lab Findings', 'Treatment', 'Hematologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Disorder: getValue(entry.disorder || entry.diagnosis),
      'Lab Findings': getValue(entry.labFindings || entry.labs),
      Treatment: getValue(entry.treatment || entry.therapy),
      Hematologist: getValue(entry.hematologist || entry.provider)
    }));
  }
};
