module.exports = {
  title: '🦴 Articular Cartilage',
  columns: ['Date', 'Joint', 'Lesion Size', 'Treatment', 'Orthopedic Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Joint: getValue(entry.joint || entry.location),
      'Lesion Size': getValue(entry.lesionSize || entry.defectSize),
      Treatment: getValue(entry.treatment || entry.procedure),
      'Orthopedic Surgeon': getValue(entry.orthopedicSurgeon || entry.provider)
    }));
  }
};
