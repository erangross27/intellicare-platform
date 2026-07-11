# Multi-language Analytics

## Overview
Comprehensive localization system for analytics and data visualizations supporting Hebrew and English with proper right-to-left (RTL) layout, cultural number formatting, and localized healthcare terminology. The system ensures analytics are culturally appropriate and accessible to users in both languages.

## Key Components

### RTL Analytics Support
- **RTL Chart Layouts**: Charts that properly display in right-to-left orientation for Hebrew users
- **Bidirectional Text**: Support for mixed Hebrew/English text in charts and analytics
- **RTL Dashboard Layouts**: Dashboard components that adapt to RTL reading patterns
- **Icon and UI Mirroring**: Proper mirroring of UI elements and navigation icons

### Localized Data Formatting
- **Number Formatting**: Hebrew and English number formatting (including right-to-left numbers in Hebrew)
- **Date Formatting**: Culturally appropriate date formats (Hebrew dates, Gregorian dates)
- **Currency Formatting**: Israeli Shekel (₪) and US Dollar ($) formatting
- **Medical Units**: Proper localization of medical measurements and units

### Implementation Details
- **Service**: `multiLanguageAnalyticsService.js` - Localization and RTL support
- **Priority**: Critical | **Time**: 30-40 hours
- **Dependencies**: react-i18next, RTL CSS frameworks, existing analytics components

## Localization Architecture

### Language Detection and Switching
```javascript
const AnalyticsLocalizationProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');
  const [direction, setDirection] = useState('ltr');
  
  const switchLanguage = (newLanguage) => {
    setLanguage(newLanguage);
    setDirection(newLanguage === 'he' ? 'rtl' : 'ltr');
    
    // Update chart configurations
    updateChartDefaults(newLanguage);
    
    // Update document direction
    document.documentElement.dir = direction;
    document.documentElement.lang = newLanguage;
  };
  
  return (
    <I18nextProvider i18n={i18nConfig}>
      <DirectionProvider value={direction}>
        <LanguageProvider value={{ language, switchLanguage }}>
          {children}
        </LanguageProvider>
      </DirectionProvider>
    </I18nextProvider>
  );
};
```

### RTL Chart Configuration
```javascript
const getRTLChartConfig = (baseConfig, language) => {
  if (language !== 'he') return baseConfig;
  
  return {
    ...baseConfig,
    layout: {
      ...baseConfig.layout,
      padding: {
        left: baseConfig.layout?.padding?.right || 20,
        right: baseConfig.layout?.padding?.left || 20,
        top: baseConfig.layout?.padding?.top || 20,
        bottom: baseConfig.layout?.padding?.bottom || 20
      }
    },
    scales: {
      x: {
        ...baseConfig.scales?.x,
        position: 'bottom',
        reverse: false // Keep x-axis normal for time series
      },
      y: {
        ...baseConfig.scales?.y,
        position: 'right', // Move y-axis to right for RTL
        reverse: false
      }
    },
    plugins: {
      ...baseConfig.plugins,
      legend: {
        ...baseConfig.plugins?.legend,
        position: 'top',
        align: 'end', // Align legend to right for RTL
        rtl: true,
        textDirection: 'rtl'
      },
      title: {
        ...baseConfig.plugins?.title,
        align: 'end' // Align title to right for RTL
      }
    }
  };
};
```

### Medical Terminology Localization

#### Healthcare Terms Dictionary
```javascript
const medicalTermsDict = {
  en: {
    // Patient metrics
    'patient_satisfaction': 'Patient Satisfaction',
    'wait_time': 'Wait Time',
    'readmission_rate': 'Readmission Rate',
    'length_of_stay': 'Length of Stay',
    'mortality_rate': 'Mortality Rate',
    
    // Departments
    'cardiology': 'Cardiology',
    'emergency': 'Emergency Department',
    'surgery': 'Surgery',
    'pediatrics': 'Pediatrics',
    
    // Time periods
    'daily': 'Daily',
    'weekly': 'Weekly', 
    'monthly': 'Monthly',
    'quarterly': 'Quarterly',
    'yearly': 'Yearly'
  },
  he: {
    // Patient metrics
    'patient_satisfaction': 'שביעות רצון מטופלים',
    'wait_time': 'זמן המתנה',
    'readmission_rate': 'שיעור אשפוזים חוזרים',
    'length_of_stay': 'משך שהות',
    'mortality_rate': 'שיעור תמותה',
    
    // Departments  
    'cardiology': 'קרדיולוגיה',
    'emergency': 'מחלקת חירום',
    'surgery': 'כירורגיה',
    'pediatrics': 'ילדים',
    
    // Time periods
    'daily': 'יומי',
    'weekly': 'שבועי',
    'monthly': 'חודשי', 
    'quarterly': 'רבעוני',
    'yearly': 'שנתי'
  }
};
```

### Number and Date Formatting

#### Hebrew Number Formatting
```javascript
const formatNumberForLocale = (number, language, type = 'decimal') => {
  const locale = language === 'he' ? 'he-IL' : 'en-US';
  
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: language === 'he' ? 'ILS' : 'USD',
        currencyDisplay: 'symbol'
      }).format(number);
      
    case 'percentage':
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(number / 100);
      
    case 'medical':
      // Special formatting for medical values
      return language === 'he' 
        ? `${number.toLocaleString('he-IL')}` 
        : number.toLocaleString('en-US');
        
    default:
      return number.toLocaleString(locale);
  }
};
```

#### Hebrew Date Formatting
```javascript
const formatDateForLocale = (date, language, format = 'short') => {
  const locale = language === 'he' ? 'he-IL' : 'en-US';
  
  const options = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    medium: { day: 'numeric', month: 'short', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }
  };
  
  const formatter = new Intl.DateTimeFormat(locale, options[format]);
  return formatter.format(new Date(date));
};
```

### RTL Dashboard Layouts

#### Responsive RTL Grid
```javascript
const RTLDashboardGrid = ({ children, language }) => {
  const isRTL = language === 'he';
  
  return (
    <div 
      className={`dashboard-grid ${isRTL ? 'rtl' : 'ltr'}`}
      style={{
        direction: isRTL ? 'rtl' : 'ltr',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1rem',
        // RTL-specific adjustments
        ...(isRTL && {
          paddingRight: '1rem',
          paddingLeft: 0
        })
      }}
    >
      {children}
    </div>
  );
};
```

### Localized Chart Components

#### Multilingual Chart Wrapper
```javascript
const LocalizedChart = ({ 
  data, 
  type, 
  titleKey, 
  xAxisLabelKey, 
  yAxisLabelKey,
  language 
}) => {
  const { t } = useTranslation();
  const isRTL = language === 'he';
  
  const localizedConfig = {
    ...getRTLChartConfig({
      plugins: {
        title: {
          display: true,
          text: t(titleKey),
          align: isRTL ? 'end' : 'start'
        },
        legend: {
          rtl: isRTL,
          textDirection: isRTL ? 'rtl' : 'ltr'
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: t(xAxisLabelKey)
          },
          position: 'bottom'
        },
        y: {
          title: {
            display: true,
            text: t(yAxisLabelKey)
          },
          position: isRTL ? 'right' : 'left'
        }
      }
    }, language),
    
    // Localize data labels
    data: {
      ...data,
      datasets: data.datasets.map(dataset => ({
        ...dataset,
        label: t(dataset.labelKey || dataset.label)
      }))
    }
  };
  
  return (
    <div className={`chart-container ${isRTL ? 'rtl' : 'ltr'}`}>
      <ResponsiveChart
        type={type}
        data={localizedConfig.data}
        config={localizedConfig}
      />
    </div>
  );
};
```

### Cultural Adaptations

#### Israeli Healthcare Context
```javascript
const israeliHealthcareConfig = {
  healthFunds: ['כללית', 'מכבי', 'מאוחדת', 'לאומית'],
  workingHours: {
    sunday: { start: '08:00', end: '16:00' },
    monday: { start: '08:00', end: '16:00' },
    tuesday: { start: '08:00', end: '16:00' },
    wednesday: { start: '08:00', end: '16:00' },
    thursday: { start: '08:00', end: '16:00' },
    friday: { start: '08:00', end: '12:00' }, // Short Friday
    saturday: { closed: true } // Shabbat
  },
  holidays: {
    // Israeli holidays that affect analytics
    roshHashana: 'ראש השנה',
    yomKippur: 'יום כיפור',
    passover: 'פסח'
  }
};
```

#### US Healthcare Context
```javascript
const usHealthcareConfig = {
  insuranceTypes: ['Medicare', 'Medicaid', 'Private', 'Self-pay'],
  workingHours: {
    monday: { start: '09:00', end: '17:00' },
    tuesday: { start: '09:00', end: '17:00' },
    wednesday: { start: '09:00', end: '17:00' },
    thursday: { start: '09:00', end: '17:00' },
    friday: { start: '09:00', end: '17:00' },
    saturday: { closed: true },
    sunday: { closed: true }
  },
  holidays: {
    // US holidays that affect analytics
    thanksgiving: 'Thanksgiving',
    christmas: 'Christmas',
    newYear: 'New Year\'s Day'
  }
};
```

### Analytics Function Localization (Added to agentServiceV4.js)
```javascript
// Localized analytics functions
{
  name: "generateLocalizedChart",
  description: isHebrew ? "צור תרשים מותאם לשפה ותרבות" : "Generate localized chart",
  parameters: {
    type: "object",
    properties: {
      chartType: { type: "string", description: isHebrew ? "סוג תרשים" : "Chart type" },
      dataSource: { type: "string", description: isHebrew ? "מקור נתונים" : "Data source" },
      language: { type: "string", enum: ["he", "en"], description: isHebrew ? "שפת התרשים" : "Chart language" },
      culturalContext: { type: "string", enum: ["IL", "US"], description: isHebrew ? "הקשר תרבותי" : "Cultural context" },
      rtlLayout: { type: "boolean", description: isHebrew ? "פריסה מימין לשמאל" : "Right-to-left layout" }
    },
    required: ["chartType", "dataSource", "language"]
  }
}
```

## Success Criteria
- ✅ Perfect RTL layout support for Hebrew analytics with proper text direction
- ✅ Culturally appropriate number, date, and currency formatting
- ✅ Complete Hebrew translation of all medical and analytics terminology
- ✅ Charts and dashboards that work seamlessly in both Hebrew and English
- ✅ Cultural adaptations for Israeli and US healthcare contexts
- ✅ Smooth language switching without losing analytics context
- ✅ Mobile-optimized RTL experience for Hebrew users
- ✅ Accessibility compliance for both Hebrew and English interfaces