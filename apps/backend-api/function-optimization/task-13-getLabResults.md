# Task 13: Optimize getLabResults Function

## Current Issue
- Returns ALL lab values with reference ranges
- Complex nested structures for each test
- Historical results for comparison
- Can be 5,000+ tokens for comprehensive panels

## Location
- File: `services/agentServiceV4.js`
- Line: ~19060

## Current Return Structure
```javascript
{
  data: [
    {
      _id, date, labName, orderingProvider,
      results: {
        CBC: {
          WBC: { value: 7.5, unit: 'K/uL', range: '4.5-11', flag: 'normal' },
          RBC: { value: 4.8, unit: 'M/uL', range: '4.2-5.4', flag: 'normal' },
          // 20+ more values
        },
        Chemistry: {
          // 30+ values
        },
        // More panels
      },
      interpretation: "Full interpretation text...",
      criticalValues: [...],
      previousResults: [...] // Historical comparison
    }
  ]
}
```

## Smart Lab Result Optimization
```javascript
// For list view - just abnormal values
const labSummary = {
  _id: lab._id,
  date: lab.date,
  testCount: countAllTests(lab.results),
  abnormalCount: countAbnormal(lab.results),
  criticalValues: lab.criticalValues || [],
  abnormalValues: getOnlyAbnormal(lab.results),
  summary: generateQuickSummary(lab)
};

// Helper: Get only abnormal values
function getOnlyAbnormal(results) {
  const abnormal = [];
  for (const [panel, tests] of Object.entries(results)) {
    for (const [test, data] of Object.entries(tests)) {
      if (data.flag !== 'normal') {
        abnormal.push({
          test: `${panel}.${test}`,
          value: data.value,
          flag: data.flag
        });
      }
    }
  }
  return abnormal;
}
```

## Context-Aware Details
```javascript
// If asking about specific test
if (params.testName) {
  return {
    current: results[testName],
    history: getTestHistory(testName),
    trend: calculateTrend(testName)
  };
}

// If asking about trends
if (context.includes('trend') || context.includes('change')) {
  return {
    trends: calculateAllTrends(),
    improving: getImprovingTests(),
    worsening: getWorseningTests()
  };
}

// Default summary view
return {
  recent: lastLabDate,
  abnormalCount: totalAbnormal,
  criticalCount: totalCritical,
  needsReview: abnormalTests.slice(0, 5),
  nextDue: calculateNextDue()
};
```

## Smart Grouping
```javascript
// Group by status for quick review
return {
  critical: labs.filter(l => l.hasCritical),
  abnormal: labs.filter(l => l.hasAbnormal && !l.hasCritical),
  normal: labCount.normal, // Just count, not data
  pending: labs.filter(l => l.status === 'pending')
};
```

## Expected Result
- List view: 100 tokens per lab (from 2,000)
- Summary: 300 tokens for all labs
- Specific test: 200 tokens with history
- Full panel: Available on request only