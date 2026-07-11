module.exports = {
  title: '💊 Treatment Courses',
  columns: ['Date', 'Treatment Type', 'Medication/Therapy', 'Dose & Frequency', 'Duration'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const rows = [];

    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';

      // IV Medications
      if (entry.ivMedications && Array.isArray(entry.ivMedications) && entry.ivMedications.length > 0) {
        entry.ivMedications.forEach(med => {
          rows.push({
            Date: date,
            'Treatment Type': 'IV Medication',
            'Medication/Therapy': getValue(med.medication),
            'Dose & Frequency': `${getValue(med.dose)} ${getValue(med.frequency)}`,
            Duration: getValue(med.duration)
          });
        });
      }

      // Oral Medications
      if (entry.oralMedications && Array.isArray(entry.oralMedications) && entry.oralMedications.length > 0) {
        entry.oralMedications.forEach(med => {
          rows.push({
            Date: date,
            'Treatment Type': 'Oral Medication',
            'Medication/Therapy': getValue(med.medication),
            'Dose & Frequency': `${getValue(med.dose)} ${getValue(med.frequency)}`,
            Duration: getValue(med.duration)
          });
        });
      }

      // Oxygen Therapy
      if (entry.oxygenTherapy && typeof entry.oxygenTherapy === 'object') {
        const method = getValue(entry.oxygenTherapy.method);
        const target = getValue(entry.oxygenTherapy.targetSaturation);
        rows.push({
          Date: date,
          'Treatment Type': 'Oxygen Therapy',
          'Medication/Therapy': method,
          'Dose & Frequency': target,
          Duration: getValue(entry.oxygenTherapy.duration)
        });
      }

      // Nebulizers
      if (entry.nebulizers && Array.isArray(entry.nebulizers) && entry.nebulizers.length > 0) {
        entry.nebulizers.forEach(neb => {
          rows.push({
            Date: date,
            'Treatment Type': 'Nebulizer',
            'Medication/Therapy': getValue(neb.medication),
            'Dose & Frequency': getValue(neb.frequency),
            Duration: getValue(neb.duration)
          });
        });
      }
    });

    return rows;
  }
};
