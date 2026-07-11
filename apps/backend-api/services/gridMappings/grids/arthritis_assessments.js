module.exports = {
  title: '🦴 Arthritis Assessments',
  columns: ['Date', 'Joints Affected', 'Pain Level', 'Treatment', 'Rheumatologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Joints Affected': getValue(entry.jointsAffected || entry.joints),
      'Pain Level': getValue(entry.painLevel || entry.pain),
      Treatment: getValue(entry.treatment || entry.medications),
      Rheumatologist: getValue(entry.rheumatologist || entry.provider)
    }));
  }
};
