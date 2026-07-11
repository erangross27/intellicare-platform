module.exports = {
  title: '🔪 Surgical Oncology',
  columns: ['Date', 'Procedure', 'Margins', 'Staging', 'Surgical Oncologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.operation),
      Margins: getValue(entry.margins || entry.resectionMargins),
      Staging: getValue(entry.staging || entry.pathologicStage),
      'Surgical Oncologist': getValue(entry.surgicalOncologist || entry.provider)
    }));
  }
};
