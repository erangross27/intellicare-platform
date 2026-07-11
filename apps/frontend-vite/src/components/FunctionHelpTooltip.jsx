import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../config/languagesStatic';
import platformFunctionHelpService from '../services/platformFunctionHelpService';
import './FunctionHelpTooltip.css';

/**
 * Interactive Function Help Tooltip
 * Shows detailed explanations for platform functions during chat
 * Provides step-by-step guidance for doctors and medical staff
 */
const FunctionHelpTooltip = ({ currentMessage, onSendMessage, isVisible = true }) => {
  const { currentLanguage, isRTL } = useLanguage();
  const [activeFunction, setActiveFunction] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  console.log('🔍 FunctionHelpTooltip rendering:', { isVisible, isMinimized, currentLanguage });

  // Detect function from message
  useEffect(() => {
    if (currentMessage) {
      const detectedFunctions = platformFunctionHelpService.getContextualHelp(
        currentMessage, 
        currentLanguage
      );
      
      if (detectedFunctions.length > 0) {
        const tooltip = platformFunctionHelpService.showFunctionTooltip(
          detectedFunctions[0], 
          currentLanguage
        );
        setTooltipData(tooltip);
        setActiveFunction(detectedFunctions[0]);
        setShowPulse(true);
        setTimeout(() => setShowPulse(false), 5000);
      }
    }
  }, [currentMessage, currentLanguage]);

  // Listen for tooltip updates
  useEffect(() => {
    const handleTooltipUpdate = (event) => {
      const tooltip = event.detail;
      if (tooltip.hidden) {
        setTooltipData(null);
        setActiveFunction(null);
      } else {
        setTooltipData(tooltip);
        setShowPulse(true);
        setTimeout(() => setShowPulse(false), 5000);
      }
    };

    window.addEventListener('functionTooltipUpdate', handleTooltipUpdate);
    return () => {
      window.removeEventListener('functionTooltipUpdate', handleTooltipUpdate);
    };
  }, []);

  const { t } = useLanguage();
  const allHelp = platformFunctionHelpService.getAllFunctionHelp(currentLanguage);
  const isHebrew = currentLanguage === 'he';

  // Search functions
  const searchResults = searchQuery 
    ? platformFunctionHelpService.searchFunctions(searchQuery, currentLanguage)
    : [];

  // Handle quick action click
  const handleQuickAction = (action) => {
    if (onSendMessage) {
      onSendMessage(action);
    }
  };

  // Handle category selection
  const handleCategorySelect = (categoryKey) => {
    setSelectedCategory(categoryKey === selectedCategory ? null : categoryKey);
  };

  // Handle function selection
  const handleFunctionSelect = (functionKey) => {
    const tooltip = platformFunctionHelpService.showFunctionTooltip(functionKey, currentLanguage);
    setTooltipData(tooltip);
    setActiveFunction(functionKey);
  };

  if (!isVisible || isMinimized) {
    // Show minimized button
    return (
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed',
          bottom: '30px',
          [isRTL ? 'right' : 'left']: '30px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #8b5cf6, #2a5298)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)',
          zIndex: 1000
        }}
      >
        💡
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="function-help-tooltip"
        style={{
          position: 'fixed',
          bottom: '30px',
          [isRTL ? 'right' : 'left']: '30px',
          width: '420px',
          maxHeight: '600px',
          zIndex: 1000,
          direction: isRTL ? 'rtl' : 'ltr'
        }}
      >
        <div className="tooltip-container">
          {/* Pulse effect */}
          {showPulse && (
            <div className="pulse-effect" />
          )}

          {/* Header */}
          <div className="tooltip-header">
            <div className="header-content">
              <h3>
                💡 {isHebrew ? 'עזרה חכמה' : 'Smart Help'}
              </h3>
              <span className="subtitle">
                {isHebrew ? 'לחץ על פונקציה למידע מפורט' : 'Click function for details'}
              </span>
            </div>
            <button 
              className="minimize-btn"
              onClick={() => setIsMinimized(true)}
            >
              －
            </button>
          </div>

          {/* Search Bar */}
          <div className="search-container">
            <input
              type="text"
              placeholder={isHebrew ? '🔍 חפש פונקציה...' : '🔍 Search function...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Content */}
          <div className="tooltip-content">
            {searchQuery && searchResults.length > 0 ? (
              // Search Results
              <div className="search-results">
                <h4>{isHebrew ? 'תוצאות חיפוש:' : 'Search Results:'}</h4>
                {searchResults.map((result, index) => (
                  <div 
                    key={index}
                    className="search-result-item"
                    onClick={() => handleFunctionSelect(result.functionKey)}
                  >
                    <strong>{result.name}</strong>
                    <span className="category-tag">{result.category}</span>
                    <p>{result.description}</p>
                  </div>
                ))}
              </div>
            ) : tooltipData ? (
              // Active Function Details
              <div className="function-details">
                <h4>{tooltipData.title}</h4>
                <p className="description">{tooltipData.description}</p>
                
                {/* How to Use */}
                <div className="section">
                  <h5>{isHebrew ? '🎯 איך להשתמש:' : '🎯 How to Use:'}</h5>
                  <p>{tooltipData.howToUse}</p>
                </div>

                {/* Examples */}
                {tooltipData.examples && (
                  <div className="section">
                    <h5>{isHebrew ? '📝 דוגמאות:' : '📝 Examples:'}</h5>
                    <ul className="examples-list">
                      {tooltipData.examples.map((example, idx) => (
                        <li 
                          key={idx}
                          onClick={() => handleQuickAction(example)}
                          className="clickable-example"
                        >
                          "{example}"
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tips */}
                {tooltipData.tips && tooltipData.tips.length > 0 && (
                  <div className="section tips">
                    <h5>{isHebrew ? '💡 טיפים:' : '💡 Tips:'}</h5>
                    {tooltipData.tips.map((tip, idx) => (
                      <p key={idx} className="tip">{tip}</p>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {tooltipData.warnings && tooltipData.warnings.length > 0 && (
                  <div className="section warnings">
                    <h5>{isHebrew ? '⚠️ אזהרות:' : '⚠️ Warnings:'}</h5>
                    {tooltipData.warnings.map((warning, idx) => (
                      <p key={idx} className="warning">{warning}</p>
                    ))}
                  </div>
                )}

                {/* Quick Actions */}
                {tooltipData.quickActions && tooltipData.quickActions.length > 0 && (
                  <div className="quick-actions">
                    <h5>{isHebrew ? '⚡ פעולות מהירות:' : '⚡ Quick Actions:'}</h5>
                    <div className="action-buttons">
                      {tooltipData.quickActions.map((action, idx) => (
                        <button
                          key={idx}
                          className="quick-action-btn"
                          onClick={() => handleQuickAction(action.action)}
                        >
                          {action.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Category List
              <div className="categories-list">
                {Object.entries(allHelp).map(([categoryKey, category]) => (
                  <div key={categoryKey} className="category-section">
                    <div 
                      className={`category-header ${selectedCategory === categoryKey ? 'expanded' : ''}`}
                      onClick={() => handleCategorySelect(categoryKey)}
                    >
                      <span className="category-icon">{category.icon}</span>
                      <span className="category-name">{category.category}</span>
                      <span className="expand-icon">
                        {selectedCategory === categoryKey ? '▼' : '▶'}
                      </span>
                    </div>
                    
                    {selectedCategory === categoryKey && (
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        className="category-functions"
                      >
                        {Object.entries(category.functions).map(([funcKey, func]) => (
                          <div
                            key={funcKey}
                            className="function-item"
                            onClick={() => handleFunctionSelect(funcKey)}
                          >
                            <strong>{func.name}</strong>
                            <p>{func.description}</p>
                            <span className="trigger-hint">
                              {isHebrew ? 'נסה:' : 'Try:'} "{func.trigger}"
                            </span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with Help Button */}
          <div className="tooltip-footer">
            <button 
              className="help-btn"
              onClick={() => {
                const helpMessage = platformFunctionHelpService.getHelpMessage(null, currentLanguage);
                if (onSendMessage) {
                  onSendMessage('help');
                }
              }}
            >
              {isHebrew ? '❓ עזרה כללית' : '❓ General Help'}
            </button>
            <span className="status">
              {isHebrew 
                ? `${Object.keys(allHelp).length} קטגוריות זמינות`
                : `${Object.keys(allHelp).length} categories available`}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FunctionHelpTooltip;