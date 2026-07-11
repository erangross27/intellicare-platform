module.exports = {
  title: '🧠 Non-Motor Symptoms',
  columns: ['Date', 'Symptom', 'Severity', 'Treatment', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Symptom: getValue(entry.symptom || entry.type),
      Severity: getValue(entry.severity || entry.grade),
      Treatment: getValue(entry.treatment || entry.management),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
