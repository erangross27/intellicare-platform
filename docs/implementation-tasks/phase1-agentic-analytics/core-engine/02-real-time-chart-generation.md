# Real-time Chart Generation

## Overview
Dynamic chart generation system that creates interactive visualizations in real-time based on conversational AI requests. Users can ask for specific charts in natural language and receive instant, interactive visualizations embedded directly in the chat interface.

## Key Components

### Chart Generation Engine
- **Dynamic Creation**: Generate charts on-demand from AI agent function calls
- **Multiple Chart Types**: Line, bar, pie, scatter, heatmap, gauge, funnel, and healthcare-specific charts
- **Real-time Data**: Live data streaming for continuously updating charts
- **Interactive Features**: Zoom, filter, drill-down, and export capabilities within chat

### Healthcare-Specific Charts
- **Patient Flow Diagrams**: Visual representation of patient journey through healthcare system
- **Clinical Outcome Trends**: Longitudinal patient outcome visualization
- **Resource Utilization**: Real-time equipment, staff, and facility usage charts
- **Quality Metrics**: Patient safety, satisfaction, and clinical quality indicators

### Implementation Details
- **Service**: `realtimeChartService.js` - Chart generation and data processing
- **Priority**: Critical | **Time**: 30-40 hours  
- **Dependencies**: Chart.js/D3.js, WebSocket connections, existing analytics services

## Chart Types and Use Cases
```javascript
// Healthcare-specific chart generation functions
async generatePatientFlowChart(timeframe, departments, context)
async createClinicalTrendChart(metric, patientGroup, period, context)
async buildResourceUtilizationChart(resourceType, timeframe, context)
async generateQualityDashboard(qualityMetrics, compareToBaseline, context)
async createRevenueAnalysisChart(revenueStreams, period, comparison, context)
async buildStaffProductivityChart(staffType, metrics, timeframe, context)
async generateComplianceScorecard(complianceAreas, auditPeriod, context)
async createPredictiveChart(targetMetric, forecastHorizon, confidence, context)
```

## Chat Integration Functions (Added to agentServiceV4.js)
```javascript
// Real-time chart generation functions added to getAllPlatformFunctions()
{
  name: "generateRealtimeChart",
  description: isHebrew ? "צור תרשים בזמן אמת" : "Generate real-time chart",
  parameters: {
    type: "object",
    properties: {
      chartType: { 
        type: "string", 
        enum: ["line", "bar", "pie", "scatter", "heatmap", "gauge", "funnel", "patientflow", "clinical_trend"],
        description: isHebrew ? "סוג תרשים" : "Chart type" 
      },
      dataSource: { 
        type: "string", 
        enum: ["patients", "appointments", "revenue", "quality", "staff", "resources"],
        description: isHebrew ? "מקור נתונים" : "Data source" 
      },
      timeRange: {
        type: "object",
        properties: {
          startDate: { type: "string", description: isHebrew ? "תאריך התחלה" : "Start date" },
          endDate: { type: "string", description: isHebrew ? "תאריך סיום" : "End date" },
          period: { type: "string", enum: ["day", "week", "month", "quarter", "year"], description: isHebrew ? "תקופה" : "Period" }
        }
      },
      filters: { 
        type: "object", 
        description: isHebrew ? "מסננים נוספים" : "Additional filters" 
      },
      interactive: { 
        type: "boolean", 
        description: isHebrew ? "תרשים אינטראקטיבי" : "Interactive chart" 
      }
    },
    required: ["chartType", "dataSource"]
  }
}
```

## API Endpoints
- `POST /charts/generate` - Generate chart from AI agent request
- `GET /charts/realtime/:chartId` - Get real-time chart data updates
- `POST /charts/export/:chartId` - Export chart in various formats (PNG, PDF, SVG)
- `WebSocket /ws/charts/:chartId` - Real-time chart data streaming
- `GET /charts/templates/healthcare` - Healthcare-specific chart templates

## Database Schema
**GeneratedChart**: `chartId`, `sessionId`, `userId`, `practiceId`, `chartType`, `dataSource`, `config`, `lastUpdated`
**ChartData**: `chartId`, `dataPoints[]`, `metadata`, `timestamp`, `version`

## Chart Configuration
1. **Responsive Design**: Charts automatically adapt to chat container width
2. **Theme Integration**: Match existing IntelliCare UI theme and branding
3. **Language Support**: Hebrew and English labels, legends, and tooltips
4. **Accessibility**: Screen reader support and keyboard navigation
5. **Performance**: Optimized for mobile devices and low bandwidth

## Conversational Chart Requests
- **Simple**: "Show me patient volume this month" → Bar chart of daily patient counts
- **Comparative**: "Compare revenue this year vs last year" → Line chart with two series
- **Filtered**: "Show me diabetes patients by age group" → Pie chart with age demographics
- **Predictive**: "What will our appointment bookings look like next month?" → Forecast line chart
- **Complex**: "Show me the correlation between wait times and satisfaction scores" → Scatter plot

## Real-time Updates
- **WebSocket Integration**: Live data streaming for continuously updating charts
- **Auto-refresh**: Configurable refresh intervals for different chart types
- **Delta Updates**: Efficient incremental updates for large datasets
- **Alert Integration**: Visual alerts when metrics exceed thresholds

## Export and Sharing
- **Multiple Formats**: PNG, SVG, PDF, Excel for different use cases
- **Embed Codes**: Share interactive charts outside the platform
- **Scheduled Reports**: Automated chart generation and distribution
- **Print Optimization**: Charts optimized for printing and presentations

## Success Criteria
- ✅ Generate interactive charts in under 3 seconds from AI request
- ✅ Support for 20+ chart types including healthcare-specific visualizations
- ✅ Real-time data updates with WebSocket streaming
- ✅ Mobile-responsive charts that work perfectly in chat interface
- ✅ Hebrew and English localization with proper RTL support
- ✅ Export functionality for sharing and presentations
- ✅ Healthcare-specific chart templates and configurations