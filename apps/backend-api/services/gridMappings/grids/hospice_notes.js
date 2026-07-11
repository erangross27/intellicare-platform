module.exports = {
  title: '🕊️ Hospice Notes',
  columns: ['Date', 'Symptom Management', 'Family Support', 'Comfort Measures', 'Hospice Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Symptom Management': getValue(entry.symptomManagement || entry.symptoms),
      'Family Support': getValue(entry.familySupport || entry.family),
      'Comfort Measures': getValue(entry.comfortMeasures || entry.palliativeCare),
      'Hospice Nurse': getValue(entry.hospiceNurse || entry.provider)
    }));
  }
};
