module.exports = {
  title: '🧠 Psychosocial Oncology',
  columns: ['Date', 'Distress Level', 'Concerns', 'Interventions', 'Psycho-Oncologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Distress Level': getValue(entry.distressLevel || entry.distress),
      Concerns: getValue(entry.concerns || entry.issues),
      Interventions: getValue(entry.interventions || entry.support),
      'Psycho-Oncologist': getValue(entry.psychoOncologist || entry.provider)
    }));
  }
};
