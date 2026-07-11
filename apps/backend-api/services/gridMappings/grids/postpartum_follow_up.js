module.exports = {
  title: '🤱 Postpartum Follow-up',
  columns: ['Date', 'Weeks Post-Delivery', 'Concerns', 'Examination', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Weeks Post-Delivery': getValue(entry.weeksPostDelivery || entry.postpartumWeek),
      Concerns: getValue(entry.concerns || entry.complaints),
      Examination: getValue(entry.examination || entry.findings),
      Provider: getValue(entry.provider)
    }));
  }
};
