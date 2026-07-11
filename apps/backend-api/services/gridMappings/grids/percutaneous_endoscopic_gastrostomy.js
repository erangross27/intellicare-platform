module.exports = {
  title: '🔧 PEG Tube',
  columns: ['Date', 'Indication', 'Site Condition', 'Feeding Status', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Indication: getValue(entry.indication || entry.reason),
      'Site Condition': getValue(entry.siteCondition || entry.site),
      'Feeding Status': getValue(entry.feedingStatus || entry.feeds),
      Provider: getValue(entry.provider)
    }));
  }
};
