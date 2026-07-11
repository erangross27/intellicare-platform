module.exports = {
  title: '💉 Harm Reduction Counseling',
  columns: ['Date', 'Topic', 'Strategies', 'Resources', 'Counselor'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Topic: getValue(entry.topic || entry.subject),
      Strategies: getValue(entry.strategies || entry.interventions),
      Resources: getValue(entry.resources || entry.referrals),
      Counselor: getValue(entry.counselor || entry.provider)
    }));
  }
};
