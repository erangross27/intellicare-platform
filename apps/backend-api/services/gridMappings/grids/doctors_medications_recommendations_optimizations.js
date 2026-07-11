module.exports = {
  title: '💊 Doctor\'s Recommendations - AI Optimization',
  columns: [
    'Doctor\'s Recommendation',
    'Alternative',
    'Cost Comparison',
    'Value Analysis',
    'Clinical Benefit',
    'Quality of Life Impact',
    'Guideline Support',
    'AI Recommendation'
  ],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const extractCostNumber = (costStr) => {
      const str = String(costStr).toLowerCase();

      // Check if this has both "with insurance" and "without insurance" prices
      const hasWithInsurance = str.includes('with') && str.includes('insurance');
      const hasWithoutInsurance = str.includes('without') && str.includes('insurance');

      if (hasWithInsurance && hasWithoutInsurance) {
        // Extract BOTH prices and return the without-insurance price for fair comparison
        // Because alternatives likely show without-insurance prices
        const withoutMatch = str.match(/\$(\d+)(?:-(\d+))?[^;]*without\s+insurance/);
        if (withoutMatch) {
          const low = parseInt(withoutMatch[1]);
          const high = withoutMatch[2] ? parseInt(withoutMatch[2]) : low;
          return { cost: Math.round((low + high) / 2), hasInsurance: false };
        }
      }

      // Prefer "with insurance" if it's the only insurance price mentioned
      const withInsuranceMatch = str.match(/\$(\d+)(?:-(\d+))?[^;]*with\s+(?:typical\s+)?insurance/);
      if (withInsuranceMatch) {
        const low = parseInt(withInsuranceMatch[1]);
        const high = withInsuranceMatch[2] ? parseInt(withInsuranceMatch[2]) : low;
        return { cost: Math.round((low + high) / 2), hasInsurance: true };
      }

      // Extract cost range and use the average
      // Examples: "$400-550/month" -> 475, "$4-20/month" -> 12
      const rangeMatch = str.match(/\$(\d+)-(\d+)/);
      if (rangeMatch) {
        const low = parseInt(rangeMatch[1]);
        const high = parseInt(rangeMatch[2]);
        return { cost: Math.round((low + high) / 2), hasInsurance: false };
      }

      // Single number: "$400/month" -> 400
      const singleMatch = str.match(/\$(\d+)/);
      return { cost: singleMatch ? parseInt(singleMatch[1]) : 999999, hasInsurance: false };
    };

    // Format quality of life metrics
    const formatQOLMetrics = (qolMetrics) => {
      if (!qolMetrics || typeof qolMetrics !== 'object') return '-';

      const metrics = [];
      if (qolMetrics.exacerbationReduction) metrics.push(`Exacerbations: ${qolMetrics.exacerbationReduction}`);
      if (qolMetrics.symptomControl) metrics.push(`Symptoms: ${qolMetrics.symptomControl}`);
      if (qolMetrics.workProductivity) metrics.push(`Work: ${qolMetrics.workProductivity}`);
      if (qolMetrics.sleepQuality) metrics.push(`Sleep: ${qolMetrics.sleepQuality}`);
      if (qolMetrics.exerciseTolerance) metrics.push(`Exercise: ${qolMetrics.exerciseTolerance}`);

      return metrics.length > 0 ? metrics.join('\n') : '-';
    };

    // Format guideline support
    const formatGuidelineSupport = (guidelineSupport) => {
      if (!guidelineSupport || !Array.isArray(guidelineSupport) || guidelineSupport.length === 0) return '-';

      return guidelineSupport.map(g => {
        const guideline = getValue(g.guideline, '');
        const criteria = g.criteria && Array.isArray(g.criteria) ? g.criteria.join(', ') : '';
        const recommendation = getValue(g.recommendation, '');

        if (guideline && criteria) {
          return `${guideline}\n✓ ${criteria}${recommendation ? '\n→ ' + recommendation : ''}`;
        }
        return guideline || '-';
      }).join('\n\n');
    };

    // Format clinical benefit score
    const formatClinicalBenefit = (clinicalBenefitScore) => {
      if (!clinicalBenefitScore || typeof clinicalBenefitScore !== 'object') return '-';

      const score = clinicalBenefitScore.score !== undefined ? clinicalBenefitScore.score : '-';
      const efficacy = clinicalBenefitScore.efficacy !== undefined ? clinicalBenefitScore.efficacy : '-';
      const safety = clinicalBenefitScore.safety !== undefined ? clinicalBenefitScore.safety : '-';
      const convenience = clinicalBenefitScore.convenience !== undefined ? clinicalBenefitScore.convenience : '-';
      const patientFit = clinicalBenefitScore.patientFit !== undefined ? clinicalBenefitScore.patientFit : '-';
      const rationale = getValue(clinicalBenefitScore.rationale, '');

      let result = `Overall: ${score}/10`;
      if (efficacy !== '-' || safety !== '-' || convenience !== '-' || patientFit !== '-') {
        result += `\nEfficacy: ${efficacy} | Safety: ${safety}\nConvenience: ${convenience} | Patient Fit: ${patientFit}`;
      }
      if (rationale) {
        result += `\n${rationale}`;
      }

      return result;
    };

    // Calculate cost per condition
    const calculateCostPerCondition = (cost, conditionsTreated) => {
      if (!conditionsTreated || !Array.isArray(conditionsTreated) || conditionsTreated.length === 0) {
        return '-';
      }

      const costInfo = extractCostNumber(cost);
      const perCondition = Math.round(costInfo.cost / conditionsTreated.length);

      return `$${perCondition}/condition (${conditionsTreated.length} conditions)`;
    };

    const rows = [];

    categoryData.forEach(entry => {
      // Cost Analysis - Each medication and its alternatives
      if (entry.costAnalysis && Array.isArray(entry.costAnalysis)) {
        entry.costAnalysis.forEach(cost => {
          const currentCostInfo = extractCostNumber(getValue(cost.estimatedCost));

          // Format doctor's recommendation display
          const doctorMed = getValue(cost.medication);
          const doctorCost = getValue(cost.estimatedCost);
          const doctorConditions = cost.conditionsTreated && Array.isArray(cost.conditionsTreated)
            ? cost.conditionsTreated.join(', ')
            : '-';
          const doctorCostPerCondition = cost.costPerCondition || calculateCostPerCondition(doctorCost, cost.conditionsTreated);

          const doctorDisplay = `${doctorMed}\n💵 ${doctorCost}\n🎯 Treats: ${doctorConditions}\n📊 ${doctorCostPerCondition}`;

          // Each alternative as a separate row
          if (cost.alternatives && Array.isArray(cost.alternatives)) {
            cost.alternatives.forEach((alt) => {
              const altCostInfo = extractCostNumber(getValue(alt.cost));

              // Format alternative display
              const altMed = getValue(alt.name);
              const altCost = getValue(alt.cost);
              const altConditions = alt.conditionsTreated && Array.isArray(alt.conditionsTreated)
                ? alt.conditionsTreated.join(', ')
                : '-';
              const altCostPerCondition = alt.costPerCondition || calculateCostPerCondition(altCost, alt.conditionsTreated);

              const altDisplay = `${altMed}\n💵 ${altCost}\n🎯 Treats: ${altConditions}\n📊 ${altCostPerCondition}`;

              // Cost comparison
              let costComparison = '';
              let costSavings = currentCostInfo.cost - altCostInfo.cost;
              const percentSavings = currentCostInfo.cost > 0 ? Math.round((costSavings / currentCostInfo.cost) * 100) : 0;

              if (costSavings >= 50) {
                costComparison = `💰 Saves $${costSavings}/month\n(${percentSavings}% less)`;
              } else if (costSavings > 0) {
                costComparison = `Saves $${costSavings}/month\n(${percentSavings}%)`;
              } else if (costSavings < 0) {
                costComparison = `Costs $${Math.abs(costSavings)}/month more\n(${Math.abs(percentSavings)}% increase)`;
              } else {
                costComparison = 'Similar cost';
              }

              // Value analysis
              const valueAnalysis = getValue(cost.valueAssessment || alt.valueAssessment, '-');

              // Clinical benefit
              const doctorClinicalBenefit = formatClinicalBenefit(cost.clinicalBenefitScore);
              const altClinicalBenefit = formatClinicalBenefit(alt.clinicalBenefitScore);
              const clinicalBenefitDisplay = `Doctor's Choice:\n${doctorClinicalBenefit}\n\nAlternative:\n${altClinicalBenefit}`;

              // Quality of life impact
              const doctorQOL = formatQOLMetrics(cost.qualityOfLifeMetrics);
              const altQOL = formatQOLMetrics(alt.qualityOfLifeMetrics);
              const qolDisplay = `Doctor's Choice:\n${doctorQOL}\n\nAlternative:\n${altQOL}`;

              // Guideline support
              const doctorGuidelines = formatGuidelineSupport(cost.guidelineSupport);
              const altGuidelines = formatGuidelineSupport(alt.guidelineSupport);
              const guidelineDisplay = `Doctor's Choice:\n${doctorGuidelines}\n\nAlternative:\n${altGuidelines}`;

              // AI Recommendation (comprehensive based on all metrics)
              let aiRecommendation = '';
              const doctorScore = cost.clinicalBenefitScore?.score || 0;
              const altScore = alt.clinicalBenefitScore?.score || 0;
              const efficacy = getValue(alt.efficacyComparison, '');
              const safety = getValue(alt.safetyCheck, '');

              if (safety.toLowerCase().includes('contraindication') && !safety.toLowerCase().includes('no contraindication')) {
                aiRecommendation = `⚠️ CAUTION: Safety concerns identified\n${safety}\n${efficacy}`;
              } else if (altScore > doctorScore && costSavings > 0) {
                aiRecommendation = `✅ RECOMMEND Alternative\nHigher clinical benefit (${altScore}/10 vs ${doctorScore}/10)\nCost savings: $${costSavings}/month\n${efficacy}`;
              } else if (costSavings >= 100) {
                aiRecommendation = `💰 CONSIDER Alternative\nSignificant cost savings ($${costSavings}/month)\n${efficacy}`;
              } else if (altScore > doctorScore) {
                aiRecommendation = `✓ Consider Alternative\nBetter clinical benefit (${altScore}/10 vs ${doctorScore}/10)\n${efficacy}`;
              } else if (costSavings > 0 && altScore >= doctorScore - 1) {
                aiRecommendation = `💡 Alternative option available\nSimilar benefit, lower cost\n${efficacy}`;
              } else {
                aiRecommendation = `Continue with doctor's choice\n${efficacy}`;
              }

              rows.push({
                'Doctor\'s Recommendation': doctorDisplay,
                'Alternative': altDisplay,
                'Cost Comparison': costComparison,
                'Value Analysis': valueAnalysis,
                'Clinical Benefit': clinicalBenefitDisplay,
                'Quality of Life Impact': qolDisplay,
                'Guideline Support': guidelineDisplay,
                'AI Recommendation': aiRecommendation
              });
            });
          }
        });
      }
    });

    return rows;
  }
};
