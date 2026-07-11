module.exports = {
  title: '🫃 IBD Consultation',
  columns: ['Date', 'Provider', 'Disease Activity', 'Plan', 'Follow-up'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Provider: getValue(entry.provider || entry.gastroenterologist),
      'Disease Activity': getValue(entry.diseaseActivity || entry.activity),
      Plan: getValue(entry.plan || entry.treatment),
      'Follow-up': entry.followUp ? new Date(entry.followUp).toLocaleDateString() : '-'
    }));
  }
};
