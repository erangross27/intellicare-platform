module.exports = {
  title: '🚨 Immediate Interventions',
  columns: ['Date/Time', 'Issue', 'Intervention', 'Response', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const rows = [];

    categoryData.forEach(entry => {
      const dateTime = entry.date ? new Date(entry.date).toLocaleString() : '-';

      // Check if this has the nested array structure (anaphylaxisPrevention, asthmaOptimization, etc.)
      const hasArrayStructure = entry.anaphylaxisPrevention || entry.asthmaOptimization ||
                                entry.immediateInterventions || entry.interventions;

      if (hasArrayStructure) {
        // Handle anaphylaxis prevention interventions
        if (entry.anaphylaxisPrevention && Array.isArray(entry.anaphylaxisPrevention)) {
          entry.anaphylaxisPrevention.forEach(intervention => {
            rows.push({
              'Date/Time': dateTime,
              'Issue': 'Anaphylaxis Risk',
              'Intervention': getValue(intervention),
              'Response': '-',
              'Provider': getValue(entry.provider)
            });
          });
        }

        // Handle asthma optimization interventions
        if (entry.asthmaOptimization && Array.isArray(entry.asthmaOptimization)) {
          entry.asthmaOptimization.forEach(intervention => {
            rows.push({
              'Date/Time': dateTime,
              'Issue': 'Severe Asthma',
              'Intervention': getValue(intervention),
              'Response': '-',
              'Provider': getValue(entry.provider)
            });
          });
        }

        // Handle generic immediate interventions array
        if (entry.immediateInterventions && Array.isArray(entry.immediateInterventions)) {
          entry.immediateInterventions.forEach(intervention => {
            rows.push({
              'Date/Time': dateTime,
              'Issue': getValue(intervention.issue || intervention.problem, 'Immediate Intervention'),
              'Intervention': getValue(intervention.intervention || intervention.action || intervention),
              'Response': getValue(intervention.response || intervention.outcome),
              'Provider': getValue(intervention.provider || entry.provider)
            });
          });
        }

        // Handle generic interventions array
        if (entry.interventions && Array.isArray(entry.interventions)) {
          entry.interventions.forEach(intervention => {
            rows.push({
              'Date/Time': dateTime,
              'Issue': getValue(intervention.issue || intervention.problem, 'Intervention'),
              'Intervention': getValue(intervention.intervention || intervention.action || intervention),
              'Response': getValue(intervention.response || intervention.outcome),
              'Provider': getValue(intervention.provider || entry.provider)
            });
          });
        }
      } else {
        // Handle flat structure (original format)
        rows.push({
          'Date/Time': dateTime,
          'Issue': getValue(entry.issue || entry.problem),
          'Intervention': getValue(entry.intervention || entry.action),
          'Response': getValue(entry.response || entry.outcome),
          'Provider': getValue(entry.provider)
        });
      }
    });

    return rows;
  }
};
