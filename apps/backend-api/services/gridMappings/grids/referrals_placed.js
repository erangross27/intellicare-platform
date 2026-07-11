module.exports = {
  title: '🔗 Referrals Placed',
  columns: ['Date', 'Specialty', 'Reason', 'Status', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Specialty: getValue(entry.specialty || entry.referralTo),
      Reason: getValue(entry.reason || entry.indication),
      Status: getValue(entry.status || entry.state),
      Provider: getValue(entry.provider)
    }));
  }
};
