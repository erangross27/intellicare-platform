module.exports = {
  title: 'Clinical Decision Support (AI)',
  columns: ['date', 'type', 'finding', 'severity', 'action', 'evidence'],
  headers: ['Date', 'Type', 'Finding', 'Severity', 'Action Required', 'Evidence'], // Display names
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

      // Risk Assessment - Individual risk factors only
      if (entry.riskAssessment) {
        if (entry.riskAssessment.riskFactors && Array.isArray(entry.riskAssessment.riskFactors)) {
          entry.riskAssessment.riskFactors.forEach(risk => {
            // Determine action based on risk severity
            let action = 'Monitor';
            const severity = (risk.severity || '').toLowerCase();
            if (severity === 'moderate') {
              action = 'Address modifiable factors';
            } else if (severity === 'high') {
              action = 'Urgent intervention required';
            }

            rows.push({
              date,
              'type': 'Risk Factor',
              'finding': getValue(risk.factor),
              'severity': getValue(risk.severity),
              'action': action,
              'evidence': getValue(risk.evidence)
            });
          });
        }
      }

      // Red Flags
      if (entry.redFlags && Array.isArray(entry.redFlags)) {
        entry.redFlags.forEach(flag => {
          rows.push({
            date, 'type': 'Red Flag', 'finding': getValue(flag.finding), 'severity': getValue(flag.urgency), 'action': getValue(flag.action), 'evidence': getValue(flag.timeframe)
          });
        });
      }

      // Drug Interactions
      if (entry.drugInteractions && Array.isArray(entry.drugInteractions)) {
        entry.drugInteractions.forEach(interaction => {
          rows.push({
            date, 'type': 'Drug Interaction', 'finding': getValue(interaction.medications ? interaction.medications.join(' + ') : '-'), 'severity': getValue(interaction.severity), 'action': getValue(interaction.recommendation), 'evidence': getValue(interaction.clinicalEffect || interaction.mechanism)
          });
        });
      }

      // Contraindications
      if (entry.contraindications && Array.isArray(entry.contraindications)) {
        entry.contraindications.forEach(contra => {
          rows.push({
            date, 'type': 'Contraindication', 'finding': getValue(contra.medication) + ' for ' + getValue(contra.condition), 'severity': getValue(contra.severity), 'action': 'Consider: ' + getValue(contra.alternative), 'evidence': '-'
          });
        });
      }
    });

    return rows;
  }
};
