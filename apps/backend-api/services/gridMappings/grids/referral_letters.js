module.exports = {
  title: '📨 Referral Letters',
  columns: ['Date', 'Specialty', 'Reason', 'Status', 'Referring Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Specialty: getValue(entry.specialty || entry.referredTo),
      Reason: getValue(entry.reason || entry.indication),
      Status: getValue(entry.status || entry.referralStatus),
      'Referring Provider': getValue(entry.referringProvider || entry.provider)
    }));
  }
};
