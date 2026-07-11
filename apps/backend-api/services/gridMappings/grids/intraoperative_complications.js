module.exports = {
  title: '⚠️ Intraoperative Complications',
  columns: ['Date', 'Procedure', 'Complication', 'Management', 'Outcome'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.surgicalProcedure),
      Complication: getValue(entry.complication || entry.complicationType),
      Management: getValue(entry.management || entry.intervention),
      Outcome: getValue(entry.outcome || entry.resolution)
    }));
  }
};
