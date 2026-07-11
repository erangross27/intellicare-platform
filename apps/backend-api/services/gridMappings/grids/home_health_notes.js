module.exports = {
  title: '🏠 Home Health Notes',
  columns: ['Date', 'Services Provided', 'Patient Status', 'Plan', 'Home Health Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Services Provided': getValue(entry.servicesProvided || entry.services),
      'Patient Status': getValue(entry.patientStatus || entry.status),
      Plan: getValue(entry.plan || entry.carePlan),
      'Home Health Nurse': getValue(entry.homeHealthNurse || entry.provider)
    }));
  }
};
