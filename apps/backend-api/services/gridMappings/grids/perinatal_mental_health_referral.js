module.exports = {
  title: '🧠 Perinatal Mental Health Referral',
  columns: ['Date', 'Screening Score', 'Concern', 'Referral', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Screening Score': getValue(entry.screeningScore || entry.epdsScore),
      Concern: getValue(entry.concern || entry.issue),
      Referral: getValue(entry.referral || entry.referredTo),
      Provider: getValue(entry.provider)
    }));
  }
};
