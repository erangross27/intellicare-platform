module.exports = {
  title: '💉 Continuous Infusions',
  columns: ['Date/Time', 'Medication', 'Rate', 'Concentration', 'Site'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Medication: getValue(entry.medication || entry.drug),
      Rate: getValue(entry.rate || entry.infusionRate),
      Concentration: getValue(entry.concentration || entry.dose),
      Site: getValue(entry.site || entry.ivSite)
    }));
  }
};
