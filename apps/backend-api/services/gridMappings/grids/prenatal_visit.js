module.exports = {
  title: '🤰 Obstetrics / Prenatal',
  columns: ['Date', 'Gestational Age', 'Weight', 'BP', 'Fetal Heart Rate'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.weeksGestation),
      Weight: getValue(entry.weight || entry.maternalWeight),
      BP: getValue(entry.bloodPressure || entry.bp),
      'Fetal Heart Rate': getValue(entry.fetalHeartRate || entry.fhr)
    }));
  }
};
