import React, { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import secureApi from '../../services/secureApiClient';
import secureStorage from '../../utils/secureStorage';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import './LabResultsViewer.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const LabResultsViewer = ({ patientId, language }) => {
  const [labResults, setLabResults] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [timeRange, setTimeRange] = useState('6months');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const isRTL = language === 'he';
  
  // Fetch real lab results from backend
  useEffect(() => {
    if (!patientId) return;
    
    const fetchLabResults = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const token = secureStorage.getItem('token');
        const subdomain = secureStorage.getItem('practiceSubdomain') || 'developer';
        
        // Calculate date range
        const dateTo = new Date();
        const dateFrom = new Date();
        if (timeRange === '1month') {
          dateFrom.setMonth(dateFrom.getMonth() - 1);
        } else if (timeRange === '3months') {
          dateFrom.setMonth(dateFrom.getMonth() - 3);
        } else if (timeRange === '6months') {
          dateFrom.setMonth(dateFrom.getMonth() - 6);
        } else if (timeRange === '1year') {
          dateFrom.setFullYear(dateFrom.getFullYear() - 1);
        }
        
        const data = await secureApi.get(
          `/medical-data/patients/${patientId}/lab-results?` +
          `dateFrom=${dateFrom.toISOString()}&dateTo=${dateTo.toISOString()}&limit=50`
        );
        
        if (data.error) {
          throw new Error('Failed to fetch lab results');
        }
        
        // Transform data to match component format
        const transformedResults = data.data.map(result => ({
          id: result._id,
          date: result.testDate,
          category: result.testType || (isRTL ? 'בדיקת מעבדה' : 'Lab Test'),
          tests: Object.entries(result.results || {}).map(([name, value]) => ({
            name,
            value: typeof value === 'object' ? value.value : value,
            unit: typeof value === 'object' ? value.unit : '',
            range: result.normalRange?.[name] || '',
            status: result.abnormalFlags?.includes(name) ? 'high' : 'normal'
          }))
        }));
        
        // If no real data, provide some default message
        if (transformedResults.length === 0) {
          setLabResults([{
            id: 'no-data',
            date: new Date().toISOString(),
            category: isRTL ? 'אין תוצאות' : 'No Results',
            tests: [{
              name: isRTL ? 'אין תוצאות מעבדה זמינות' : 'No lab results available',
              value: '-',
              unit: '',
              range: '',
              status: 'normal'
            }]
          }]);
        } else {
          setLabResults(transformedResults);
        }
        
      } catch (err) {
        process.env.NODE_ENV !== 'production' && console.error('Error fetching lab results:', err);
        setError(err.message);
        // Fallback to empty state
        setLabResults([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLabResults();
  }, [patientId, timeRange, isRTL]);
  
  const getStatusColor = (status) => {
    switch(status) {
      case 'high': return '#ef4444';
      case 'low': return '#3b82f6';
      case 'critical': return '#dc2626';
      default: return '#10b981';
    }
  };
  
  const getStatusIcon = (status) => {
    switch(status) {
      case 'high': return '↑';
      case 'low': return '↓';
      case 'critical': return '⚠️';
      default: return '✓';
    }
  };
  
  // Build chart data from real lab results
  const chartData = {
    labels: labResults.length > 0 
      ? labResults.slice(0, 7).map(r => new Date(r.date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US', { month: 'short' }))
      : [],
    datasets: labResults.length > 0 && labResults[0].tests.length > 0
      ? labResults[0].tests.slice(0, 2).map((test, index) => ({
          label: test.name,
          data: labResults.slice(0, 7).map(r => {
            const testData = r.tests.find(t => t.name === test.name);
            return testData ? parseFloat(testData.value) || 0 : 0;
          }),
          borderColor: index === 0 ? '#3b82f6' : '#10b981',
          backgroundColor: index === 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true
        }))
      : []
  };
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        rtl: isRTL
      },
      title: {
        display: true,
        text: isRTL ? 'מגמות תוצאות מעבדה' : 'Lab Results Trends',
        rtl: isRTL
      }
    },
    scales: {
      x: {
        reverse: isRTL
      }
    }
  };
  
  return (
    <div className={`lab-results-viewer ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>{isRTL ? 'טוען תוצאות מעבדה...' : 'Loading lab results...'}</p>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="error-state">
          <p>{isRTL ? 'שגיאה בטעינת תוצאות' : 'Error loading results'}</p>
          <small>{error}</small>
        </div>
      )}
      
      {/* Header with Time Range Selector */}
      <div className="lab-header">
        <h3>{isRTL ? 'תוצאות מעבדה' : 'Laboratory Results'}</h3>
        <div className="time-range-selector">
          <button 
            className={timeRange === '1month' ? 'active' : ''}
            onClick={() => setTimeRange('1month')}
          >
            {isRTL ? 'חודש' : '1M'}
          </button>
          <button 
            className={timeRange === '3months' ? 'active' : ''}
            onClick={() => setTimeRange('3months')}
          >
            {isRTL ? '3 חודשים' : '3M'}
          </button>
          <button 
            className={timeRange === '6months' ? 'active' : ''}
            onClick={() => setTimeRange('6months')}
          >
            {isRTL ? '6 חודשים' : '6M'}
          </button>
          <button 
            className={timeRange === '1year' ? 'active' : ''}
            onClick={() => setTimeRange('1year')}
          >
            {isRTL ? 'שנה' : '1Y'}
          </button>
        </div>
      </div>
      
      {/* Trend Chart */}
      <div className="lab-chart-container">
        <Line data={chartData} options={chartOptions} />
      </div>
      
      {/* Results List */}
      <div className="lab-results-list">
        <h4>{isRTL ? 'תוצאות אחרונות' : 'Recent Results'}</h4>
        {labResults.map(result => (
          <div key={result.id} className="lab-result-group">
            <div className="result-header">
              <span className="result-date">📅 {new Date(result.date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US')}</span>
              <span className="result-category">{result.category}</span>
            </div>
            <div className="result-tests">
              {result.tests.map((test, idx) => (
                <div key={idx} className={`test-item ${test.status}`}>
                  <div className="test-name">
                    <span>{test.name}</span>
                    <span className="status-icon">{getStatusIcon(test.status)}</span>
                  </div>
                  <div className="test-value">
                    <span className="value" style={{ color: getStatusColor(test.status) }}>
                      {test.value} {test.unit}
                    </span>
                    <span className="range">({test.range})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Quick Actions */}
      <div className="lab-actions">
        <button className="action-button primary">
          📊 {isRTL ? 'ייצא לPDF' : 'Export PDF'}
        </button>
        <button className="action-button">
          🔄 {isRTL ? 'השווה תוצאות' : 'Compare'}
        </button>
        <button className="action-button">
          📧 {isRTL ? 'שלח לרופא' : 'Send to Doctor'}
        </button>
      </div>
    </div>
  );
};

export default LabResultsViewer;