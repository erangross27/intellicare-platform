module.exports = {
  title: '🚶 Functional Assessment',
  columns: ['Date', 'ADLs', 'IADLs', 'Mobility', 'Assessor'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      ADLs: getValue(entry.adls || entry.activitiesDailyLiving),
      IADLs: getValue(entry.iadls || entry.instrumentalADLs),
      Mobility: getValue(entry.mobility || entry.ambulationStatus),
      Assessor: getValue(entry.assessor || entry.provider)
    }));
  }
};
