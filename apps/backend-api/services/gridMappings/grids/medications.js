const SecureDataAccess = require('../../secureDataAccess');

module.exports = {
  title: '💊 Medications',
  columns: ['Date', 'Medication', 'Dosage', 'Frequency', 'Prescribed By', 'Safety Warnings'],
  mapper: async (categoryData, context) => {
    // Handle both single entry and array of entries
    const entries = Array.isArray(categoryData) ? categoryData : [categoryData];

    const results = [];

    for (const entry of entries) {
      const medicationName = entry.name || entry.medicationName || entry.medication || 'Unknown';

      // Query safety alerts for this medication
      let safetyWarning = '✅ No safety concerns';

      try {
        const alerts = await SecureDataAccess.query(
          'medication_safety_alerts',
          {
            patientId: entry.patientId,
            medicationName: medicationName,
            resolved: false
          },
          { limit: 10 },
          context
        );

        if (alerts && alerts.length > 0) {
          // Group by severity
          const errors = alerts.filter(a => a.alertType === 'ERROR');
          const warnings = alerts.filter(a => a.alertType === 'WARNING');

          const messages = [];

          // Add critical errors first
          errors.forEach(alert => {
            if (alert.errors && alert.errors.length > 0) {
              alert.errors.forEach(err => {
                if (err.type === 'DIRECT_ALLERGY') {
                  messages.push(`⛔ DIRECT ALLERGY - DO NOT ADMINISTER`);
                } else if (err.type === 'MAJOR_DRUG_INTERACTION') {
                  const otherDrug = err.message.match(/with ([^:]+):/)?.[1] || 'other medication';
                  messages.push(`⛔ Major interaction with ${otherDrug}`);
                } else if (err.type === 'HIGH_CROSS_SENSITIVITY') {
                  messages.push(`⛔ High allergy cross-sensitivity risk`);
                }
              });
            }
          });

          // Add warnings
          warnings.forEach(alert => {
            if (alert.warnings && alert.warnings.length > 0) {
              alert.warnings.forEach(warn => {
                if (warn.type === 'MODERATE_DRUG_INTERACTION') {
                  const otherDrug = warn.message.match(/with ([^:]+):/)?.[1] || 'other medication';
                  messages.push(`⚠️ Moderate interaction with ${otherDrug}`);
                } else if (warn.type === 'MODERATE_CROSS_SENSITIVITY') {
                  messages.push(`⚠️ Moderate allergy cross-sensitivity`);
                }
              });
            }
          });

          if (messages.length > 0) {
            safetyWarning = messages.join('\n');
          }
        }
      } catch (error) {
        console.error('Error querying medication safety alerts:', error);
        safetyWarning = '⚠️ Unable to verify safety';
      }

      // Combine dosage and route for better clarity
      let dosageDisplay = entry.dosage || entry.dose || '';

      // If no dosage but we have instructions, use that context
      if ((!dosageDisplay || dosageDisplay === '' || dosageDisplay === '-') && entry.instructions) {
        dosageDisplay = entry.instructions;
      }

      // If still empty, default to '-'
      if (!dosageDisplay || dosageDisplay === '') {
        dosageDisplay = '-';
      }

      // Add route to dosage if present
      if (entry.route && entry.route !== '' && entry.route !== '-') {
        if (dosageDisplay === '-') {
          dosageDisplay = entry.route;
        } else if (!dosageDisplay.includes(entry.route)) {
          // Only add route if it's not already mentioned in the dosage/instructions
          dosageDisplay = `${dosageDisplay} (${entry.route})`;
        }
      }

      results.push({
        'Date': entry.startDate ? new Date(entry.startDate).toLocaleDateString() : (entry.date ? new Date(entry.date).toLocaleDateString() : (entry.prescribedDate ? new Date(entry.prescribedDate).toLocaleDateString() : '-')),
        'Medication': medicationName,
        'Dosage': dosageDisplay,
        'Frequency': entry.frequency || 'daily',
        'Prescribed By': entry.prescribedBy || entry.provider || 'Pharmacy',
        'Safety Warnings': safetyWarning
      });
    }

    return results.length === 1 && !Array.isArray(categoryData) ? results[0] : results;
  }
};
