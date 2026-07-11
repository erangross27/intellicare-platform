module.exports = {
  title: '💉 Interventional Radiology Notes',
  columns: ['Date', 'Procedure', 'Indication', 'Result', 'Interventional Radiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.procedureType),
      Indication: getValue(entry.indication || entry.reason),
      Result: getValue(entry.result || entry.outcome),
      'Interventional Radiologist': getValue(entry.interventionalRadiologist || entry.provider)
    }));
  }
};
