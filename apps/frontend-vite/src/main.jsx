import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';

const root = ReactDOM.createRoot(document.getElementById('root'));
// 🎯 DISABLED: React.StrictMode disabled to prevent duplicate API calls in development
root.render(
  <App />
);
