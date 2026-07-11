module.exports = {
  title: '🦴 Orthopedic Follow-up Notes',
  columns: ['Date', 'Condition', 'Progress', 'Plan', 'Orthopedic Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Condition: getValue(entry.condition || entry.diagnosis),
      Progress: getValue(entry.progress || entry.status),
      Plan: getValue(entry.plan || entry.treatment),
      'Orthopedic Surgeon': getValue(entry.orthopedicSurgeon || entry.provider)
    }));
  }
};
