# Task 18: Optimize getVitalSigns Function

## Current Issue
- Returns ALL vital sign readings over time
- Each reading has multiple measurements
- Includes detailed notes and context
- Historical data for trending
- Can be 3,000+ tokens for active patients

## Location
- File: `services/agentServiceV4.js`
- Line: ~19588

## Current Return Structure
```javascript
{
  data: [
    {
      _id, timestamp, takenBy,
      measurements: {
        bloodPressure: {
          systolic: 120,
          diastolic: 80,
          position: 'sitting',
          arm: 'right',
          cuffSize: 'regular'
        },
        pulse: {
          rate: 72,
          rhythm: 'regular',
          strength: 'strong'
        },
        temperature: {
          value: 98.6,
          unit: 'F',
          method: 'oral'
        },
        respiratoryRate: 16,
        oxygenSaturation: {
          value: 98,
          onOxygen: false
        },
        weight: {
          value: 70,
          unit: 'kg',
          clothed: true
        },
        height: {
          value: 170,
          unit: 'cm'
        },
        bmi: 24.2,
        painScale: 3,
        notes: "Patient notes..."
      }
    }
    // × Many readings
  ]
}
```

## Smart Vitals Summary
```javascript
// Latest vitals with status
const vitalsSummary = {
  latest: {
    timestamp: mostRecent.timestamp,
    bp: `${bp.systolic}/${bp.diastolic}`,
    pulse: pulse.rate,
    temp: temp.value,
    o2: o2Sat.value,
    status: assessVitalStatus(mostRecent) // 'Normal', 'Abnormal', 'Critical'
  },

  abnormal: {
    count: countAbnormalVitals(),
    recent: getRecentAbnormal().map(v => ({
      date: v.timestamp,
      type: v.abnormalType,
      value: v.abnormalValue
    }))
  },

  trends: {
    bp: { direction: 'stable', average: '125/82' },
    weight: { direction: 'increasing', change: '+2kg' },
    improving: ['pulse', 'temperature'],
    worsening: ['blood pressure']
  }
};
```

## Time-Based Views
```javascript
// Today's vitals
if (params.today) {
  return {
    readings: todayReadings.map(r => ({
      time: r.timestamp,
      bp: formatBP(r),
      pulse: r.pulse.rate,
      temp: r.temp.value,
      o2: r.o2.value
    })),
    summary: generateDailySummary(todayReadings)
  };
}

// Trending view
if (params.trending || context.includes('trend')) {
  return {
    period: 'Last 30 days',
    dataPoints: 10, // Not all readings
    trends: {
      bp: generateBPTrend(last30Days),
      weight: generateWeightTrend(last30Days),
      alerts: identifyWorryingTrends()
    }
  };
}
```

## Alert-Focused View
```javascript
// Critical values only
const criticalView = {
  hasCritical: criticalVitals.length > 0,
  critical: criticalVitals.map(v => ({
    timestamp: v.timestamp,
    parameter: v.criticalParam,
    value: v.criticalValue,
    action: v.recommendedAction
  })),

  warnings: {
    highBP: readings.filter(r => r.bp.systolic > 140).length,
    lowO2: readings.filter(r => r.o2.value < 92).length,
    fever: readings.filter(r => r.temp.value > 100.4).length
  }
};
```

## Expected Result
- Latest vitals: 100 tokens
- Daily summary: 200 tokens
- Trending view: 300 tokens
- Full history: Never sent (paginated)