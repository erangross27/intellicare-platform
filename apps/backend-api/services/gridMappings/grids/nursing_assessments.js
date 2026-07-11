module.exports = {
  title: '👩‍⚕️ Nursing Assessments',
  columns: ['Date', 'Vital Signs', 'Assessment', 'Plan', 'Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Vital Signs': getValue(entry.vitalSigns || entry.vitals),
      Assessment: getValue(entry.assessment || entry.findings),
      Plan: getValue(entry.plan || entry.interventions),
      Nurse: getValue(entry.nurse || entry.provider)
    }));
  }
};
