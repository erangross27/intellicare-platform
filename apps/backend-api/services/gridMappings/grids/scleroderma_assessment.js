module.exports = {
  title: '🦴 Scleroderma Assessment',
  columns: ['Date', 'Skin Score', 'Organ Involvement', 'Treatment', 'Rheumatologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Skin Score': getValue(entry.skinScore || entry.rodnanScore),
      'Organ Involvement': getValue(entry.organInvolvement || entry.organs),
      Treatment: getValue(entry.treatment || entry.therapy),
      Rheumatologist: getValue(entry.rheumatologist || entry.provider)
    }));
  }
};
