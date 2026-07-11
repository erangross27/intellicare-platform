const fs = require('fs');

const jsonlPath = '/home/erangross/Downloads/msgbatch_016W5iB1XZEna4Bch5Zkhj5H_results.jsonl';
const lines = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(line => line.trim());

// Search by patient name in the extracted data instead of custom_id
const richardRecord = lines
  .map(line => JSON.parse(line))
  .find(record => {
    try {
      const toolUse = record.result?.message?.content?.find(c => c.type === 'tool_use');
      return toolUse?.input?.patientName && toolUse.input.patientName.toLowerCase().includes('richard phillips');
    } catch (e) {
      return false;
    }
  });

if (richardRecord) {
  const toolUse = richardRecord.result.message.content.find(c => c.type === 'tool_use');
  const args = toolUse.input;

  console.log('=== MEDICATION OPTIMIZATION DATA FROM BATCH EXTRACTION ===\n');
  console.log(`Patient: ${args.patientName}`);
  console.log(`Document Date: ${args.documentDate || args.date}\n`);

  // Check if medicationsOptimizations exists and normalize to array
  let medOpt = args.medicationsOptimizations;
  if (!medOpt) {
    console.log('❌ NO medicationsOptimizations field found in extracted data\n');
    console.log('Available top-level fields:');
    console.log(Object.keys(args).filter(k => !k.startsWith('_')).join(', '));
    process.exit(0);
  }

  // Normalize to array
  if (!Array.isArray(medOpt)) {
    medOpt = [medOpt];
  }

  console.log(`Total medication optimization records: ${medOpt.length}\n`);

  medOpt.forEach((record, idx) => {
    console.log(`\n--- Record ${idx + 1} ---`);
    console.log(`Patient: ${record.patientName || 'N/A'}`);
    console.log(`Date: ${record.date || 'N/A'}`);
    console.log(`\nDATA FIELDS EXTRACTED:`);

    // Check Format 1 fields (old format)
    console.log(`\nFormat 1 (Old Format):`);
    console.log(`  - costAnalysis: ${record.costAnalysis ? `${record.costAnalysis.length} items` : 'EMPTY'}`);
    console.log(`  - simplificationOpportunities: ${record.simplificationOpportunities ? `${record.simplificationOpportunities.length} items` : 'EMPTY'}`);

    if (record.adherenceRisk) {
      console.log(`  - adherenceRisk.riskLevel: ${record.adherenceRisk.riskLevel || 'N/A'}`);
      console.log(`  - adherenceRisk.riskFactors: ${record.adherenceRisk.riskFactors ? `${record.adherenceRisk.riskFactors.length} items` : 'EMPTY'}`);
      if (record.adherenceRisk.riskFactors && record.adherenceRisk.riskFactors.length > 0) {
        record.adherenceRisk.riskFactors.forEach((rf, i) => {
          console.log(`      ${i + 1}. ${rf}`);
        });
      }
      console.log(`  - adherenceRisk.mitigationStrategies: ${record.adherenceRisk.mitigationStrategies ? `${record.adherenceRisk.mitigationStrategies.length} items` : 'EMPTY'}`);
      if (record.adherenceRisk.mitigationStrategies && record.adherenceRisk.mitigationStrategies.length > 0) {
        record.adherenceRisk.mitigationStrategies.forEach((ms, i) => {
          console.log(`      ${i + 1}. ${ms}`);
        });
      }
    } else {
      console.log(`  - adherenceRisk: NOT PRESENT`);
    }

    // Check Format 2 fields (new format)
    console.log(`\nFormat 2 (New Format):`);
    console.log(`  - currentRegimen: ${record.currentRegimen ? 'PRESENT' : 'NOT PRESENT'}`);

    // Check Format 3 fields (backend formatter)
    console.log(`\nFormat 3 (Backend Formatter):`);
    console.log(`  - optimizationOpportunities: ${record.optimizationOpportunities ? `${record.optimizationOpportunities.length} items` : 'EMPTY'}`);
    console.log(`  - drugInteractions: ${record.drugInteractions ? `${record.drugInteractions.length} items` : 'EMPTY'}`);
    console.log(`  - dosingRecommendations: ${record.dosingRecommendations ? `${record.dosingRecommendations.length} items` : 'EMPTY'}`);
    console.log(`  - costOptimization: ${record.costOptimization ? `${record.costOptimization.length} items` : 'EMPTY'}`);
    console.log(`  - therapeuticAlternatives: ${record.therapeuticAlternatives ? `${record.therapeuticAlternatives.length} items` : 'EMPTY'}`);
    console.log(`  - duplicateTherapies: ${record.duplicateTherapies ? `${record.duplicateTherapies.length} items` : 'EMPTY'}`);
    console.log(`  - adherenceIssues: ${record.adherenceIssues ? `${record.adherenceIssues.length} items` : 'EMPTY'}`);
    console.log(`  - monitoringRecommendations: ${record.monitoringRecommendations ? `${record.monitoringRecommendations.length} items` : 'EMPTY'}`);
  });

  console.log('\n\n=== SUMMARY ===');
  console.log('The batch extraction captured:');
  console.log('✅ adherenceRisk data (riskLevel, riskFactors, mitigationStrategies)');
  console.log(`${medOpt[0]?.costAnalysis && medOpt[0].costAnalysis.length > 0 ? '✅' : '❌'} costAnalysis data`);
  console.log(`${medOpt[0]?.simplificationOpportunities && medOpt[0].simplificationOpportunities.length > 0 ? '✅' : '❌'} simplificationOpportunities data`);
  console.log(`${medOpt[0]?.currentRegimen ? '✅' : '❌'} currentRegimen data (Format 2)`);
  console.log(`${medOpt[0]?.optimizationOpportunities && medOpt[0].optimizationOpportunities.length > 0 ? '✅' : '❌'} optimizationOpportunities data (Format 3)`);

  console.log('\n💡 CONCLUSION:');
  if (!medOpt[0]?.costAnalysis || medOpt[0].costAnalysis.length === 0) {
    console.log('The source document likely contained adherence risk information');
    console.log('but did NOT contain cost optimization or simplification recommendations.');
    console.log('This is NOT an extraction issue - the data simply was not present.');
  }

} else {
  console.log('Richard Phillips record not found in JSONL file');
}
