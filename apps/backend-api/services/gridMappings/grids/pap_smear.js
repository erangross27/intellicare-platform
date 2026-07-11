module.exports = {
  title: '🔬 Pap Smear',
  columns: ['Date', 'Result', 'HPV Status', 'Follow-up', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Result: getValue(entry.result || entry.cytology),
      'HPV Status': getValue(entry.hpvStatus || entry.hpv),
      'Follow-up': getValue(entry.followUp || entry.recommendation),
      Provider: getValue(entry.provider)
    }));
  }
};
