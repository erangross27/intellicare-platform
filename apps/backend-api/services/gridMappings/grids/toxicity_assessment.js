module.exports = {
  title: '⚠️ Toxicity Assessment',
  columns: ['Date', 'Toxicity', 'Grade', 'Management', 'Oncologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Toxicity: getValue(entry.toxicity || entry.adverseEvent),
      Grade: getValue(entry.grade || entry.ctcaeGrade),
      Management: getValue(entry.management || entry.intervention),
      Oncologist: getValue(entry.oncologist || entry.provider)
    }));
  }
};
