# Interactive Chart Components

## Overview
Comprehensive library of interactive React components for displaying analytics and visualizations directly within the chat interface. These components provide rich, touch-friendly interactions while maintaining optimal performance in the conversational AI environment.

## Key Components

### Core Chart Components
- **ResponsiveChart**: Base chart component that adapts to chat container width
- **InteractiveChart**: Enhanced chart with click, hover, and drill-down capabilities
- **RealtimeChart**: Charts with live data streaming and auto-refresh
- **MobileOptimizedChart**: Touch-optimized charts for mobile chat experience

### Healthcare-Specific Components  
- **PatientFlowChart**: Visual patient journey and flow diagrams
- **ClinicalTrendChart**: Longitudinal patient data and outcome trends
- **QualityMetricsCard**: Patient safety and quality indicator displays
- **ResourceUtilizationGauge**: Real-time resource and capacity monitoring

### Implementation Details
- **Library**: React + Chart.js/D3.js + Custom healthcare components
- **Priority**: Critical | **Time**: 50-60 hours
- **Dependencies**: React 18+, Chart.js 4+, D3.js v7, existing ChatContainer

## Chart Component Architecture

### ResponsiveChart Base Component
```javascript
const ResponsiveChart = ({ 
  data, 
  type, 
  config, 
  onInteraction,
  realtime = false,
  exportable = true 
}) => {
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // Auto-resize based on chat container
  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDimensions({ 
        width, 
        height: Math.min(width * 0.6, 400) // Optimal aspect ratio for chat
      });
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => resizeObserver.disconnect();
  }, []);
  
  return (
    <div ref={containerRef} className="responsive-chart-container">
      <ChartCanvas
        ref={chartRef}
        data={data}
        type={type}
        width={dimensions.width}
        height={dimensions.height}
        config={{
          ...config,
          responsive: true,
          maintainAspectRatio: false
        }}
        onDataPointClick={onInteraction}
      />
      {exportable && (
        <ChartExportTools chartRef={chartRef} />
      )}
    </div>
  );
};
```

### Healthcare-Specific Components

#### PatientFlowChart
```javascript
const PatientFlowChart = ({ flowData, timeframe, interactive = true }) => {
  const processFlowData = (data) => {
    return {
      nodes: data.stages.map(stage => ({
        id: stage.id,
        label: stage.name,
        count: stage.patientCount,
        averageTime: stage.averageTimeSpent
      })),
      edges: data.transitions.map(transition => ({
        source: transition.from,
        target: transition.to,
        count: transition.patientCount,
        percentage: transition.percentage
      }))
    };
  };
  
  return (
    <div className="patient-flow-chart">
      <FlowDiagram
        data={processFlowData(flowData)}
        layout="horizontal"
        interactive={interactive}
        onNodeClick={handleStageAnalysis}
        colorScheme="healthcare"
      />
      <FlowMetrics data={flowData} />
    </div>
  );
};
```

#### ClinicalTrendChart
```javascript
const ClinicalTrendChart = ({ 
  patientData, 
  metric, 
  normalRanges,
  annotations 
}) => {
  const formatClinicalData = (data) => {
    return {
      datasets: [{
        label: metric.name,
        data: data.measurements.map(m => ({
          x: m.date,
          y: m.value,
          annotation: m.event || null
        })),
        borderColor: getMetricColor(metric.type),
        backgroundColor: getMetricColor(metric.type, 0.1),
        tension: 0.4
      }]
    };
  };
  
  return (
    <div className="clinical-trend-chart">
      <ResponsiveChart
        type="line"
        data={formatClinicalData(patientData)}
        config={{
          plugins: {
            annotation: {
              annotations: normalRanges.map(range => ({
                type: 'box',
                yMin: range.min,
                yMax: range.max,
                backgroundColor: 'rgba(0, 255, 0, 0.1)',
                borderColor: 'rgba(0, 255, 0, 0.5)',
                label: { content: 'Normal Range' }
              }))
            }
          },
          scales: {
            y: {
              title: { display: true, text: metric.unit }
            }
          }
        }}
        onInteraction={handleDataPointAnalysis}
      />
      <ClinicalInsights data={patientData} metric={metric} />
    </div>
  );
};
```

### Interactive Features

#### Drill-down Functionality
```javascript
const DrilldownChart = ({ initialData, onDrillDown }) => {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [dataStack, setDataStack] = useState([initialData]);
  
  const handleChartClick = async (dataPoint) => {
    if (dataPoint.drilldownAvailable) {
      const drilldownData = await onDrillDown(dataPoint.id, currentLevel + 1);
      setDataStack([...dataStack, drilldownData]);
      setCurrentLevel(currentLevel + 1);
    }
  };
  
  const handleBreadcrumbClick = (level) => {
    setDataStack(dataStack.slice(0, level + 1));
    setCurrentLevel(level);
  };
  
  return (
    <div className="drilldown-chart">
      <Breadcrumbs 
        levels={dataStack.map((_, i) => `Level ${i + 1}`)}
        currentLevel={currentLevel}
        onLevelClick={handleBreadcrumbClick}
      />
      <ResponsiveChart
        data={dataStack[currentLevel]}
        onInteraction={handleChartClick}
      />
    </div>
  );
};
```

#### Touch Gestures for Mobile
```javascript
const TouchOptimizedChart = ({ data, type, config }) => {
  const [touchState, setTouchState] = useState({
    scale: 1,
    translateX: 0,
    translateY: 0,
    lastTouch: null
  });
  
  const handleTouchStart = (event) => {
    if (event.touches.length === 1) {
      setTouchState({
        ...touchState,
        lastTouch: {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY
        }
      });
    }
  };
  
  const handlePinchZoom = (event) => {
    if (event.touches.length === 2) {
      const distance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
      // Implement pinch-to-zoom logic
    }
  };
  
  return (
    <div 
      className="touch-optimized-chart"
      onTouchStart={handleTouchStart}
      onTouchMove={handlePinchZoom}
    >
      <ResponsiveChart
        data={data}
        type={type}
        config={{
          ...config,
          interaction: {
            intersect: false,
            mode: 'point'
          }
        }}
      />
      <TouchControls onZoomReset={handleZoomReset} />
    </div>
  );
};
```

### Real-time Components

#### LiveChart with WebSocket
```javascript
const LiveChart = ({ chartId, initialData, updateInterval = 5000 }) => {
  const [data, setData] = useState(initialData);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  
  useEffect(() => {
    wsRef.current = new WebSocket(`/ws/charts/${chartId}`);
    
    wsRef.current.onopen = () => setIsConnected(true);
    wsRef.current.onclose = () => setIsConnected(false);
    
    wsRef.current.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setData(prevData => updateChartData(prevData, update));
    };
    
    return () => {
      wsRef.current?.close();
    };
  }, [chartId]);
  
  return (
    <div className="live-chart">
      <ConnectionStatus isConnected={isConnected} />
      <ResponsiveChart
        data={data}
        realtime={true}
        config={{
          animation: {
            duration: 750,
            easing: 'easeInOutQuart'
          }
        }}
      />
      <LastUpdated timestamp={data.lastUpdate} />
    </div>
  );
};
```

### Export and Sharing Components

#### ChartExportTools
```javascript
const ChartExportTools = ({ chartRef, data, title }) => {
  const exportAsPNG = () => {
    const canvas = chartRef.current;
    const url = canvas.toDataURL('image/png');
    downloadFile(url, `${title}.png`);
  };
  
  const exportAsCSV = () => {
    const csv = convertToCSV(data);
    downloadFile(csv, `${title}.csv`, 'text/csv');
  };
  
  const shareChart = () => {
    if (navigator.share) {
      navigator.share({
        title: `IntelliCare Analytics: ${title}`,
        url: generateShareableURL(chartRef.current)
      });
    }
  };
  
  return (
    <div className="chart-export-tools">
      <ButtonGroup>
        <IconButton onClick={exportAsPNG} icon="download" tooltip="Export as PNG" />
        <IconButton onClick={exportAsCSV} icon="table" tooltip="Export as CSV" />
        <IconButton onClick={shareChart} icon="share" tooltip="Share Chart" />
      </ButtonGroup>
    </div>
  );
};
```

### Performance Optimization

#### Virtual Scrolling for Large Datasets
```javascript
const VirtualizedChart = ({ data, windowSize = 100 }) => {
  const [visibleData, setVisibleData] = useState([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  
  useEffect(() => {
    const startIndex = Math.floor(scrollPosition / windowSize);
    const endIndex = Math.min(startIndex + windowSize, data.length);
    setVisibleData(data.slice(startIndex, endIndex));
  }, [data, scrollPosition, windowSize]);
  
  return (
    <div className="virtualized-chart">
      <VirtualScroller
        totalItems={data.length}
        itemHeight={50}
        onScroll={setScrollPosition}
      />
      <ResponsiveChart data={visibleData} />
    </div>
  );
};
```

## Success Criteria
- ✅ Smooth 60fps interactions on all chart components
- ✅ Touch-optimized experience for mobile chat interface
- ✅ Real-time updates with WebSocket streaming under 100ms latency
- ✅ Support for datasets up to 10,000+ data points without performance issues
- ✅ Healthcare-specific visualizations that provide clinical insights
- ✅ Seamless integration with existing ChatContainer component
- ✅ One-click export functionality for all chart types
- ✅ Accessibility compliance (WCAG 2.1 AA) for all interactive elements