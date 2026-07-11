module.exports = {
  title: '👁️ Retinal Examinations',
  columns: ['Date', 'Findings', 'Macula', 'Vessels', 'Ophthalmologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Findings: getValue(entry.findings || entry.results),
      Macula: getValue(entry.macula || entry.macularStatus),
      Vessels: getValue(entry.vessels || entry.retinalVessels),
      Ophthalmologist: getValue(entry.ophthalmologist || entry.provider)
    }));
  }
};
