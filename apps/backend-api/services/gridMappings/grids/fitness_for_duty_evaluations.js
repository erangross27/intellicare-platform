module.exports = {
  title: '💼 Fitness for Duty Evaluations',
  columns: ['Date', 'Job Requirements', 'Medical Assessment', 'Determination', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Job Requirements': getValue(entry.jobRequirements || entry.duties),
      'Medical Assessment': getValue(entry.medicalAssessment || entry.assessment),
      Determination: getValue(entry.determination || entry.decision),
      Provider: getValue(entry.provider)
    }));
  }
};
