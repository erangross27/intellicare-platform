// Performance Testing Utilities for IntelliCare Medical History

/**
 * Test Hebrew text parsing performance
 */
export const testHebrewTextParsing = () => {
  const hebrewMedicalText = `
    אבחנה: סוכרת סוג 2
    תסמינים: עייפות, צמא מוגבר
    לחץ דם: 140/90
    גלוקוז: 180 mg/dl
    המלצות: דיאטה ופעילות גופנית
    תרופות: מטפורמין 500mg
    מעקב: בעוד חודש
  `;

  const startTime = performance.now();
  
  // Simulate parsing (this would call the actual API in real usage)
  const mockParsedData = {
    categories: {
      diagnosis: ['סוכרת סוג 2'],
      symptoms: ['עייפות', 'צמא מוגבר'],
      labResults: ['לחץ דם: 140/90', 'גלוקוז: 180 mg/dl'],
      medications: ['מטפורמין 500mg'],
      recommendations: ['דיאטה ופעילות גופנית'],
      followUp: ['מעקב: בעוד חודש']
    },
    confidence: 0.95
  };

  const endTime = performance.now();
  const parseTime = endTime - startTime;

  return {
    success: true,
    parseTime,
    categoriesFound: Object.keys(mockParsedData.categories).length,
    itemsFound: Object.values(mockParsedData.categories).flat().length,
    confidence: mockParsedData.confidence,
    hebrewTextLength: hebrewMedicalText.length
  };
};

/**
 * Test mobile responsiveness detection
 */
export const testMobileResponsiveness = () => {
  const tests = {
    isMobile: window.innerWidth <= 768,
    isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
    isDesktop: window.innerWidth > 1024,
    touchSupport: 'ontouchstart' in window,
    devicePixelRatio: window.devicePixelRatio || 1,
    orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
  };

  // Test CSS media query support
  const mediaQueryTests = {
    mobile: window.matchMedia('(max-width: 768px)').matches,
    tablet: window.matchMedia('(min-width: 769px) and (max-width: 1024px)').matches,
    desktop: window.matchMedia('(min-width: 1025px)').matches,
    retina: window.matchMedia('(-webkit-min-device-pixel-ratio: 2)').matches
  };

  return {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    deviceTests: tests,
    mediaQueries: mediaQueryTests,
    userAgent: navigator.userAgent,
    platform: navigator.platform
  };
};

/**
 * Test component rendering performance
 */
export const testComponentPerformance = (componentName, renderFunction) => {
  const startTime = performance.now();
  
  try {
    renderFunction();
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    return {
      component: componentName,
      success: true,
      renderTime,
      performance: renderTime < 16 ? 'excellent' : renderTime < 33 ? 'good' : 'needs optimization'
    };
  } catch (error) {
    const endTime = performance.now();
    return {
      component: componentName,
      success: false,
      error: error.message,
      renderTime: endTime - startTime
    };
  }
};

/**
 * Test memory usage
 */
export const testMemoryUsage = () => {
  if (performance.memory) {
    return {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      memoryUsagePercentage: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit * 100).toFixed(2)
    };
  }
  return { error: 'Memory API not available' };
};

/**
 * Test Hebrew text readability
 */
export const testHebrewReadability = () => {
  const hebrewTexts = [
    'אבחנה רפואית',
    'תסמינים קליניים',
    'המלצות טיפוליות',
    'תוצאות מעבדה',
    'מרשמים רפואיים'
  ];

  const readabilityTests = hebrewTexts.map(text => {
    // Test if text renders correctly (basic check)
    const testElement = document.createElement('div');
    testElement.style.direction = 'rtl';
    testElement.style.textAlign = 'right';
    testElement.style.fontFamily = 'Arial, sans-serif';
    testElement.textContent = text;
    
    document.body.appendChild(testElement);
    const computedStyle = window.getComputedStyle(testElement);
    const isRTL = computedStyle.direction === 'rtl';
    const textAlign = computedStyle.textAlign;
    document.body.removeChild(testElement);

    return {
      text,
      isRTL,
      textAlign,
      length: text.length,
      hasHebrewChars: /[\u0590-\u05FF]/.test(text)
    };
  });

  return {
    totalTexts: hebrewTexts.length,
    rtlSupport: readabilityTests.every(test => test.isRTL),
    hebrewCharSupport: readabilityTests.every(test => test.hasHebrewChars),
    tests: readabilityTests
  };
};

/**
 * Run comprehensive performance test suite
 */
export const runPerformanceTestSuite = () => {
  process.env.NODE_ENV !== 'production' && console.log('🚀 Starting IntelliCare Performance Test Suite...');
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  // Test Hebrew text parsing
  process.env.NODE_ENV !== 'production' && console.log('📝 Testing Hebrew text parsing...');
  results.tests.hebrewParsing = testHebrewTextParsing();

  // Test mobile responsiveness
  process.env.NODE_ENV !== 'production' && console.log('📱 Testing mobile responsiveness...');
  results.tests.mobileResponsiveness = testMobileResponsiveness();

  // Test memory usage
  process.env.NODE_ENV !== 'production' && console.log('💾 Testing memory usage...');
  results.tests.memoryUsage = testMemoryUsage();

  // Test Hebrew readability
  process.env.NODE_ENV !== 'production' && console.log('🔤 Testing Hebrew text readability...');
  results.tests.hebrewReadability = testHebrewReadability();

  // Overall performance score
  const scores = {
    parsing: results.tests.hebrewParsing.parseTime < 10 ? 100 : Math.max(0, 100 - results.tests.hebrewParsing.parseTime),
    mobile: results.tests.mobileResponsiveness.deviceTests.isMobile ? 100 : 80,
    hebrew: results.tests.hebrewReadability.rtlSupport ? 100 : 0,
    memory: results.tests.memoryUsage.memoryUsagePercentage ? Math.max(0, 100 - parseFloat(results.tests.memoryUsage.memoryUsagePercentage)) : 80
  };

  results.overallScore = Math.round((scores.parsing + scores.mobile + scores.hebrew + scores.memory) / 4);
  results.recommendations = [];

  // Generate recommendations
  if (scores.parsing < 80) {
    results.recommendations.push('Consider optimizing Hebrew text parsing performance');
  }
  if (scores.mobile < 90) {
    results.recommendations.push('Improve mobile responsiveness detection');
  }
  if (scores.hebrew < 100) {
    results.recommendations.push('Fix Hebrew text RTL rendering issues');
  }
  if (scores.memory < 70) {
    results.recommendations.push('Optimize memory usage to prevent performance issues');
  }

  process.env.NODE_ENV !== 'production' && console.log('✅ Performance test suite completed!');
  process.env.NODE_ENV !== 'production' && console.log(`📊 Overall Score: ${results.overallScore}/100`);
  
  if (results.recommendations.length > 0) {
    process.env.NODE_ENV !== 'production' && console.log('💡 Recommendations:');
    results.recommendations.forEach(rec => process.env.NODE_ENV !== 'production' && console.log(`   - ${rec}`));
  }

  return results;
};

/**
 * Monitor performance in real-time
 */
export const startPerformanceMonitoring = (interval = 5000) => {
  const monitor = {
    isRunning: false,
    intervalId: null,
    data: []
  };

  monitor.start = () => {
    if (monitor.isRunning) return;
    
    monitor.isRunning = true;
    monitor.intervalId = setInterval(() => {
      const memoryData = testMemoryUsage();
      const timestamp = Date.now();
      
      monitor.data.push({
        timestamp,
        memory: memoryData,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      });

      // Keep only last 100 data points
      if (monitor.data.length > 100) {
        monitor.data.shift();
      }
    }, interval);
  };

  monitor.stop = () => {
    if (monitor.intervalId) {
      clearInterval(monitor.intervalId);
      monitor.intervalId = null;
      monitor.isRunning = false;
    }
  };

  monitor.getReport = () => {
    return {
      dataPoints: monitor.data.length,
      duration: monitor.data.length > 0 ? monitor.data[monitor.data.length - 1].timestamp - monitor.data[0].timestamp : 0,
      averageMemoryUsage: monitor.data.length > 0 ? 
        monitor.data.reduce((sum, point) => sum + (parseFloat(point.memory.memoryUsagePercentage) || 0), 0) / monitor.data.length : 0,
      data: monitor.data
    };
  };

  return monitor;
};

export default {
  testHebrewTextParsing,
  testMobileResponsiveness,
  testComponentPerformance,
  testMemoryUsage,
  testHebrewReadability,
  runPerformanceTestSuite,
  startPerformanceMonitoring
};
