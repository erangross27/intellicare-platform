module.exports = {
  title: '🤰 Gestational Diabetes',
  columns: ['Date', 'Blood Glucose', 'A1C', 'Management', 'Next Visit'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Blood Glucose': getValue(entry.bloodGlucose || entry.glucose),
      A1C: getValue(entry.a1c || entry.hba1c),
      Management: getValue(entry.management || entry.plan),
      'Next Visit': entry.nextVisit ? new Date(entry.nextVisit).toLocaleDateString() : '-'
    }));
  }
};
