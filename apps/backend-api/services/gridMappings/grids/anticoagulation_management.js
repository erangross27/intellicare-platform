module.exports = {
  title: '💊 Anticoagulation Management',
  columns: ['Date', 'Medication', 'INR/Level', 'Dose', 'Next Check'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Medication: getValue(entry.medication || entry.anticoagulant),
      'INR/Level': getValue(entry.inr || entry.level || entry.labValue),
      Dose: getValue(entry.dose || entry.dosage),
      'Next Check': entry.nextCheck ? new Date(entry.nextCheck).toLocaleDateString() : '-'
    }));
  }
};
