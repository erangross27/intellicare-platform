module.exports = {
  title: '🏥 Referrals',
  columns: ['Date', 'Specialty', 'Provider', 'Reason', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      const strVal = String(val).trim();
      return strVal || defaultVal;
    };

    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : (entry.referralDate ? new Date(entry.referralDate).toLocaleDateString() : '-'),
      Specialty: getValue(entry.specialty || entry.department || entry.referredTo),
      Provider: getValue(entry.provider || entry.referringProvider || entry.referredToProvider),
      Reason: getValue(entry.reason || entry.indication || entry.purpose),
      Status: getValue(entry.status || entry.referralStatus, 'Pending')
    }));
  }
};
