module.exports = {
  title: 'Quality Metrics & Gaps in Care (AI)',
  columns: ['date', 'category', 'item', 'status', 'gaps', 'recommendations', 'priority'],
  headers: ['Date', 'Category', 'Item', 'Status/Compliance', 'Gaps/Issues', 'Recommendations', 'Priority'],
  columnWidths: ['100px', '130px', '180px', '220px', '140px', '400px', '80px'], // Balanced: Date-Category-Item-Status-Gaps-Recommendations-Priority
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const formatStatus = (compliance) => {
      if (compliance === 'Compliant') return '✅ Compliant';
      if (compliance === 'Non-compliant') return '❌ Non-compliant';
      if (compliance === 'Partial') return '⚠️ Partial';
      if (compliance === 'Gap Identified') return '🔍 Gap Identified';
      if (compliance === 'Missed') return '⚠️ Missed';
      return compliance;
    };

    const capitalizeFirst = (text) => {
      if (!text) return text;
      const trimmed = String(text).trim();
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    };

    const rows = [];

    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';

      // Guideline Adherence
      if (entry.complianceTracking && entry.complianceTracking.guidelineAdherence) {
        if (Array.isArray(entry.complianceTracking.guidelineAdherence)) {
          entry.complianceTracking.guidelineAdherence.forEach(guideline => {
            const recommendations = guideline.recommendations;
            const gaps = guideline.gaps;

            // If has multiple recommendations, create separate rows for each
            if (recommendations && Array.isArray(recommendations) && recommendations.length > 0) {
              // Format gaps once - reuse for all rows
              let gapsDisplay = '-';
              if (gaps && Array.isArray(gaps) && gaps.length > 0) {
                gapsDisplay = gaps.join('; ');
              } else if (guideline.compliance === 'Compliant') {
                gapsDisplay = 'None';
              }

              const statusDisplay = formatStatus(getValue(guideline.compliance));
              const priorityDisplay = getValue(guideline.compliance === 'Non-compliant' ? 'High' :
                guideline.compliance === 'Partial' ? 'Medium' : 'Low');

              recommendations.forEach((rec, index) => {
                rows.push({
                  date: date,  // Show on ALL rows
                  'category': 'Guideline Adherence',  // Show on ALL rows
                  'item': getValue(guideline.guideline),  // Show on ALL rows
                  'status': statusDisplay,  // Show on ALL rows
                  'gaps': gapsDisplay,       // Show on ALL rows
                  'recommendations': capitalizeFirst(rec),
                  'priority': priorityDisplay  // Show on ALL rows
                });
              });
            } else {
              // Single row if no recommendations array
              rows.push({
                date,
                'category': 'Guideline Adherence',
                'item': getValue(guideline.guideline),
                'status': formatStatus(getValue(guideline.compliance)),
                'gaps': gaps && Array.isArray(gaps) ? gaps.join('; ') : '-',
                'recommendations': '-',
                'priority': getValue(guideline.compliance === 'Non-compliant' ? 'High' :
                  guideline.compliance === 'Partial' ? 'Medium' : 'Low')
              });
            }
          });
        }
      }

      // Preventive Care Missed
      if (entry.complianceTracking && entry.complianceTracking.preventiveCareMissed) {
        if (Array.isArray(entry.complianceTracking.preventiveCareMissed)) {
          entry.complianceTracking.preventiveCareMissed.forEach(item => {
            rows.push({
              date,
              'category': 'Preventive Care',
              'item': getValue(item),
              'status': formatStatus('Missed'),
              'gaps': 'Not completed',
              'recommendations': 'Schedule ' + getValue(item),
              'priority': 'High'
            });
          });
        }
      }

      // Gaps in Care
      if (entry.gapsInCare && Array.isArray(entry.gapsInCare)) {
        entry.gapsInCare.forEach(gap => {
          rows.push({
            date,
            'category': getValue(gap.category),
            'item': getValue(gap.gap),
            'status': formatStatus('Gap Identified'),
            'gaps': getValue(gap.dueDate ? 'Due: ' + gap.dueDate : '-'),
            'recommendations': getValue(gap.action),
            'priority': getValue(gap.priority)
          });
        });
      }

      // Outcomes Prediction
      if (entry.outcomesPrediction) {
        const modifiableFactors = entry.outcomesPrediction.modifiableFactors;

        // If has multiple modifiable factors, create separate rows
        if (modifiableFactors && Array.isArray(modifiableFactors) && modifiableFactors.length > 0) {
          const statusDisplay = getValue(entry.outcomesPrediction.predictedTrajectory);
          const recommendationsDisplay = getValue(entry.outcomesPrediction.interventionImpact);

          modifiableFactors.forEach((factor, index) => {
            rows.push({
              date: date,  // Show on ALL rows
              'category': 'Outcomes Prediction',  // Show on ALL rows
              'item': 'Predicted Trajectory',  // Show on ALL rows
              'status': statusDisplay,  // Show on ALL rows
              'gaps': capitalizeFirst(factor),
              'recommendations': recommendationsDisplay,  // Show on ALL rows
              'priority': 'Medium'  // Show on ALL rows
            });
          });
        } else {
          // Single row if no factors array
          rows.push({
            date,
            'category': 'Outcomes Prediction',
            'item': 'Predicted Trajectory',
            'status': getValue(entry.outcomesPrediction.predictedTrajectory),
            'gaps': getValue(modifiableFactors),
            'recommendations': getValue(entry.outcomesPrediction.interventionImpact),
            'priority': 'Medium'
          });
        }
      }
    });

    return rows;
  }
};
