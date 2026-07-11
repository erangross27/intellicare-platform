module.exports = {
  title: '✅ Guideline Compliance (AI)',
  columns: ['Date', 'Guideline', 'Status', 'Quantitative Monitoring', 'Patient-Reported Outcomes', 'Gaps', 'Recommendations', 'Priority'],
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
      return compliance;
    };

    const capitalizeFirst = (text) => {
      if (!text) return text;
      const trimmed = String(text).trim();
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    };

    const formatQuantitativeMonitoring = (monitoring) => {
      if (!monitoring || typeof monitoring !== 'object') return '-';

      const parts = [];
      if (monitoring.parameter) {
        parts.push(`📊 ${monitoring.parameter}`);
      }
      if (monitoring.baselineValue) {
        parts.push(`Baseline: ${monitoring.baselineValue}`);
      }
      if (monitoring.targetValue) {
        parts.push(`Target: ${monitoring.targetValue}`);
      }
      if (monitoring.currentStatus) {
        parts.push(`Status: ${monitoring.currentStatus}`);
      }
      if (monitoring.nextAssessment) {
        parts.push(`Next: ${monitoring.nextAssessment}`);
      }

      return parts.length > 0 ? parts.join('\n') : '-';
    };

    const formatPatientReportedOutcomes = (pro) => {
      if (!pro || typeof pro !== 'object') return '-';

      const parts = [];
      if (pro.outcomeMeasure) {
        parts.push(`📋 ${pro.outcomeMeasure}`);
      }
      if (pro.currentScore) {
        parts.push(`Current: ${pro.currentScore}`);
      }
      if (pro.guidelineTarget) {
        parts.push(`Target: ${pro.guidelineTarget}`);
      }
      if (pro.interpretation) {
        parts.push(`${pro.interpretation}`);
      }
      if (pro.frequency) {
        parts.push(`Frequency: ${pro.frequency}`);
      }

      return parts.length > 0 ? parts.join('\n') : '-';
    };

    const rows = [];

    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';

      if (entry.guidelines && Array.isArray(entry.guidelines)) {
        entry.guidelines.forEach(guideline => {
          const recommendations = guideline.recommendations;
          const gaps = guideline.gaps;

          // Format gaps display with clinical rationale for partial compliance
          let gapsDisplay = '-';
          if (gaps && Array.isArray(gaps) && gaps.length > 0) {
            // Handle both string gaps and object gaps with 'gap' property
            gapsDisplay = gaps.map(g => typeof g === 'string' ? g : (g.gap || String(g))).join('; ');
          } else if (guideline.compliance === 'Compliant') {
            gapsDisplay = '✓ No gaps in care';
          } else if (guideline.compliance === 'Partial' && guideline.clinicalRationale) {
            gapsDisplay = `⚠️ Partial: ${guideline.clinicalRationale}`;
          }

          const statusDisplay = formatStatus(getValue(guideline.compliance));

          // Enhanced priority logic per schema instructions
          let priorityDisplay = getValue(guideline.priority);
          if (!guideline.priority) {
            // Auto-assign priority based on compliance if not specified
            if (guideline.compliance === 'Non-compliant') {
              priorityDisplay = 'High';
            } else if (guideline.compliance === 'Partial') {
              // Partial compliance should be Medium (future risk), NOT Low
              priorityDisplay = 'Medium';
            } else {
              priorityDisplay = 'Low';
            }
          }

          // Format quantitative monitoring
          const quantMonitoring = formatQuantitativeMonitoring(guideline.quantitativeMonitoring);

          // Format patient-reported outcomes
          const proDisplay = formatPatientReportedOutcomes(guideline.patientReportedOutcomes);

          // Create separate row for each recommendation
          if (recommendations && Array.isArray(recommendations) && recommendations.length > 0) {
            recommendations.forEach((rec, index) => {
              rows.push({
                'Date': date,
                'Guideline': getValue(guideline.guidelineName),
                'Status': statusDisplay,
                'Quantitative Monitoring': quantMonitoring,
                'Patient-Reported Outcomes': proDisplay,
                'Gaps': gapsDisplay,
                'Recommendations': capitalizeFirst(rec),
                'Priority': priorityDisplay
              });
            });
          } else {
            // Single row if no recommendations
            rows.push({
              'Date': date,
              'Guideline': getValue(guideline.guidelineName),
              'Status': statusDisplay,
              'Quantitative Monitoring': quantMonitoring,
              'Patient-Reported Outcomes': proDisplay,
              'Gaps': gapsDisplay,
              'Recommendations': '-',
              'Priority': priorityDisplay
            });
          }
        });
      }
    });

    return rows;
  }
};
