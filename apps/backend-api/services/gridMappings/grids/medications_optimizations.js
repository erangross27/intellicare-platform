module.exports = {
  title: '💊 Current Medications - AI Optimization',
  columns: ['Current Medication', 'Alternative', 'Savings', 'Current Med Risk', 'Alternative Risk', 'AI Recommendation'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const extractCostNumber = (costStr) => {
      const match = costStr.match(/\$(\d+)/);
      return match ? parseInt(match[1]) : 0;
    };

    const rows = [];

    console.log('🔍 [medications_optimizations mapper] Received data:', JSON.stringify(categoryData, null, 2));

    categoryData.forEach(entry => {
      console.log('🔍 [medications_optimizations mapper] Processing entry, has costAnalysis:', !!entry.costAnalysis);

      // Cost Analysis - Each medication and its alternatives (SAME FORMAT AS DOCTOR'S RECOMMENDATIONS)
      if (entry.costAnalysis && Array.isArray(entry.costAnalysis)) {
        console.log('🔍 [medications_optimizations mapper] costAnalysis length:', entry.costAnalysis.length);
        entry.costAnalysis.forEach(cost => {
          console.log('🔍 [medications_optimizations mapper] Processing cost, has alternatives:', !!cost.alternatives);
          const currentMedName = getValue(cost.medication);
          const currentCostText = getValue(cost.estimatedCost);

          // Format: Medication name on line 1, price on line 2
          const currentMedDisplay = `${currentMedName}\n💵 ${currentCostText}`;

          // Get adherence risk factors for "Current Med Risk" column
          const adherenceRisks = entry.adherenceRisk?.riskFactors || [];
          const currentMedRisk = adherenceRisks.length > 0 ? adherenceRisks.join(', ') : '-';

          const currentCost = extractCostNumber(currentCostText);

          // Check if there are alternatives
          if (cost.alternatives && Array.isArray(cost.alternatives) && cost.alternatives.length > 0) {
            // Show each alternative as a separate row
            cost.alternatives.forEach((alt) => {
              const altName = getValue(alt.name);
              const altCostText = getValue(alt.cost);
              const altCost = extractCostNumber(altCostText);

              // Format: Alternative name on line 1, price on line 2
              const altDisplay = `${altName}\n💵 ${altCostText}`;

              // Calculate savings
              const costSavings = currentCost - altCost;
              const percentSavings = currentCost > 0 ? Math.round((costSavings / currentCost) * 100) : 0;

              let savingsDisplay = 'Similar cost';
              if (costSavings > 0) {
                savingsDisplay = `💰 Saves $${costSavings}/month (${percentSavings}% less)`;
              } else if (costSavings < 0) {
                savingsDisplay = `Costs $${Math.abs(costSavings)}/month more`;
              }

              // Alternative Risk (safety + efficacy)
              const safetyText = getValue(alt.safetyCheck);
              const efficacyText = getValue(alt.efficacyComparison);
              const altRisk = safetyText;

              // AI Recommendation (efficacy comparison + recommendation)
              let recommendation = '';
              const hasSafetyIssue = safetyText.toLowerCase().includes('risk') ||
                                     safetyText.toLowerCase().includes('restriction') ||
                                     safetyText.toLowerCase().includes('interaction');

              if (hasSafetyIssue) {
                recommendation = 'Consider - review safety concerns. ';
              } else if (costSavings >= 100) {
                recommendation = 'Consider - significant savings. ';
              } else if (costSavings > 0) {
                recommendation = 'Consider - saves money. ';
              } else if (efficacyText.toLowerCase().includes('once-daily')) {
                recommendation = 'Better adherence (once daily). ';
              }

              recommendation += efficacyText;

              rows.push({
                'Current Medication': currentMedDisplay,
                'Alternative': altDisplay,
                'Savings': savingsDisplay,
                'Current Med Risk': currentMedRisk,
                'Alternative Risk': altRisk,
                'AI Recommendation': recommendation
              });
            });
          } else {
            // No alternatives available - show medication with "No alternative offered"
            // Provide smart recommendation based on medication type
            let smartRecommendation = 'Current medication is already cost-effective';

            const insuranceCoverage = getValue(cost.insuranceCoverage);
            if (currentMedName.toLowerCase().includes('calcium') ||
                currentMedName.toLowerCase().includes('vitamin') ||
                currentMedName.toLowerCase().includes('multivitamin')) {
              smartRecommendation = '✅ OTC supplement - already very affordable. No alternatives needed.';
            } else if (insuranceCoverage.toLowerCase().includes('well-covered')) {
              smartRecommendation = `✅ Generic medication, well-covered by insurance. Already optimal choice.`;
            } else {
              smartRecommendation = `✅ Current medication is cost-effective (${currentCostText}). No alternatives recommended.`;
            }

            rows.push({
              'Current Medication': currentMedDisplay,
              'Alternative': 'No alternative offered',
              'Savings': '-',
              'Current Med Risk': currentMedRisk,
              'Alternative Risk': '-',
              'AI Recommendation': smartRecommendation
            });
          }
        });
      }
    });

    return rows;
  }
};
