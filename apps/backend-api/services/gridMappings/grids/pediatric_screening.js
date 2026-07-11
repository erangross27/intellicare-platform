module.exports = {
  title: '👶 Pediatric Screening',
  columns: ['Date', 'Screening Type', 'Results', 'Follow-up', 'Pediatrician'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Screening Type': getValue(entry.screeningType || entry.type),
      Results: getValue(entry.results || entry.findings),
      'Follow-up': getValue(entry.followUp || entry.plan),
      Pediatrician: getValue(entry.pediatrician || entry.provider)
    }));
  }
};
