module.exports = {
  title: '🤰 Pregnancy Course',
  columns: ['Date', 'Gestational Age', 'Status', 'Complications', 'Obstetrician'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.ga),
      Status: getValue(entry.status || entry.condition),
      Complications: getValue(entry.complications || entry.issues),
      Obstetrician: getValue(entry.obstetrician || entry.provider)
    }));
  }
};
