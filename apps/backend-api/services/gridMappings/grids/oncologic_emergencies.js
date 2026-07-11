module.exports = {
  title: '🚨 Oncologic Emergencies',
  columns: ['Date', 'Emergency Type', 'Management', 'Outcome', 'Oncologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Emergency Type': getValue(entry.emergencyType || entry.type),
      Management: getValue(entry.management || entry.treatment),
      Outcome: getValue(entry.outcome || entry.result),
      Oncologist: getValue(entry.oncologist || entry.provider)
    }));
  }
};
