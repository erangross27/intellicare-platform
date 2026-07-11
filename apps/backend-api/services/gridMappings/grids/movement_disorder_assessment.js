module.exports = {
  title: '🧠 Movement Disorder Assessment',
  columns: ['Date', 'Disorder Type', 'Severity', 'Treatment', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Disorder Type': getValue(entry.disorderType || entry.diagnosis),
      Severity: getValue(entry.severity || entry.grade),
      Treatment: getValue(entry.treatment || entry.therapy),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
