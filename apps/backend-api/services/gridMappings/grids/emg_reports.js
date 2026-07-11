module.exports = {
  title: '⚡ EMG Reports',
  columns: ['Date', 'Muscles Tested', 'Findings', 'Interpretation', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Muscles Tested': getValue(entry.musclesTested || entry.muscles),
      Findings: getValue(entry.findings || entry.results),
      Interpretation: getValue(entry.interpretation || entry.impression),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
