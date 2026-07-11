module.exports = {
  title: '🦴 Rheumatology',
  columns: ['Date', 'Diagnosis', 'Disease Activity', 'Treatment', 'Rheumatologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Diagnosis: getValue(entry.diagnosis || entry.condition),
      'Disease Activity': getValue(entry.diseaseActivity || entry.activityScore),
      Treatment: getValue(entry.treatment || entry.plan),
      Rheumatologist: getValue(entry.provider || entry.rheumatologist)
    }));
  }
};
