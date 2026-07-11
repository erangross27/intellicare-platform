module.exports = {
  title: '🚨 Acute Kidney Injury',
  columns: ['Date', 'Stage', 'Cause', 'Treatment', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Stage: getValue(entry.stage || entry.akiStage),
      Cause: getValue(entry.cause || entry.etiology),
      Treatment: getValue(entry.treatment || entry.management),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
