module.exports = {
  title: '👶 Developmental Assessments',
  columns: ['Date', 'Age at Assessment', 'Milestones', 'Concerns', 'Pediatrician'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateURL() : '-',
      'Age at Assessment': getValue(entry.ageAtAssessment || entry.age),
      Milestones: getValue(entry.milestones || entry.achievements),
      Concerns: getValue(entry.concerns || entry.issues),
      Pediatrician: getValue(entry.pediatrician || entry.provider)
    }));
  }
};
