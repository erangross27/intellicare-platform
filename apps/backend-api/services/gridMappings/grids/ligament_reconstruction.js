module.exports = {
  title: '🦴 Ligament Reconstruction',
  columns: ['Date', 'Ligament', 'Graft Type', 'Technique', 'Orthopedic Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Ligament: getValue(entry.ligament || entry.structure),
      'Graft Type': getValue(entry.graftType || entry.graft),
      Technique: getValue(entry.technique || entry.method),
      'Orthopedic Surgeon': getValue(entry.orthopedicSurgeon || entry.provider)
    }));
  }
};
