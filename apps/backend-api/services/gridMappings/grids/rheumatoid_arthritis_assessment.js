module.exports = {
  title: '🦴 Rheumatoid Arthritis Assessment',
  columns: ['Date', 'Joint Count', 'DAS28 Score', 'Treatment', 'Rheumatologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Joint Count': getValue(entry.jointCount || entry.joints),
      'DAS28 Score': getValue(entry.das28Score || entry.das28),
      Treatment: getValue(entry.treatment || entry.therapy),
      Rheumatologist: getValue(entry.rheumatologist || entry.provider)
    }));
  }
};
