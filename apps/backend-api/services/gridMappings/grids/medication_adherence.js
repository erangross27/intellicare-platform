module.exports = {
  title: '💊 Medication Adherence',
  columns: ['Date', 'Medication', 'Adherence %', 'Barriers', 'Intervention'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Medication: getValue(entry.medication || entry.drug),
      adherence: getValue(entry.adherence || entry.adherenceRate),
      Barriers: getValue(entry.barriers || entry.challenges),
      Intervention: getValue(entry.intervention || entry.plan)
    }));
  }
};
