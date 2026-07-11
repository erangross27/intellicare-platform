module.exports = {
  title: '⚠️ Pulmonary Embolism Protocol',
  columns: ['Date/Time', 'Wells Score', 'D-Dimer', 'Imaging', 'Treatment'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      'Wells Score': getValue(entry.wellsScore || entry.score),
      'D-Dimer': getValue(entry.dDimer || entry.dDimerLevel),
      Imaging: getValue(entry.imaging || entry.ctpe),
      Treatment: getValue(entry.treatment || entry.anticoagulation)
    }));
  }
};
