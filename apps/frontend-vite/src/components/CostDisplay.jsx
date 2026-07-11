import React, { useState, useEffect } from 'react';
import './CostDisplay.css';
import secureApi from '../services/secureApiClient';

import secureStorage from '../utils/secureStorage';
const CostDisplay = ({ practiceId, userId, sessionId, language = 'he', showGlobalTotal = false }) => {
  const [totalCost, setTotalCost] = useState('$0.00'); // Default to USD, backend will update with correct currency
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch cost data - USING SECURE API CLIENT
  const fetchCosts = async () => {
    try {
      const token = secureStorage.getItem('token');
      
      // Don't fetch if no token
      if (!token) {
        process.env.NODE_ENV !== 'production' && console.log('No token, skipping cost fetch');
        return;
      }
      
      const actualPracticeId = practiceId || secureStorage.getItem('practiceSubdomain') || 'default';
      
      // Determine which endpoint to use
      const endpoint = showGlobalTotal 
        ? '/cost-tracking/total'
        : `/cost-tracking/practice/${actualPracticeId}`;
      
      setIsUpdating(true);
      
      // 🔒 SECURE API: Using secureApiClient instead of fetch()
      const response = await secureApi.get(endpoint);
      
      // Response is already parsed JSON from secureApiClient
      const data = response.data || response;

      if (data.success) {
        if (showGlobalTotal && data.totalAmount) {
          // Display global total amount
          setTotalCost(data.totalAmount.totalAmountDisplay || '$0.00');
        } else if (data.totals) {
          // Display practice-specific amount from /practice endpoint
          setTotalCost(data.totals.totalCostDisplay || '$0.00');
        } else if (data.report) {
          // Display practice-specific amount from /report endpoint
          const report = data.report;
          setTotalCost(report.summary?.totalCost || '$0.00');
        }
        setLastUpdate(new Date());
      }
      setIsUpdating(false);
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Error fetching costs:', error);
      setIsUpdating(false);
    }
  };

  // Update costs from chat response
  const updateFromChatResponse = (costInfo) => {
    process.env.NODE_ENV !== 'production' && console.log('💰 CostDisplay received update:', costInfo);
    if (costInfo?.practiceTotals?.overall) {
      // Use totalCostDisplay which should have the correct currency from backend
      const newCost = costInfo.practiceTotals.overall.totalCostDisplay || '$0.00';
      process.env.NODE_ENV !== 'production' && console.log('💰 Updating display to:', newCost);
      setTotalCost(newCost);
      setLastUpdate(new Date());
      // Trigger animation
      setIsUpdating(true);
      setTimeout(() => setIsUpdating(false), 500);
    } else {
      process.env.NODE_ENV !== 'production' && console.warn('⚠️ Cost info missing practiceTotals.overall:', costInfo);
    }
  };

  // Listen for cost updates from parent
  useEffect(() => {
    window.updateCostDisplay = updateFromChatResponse;
    return () => {
      delete window.updateCostDisplay;
    };
  }, []);

  // Fetch initial data and set up auto-refresh
  useEffect(() => {
    const token = secureStorage.getItem('token');
    
    // Only set up fetching if we have a token
    if (token) {
      // Fetch immediately
      fetchCosts();
      
      // Refresh every 30 seconds (reduced frequency to avoid security warnings)
      const interval = setInterval(fetchCosts, 30000);
      
      return () => clearInterval(interval);
    }
  }, [practiceId]);

  return (
    <div className={`cost-display-minimal ${isUpdating ? 'updating' : ''}`}>
      <span className="cost-icon">💰</span>
      <span className="cost-amount">{totalCost}</span>
    </div>
  );
};

export default CostDisplay;