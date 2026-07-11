module.exports = {
  title: '💉 IV Infusions',
  columns: ['Date/Time', 'Solution', 'Rate', 'Site', 'Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.dateTime || entry.date ? new Date(entry.dateTime || entry.date).toLocaleString() : '-',
      Solution: getValue(entry.solution || entry.fluid),
      Rate: getValue(entry.rate || entry.infusionRate),
      Site: getValue(entry.site || entry.ivSite),
      Nurse: getValue(entry.nurse || entry.provider)
    }));
  }
};
