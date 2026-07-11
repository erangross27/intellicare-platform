module.exports = {
  title: '🧠 Psychiatric Progress Notes',
  columns: ['Date', 'Mental Status', 'Symptoms', 'Treatment Plan', 'Psychiatrist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Mental Status': getValue(entry.mentalStatus || entry.status),
      Symptoms: getValue(entry.symptoms || entry.presentation),
      'Treatment Plan': getValue(entry.treatmentPlan || entry.plan),
      Psychiatrist: getValue(entry.psychiatrist || entry.provider)
    }));
  }
};
