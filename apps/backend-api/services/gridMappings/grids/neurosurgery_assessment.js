module.exports = {
  title: '🧠 Neurosurgery Assessment',
  columns: ['Date', 'Condition', 'Surgical Indication', 'Plan', 'Neurosurgeon'],
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
      'Surgical Indication': getValue(entry.surgicalIndication || entry.indication),
      Plan: getValue(entry.plan || entry.treatment),
      Neurosurgeon: getValue(entry.neurosurgeon || entry.provider)
    }));
  }
};
