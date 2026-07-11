module.exports = {
  title: '🧬 Genetic Counseling',
  columns: ['Date', 'Indication', 'Pedigree Review', 'Recommendations', 'Counselor'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Indication: getValue(entry.indication || entry.reason),
      'Pedigree Review': getValue(entry.pedigreeReview || entry.familyHistory),
      Recommendations: getValue(entry.recommendations || entry.plan),
      Counselor: getValue(entry.counselor || entry.provider)
    }));
  }
};
