module.exports = {
  title: '🎓 School Performance',
  columns: ['Date', 'Grade Level', 'Performance', 'Concerns', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Grade Level': getValue(entry.gradeLevel || entry.grade),
      Performance: getValue(entry.performance || entry.academicStatus),
      Concerns: getValue(entry.concerns || entry.issues),
      Provider: getValue(entry.provider)
    }));
  }
};
