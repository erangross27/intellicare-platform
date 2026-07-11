import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useWorkflowStore from '../../stores/workflowStore';

const SpotlightEffect = ({ targetSelector }) => {
  const { activeWorkflow, currentStep } = useWorkflowStore();
  const [targetRect, setTargetRect] = useState(null);
  
  useEffect(() => {
    if (!targetSelector) return;
    
    const updatePosition = () => {
      const elements = document.querySelectorAll(targetSelector);
      if (elements.length > 0) {
        const rects = Array.from(elements).map(el => el.getBoundingClientRect());
        setTargetRect(rects);
      }
    };
    
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);
    
    // Update position periodically in case elements move
    const interval = setInterval(updatePosition, 500);
    
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
      clearInterval(interval);
    };
  }, [targetSelector, currentStep]);
  
  if (!activeWorkflow || !targetRect || targetRect.length === 0) {
    return null;
  }
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 999
        }}
      >
        {/* Dark overlay with holes for spotlights */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
          }}
        >
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {targetRect.map((rect, index) => (
                <motion.rect
                  key={index}
                  x={rect.left - 10}
                  y={rect.top - 10}
                  width={rect.width + 20}
                  height={rect.height + 20}
                  rx="20"
                  fill="black"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                />
              ))}
            </mask>
            
            {/* Animated gradient for glow effect */}
            <radialGradient id="glow-gradient">
              <stop offset="0%" stopColor="#10a37f" stopOpacity="0.6">
                <animate
                  attributeName="stopOpacity"
                  values="0.6;0.8;0.6"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="100%" stopColor="#10a37f" stopOpacity="0" />
            </radialGradient>
          </defs>
          
          {/* Semi-transparent dark overlay */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.3)"
            mask="url(#spotlight-mask)"
          />
          
          {/* Glowing borders around spotlights */}
          {targetRect.map((rect, index) => (
            <g key={`glow-${index}`}>
              {/* Outer glow */}
              <motion.rect
                x={rect.left - 15}
                y={rect.top - 15}
                width={rect.width + 30}
                height={rect.height + 30}
                rx="20"
                fill="none"
                stroke="url(#glow-gradient)"
                strokeWidth="3"
                initial={{ pathLength: 0 }}
                animate={{ 
                  pathLength: 1,
                  strokeDasharray: [0, 1, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: index * 0.2
                }}
                style={{
                  filter: 'blur(5px)'
                }}
              />
              
              {/* Inner border */}
              <rect
                x={rect.left - 10}
                y={rect.top - 10}
                width={rect.width + 20}
                height={rect.height + 20}
                rx="20"
                fill="none"
                stroke="#10a37f"
                strokeWidth="2"
                strokeDasharray="5 5"
                opacity="0.5"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  values="0;10"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </rect>
              
              {/* Pulsing dot indicators */}
              <motion.circle
                cx={rect.left + rect.width / 2}
                cy={rect.top - 25}
                r="8"
                fill="#10a37f"
                initial={{ scale: 0 }}
                animate={{
                  scale: [0, 1.5, 1],
                  opacity: [0, 0.8, 1]
                }}
                transition={{
                  duration: 1,
                  delay: index * 0.2,
                  repeat: Infinity,
                  repeatDelay: 1
                }}
              />
            </g>
          ))}
        </svg>
        
        {/* Ripple effects */}
        {targetRect.map((rect, index) => (
          <motion.div
            key={`ripple-${index}`}
            style={{
              position: 'absolute',
              left: rect.left + rect.width / 2,
              top: rect.top + rect.height / 2,
              width: '100px',
              height: '100px',
              marginLeft: '-50px',
              marginTop: '-50px',
              borderRadius: '50%',
              border: '2px solid #10a37f',
              pointerEvents: 'none'
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{
              scale: [1, 2, 3],
              opacity: [0.6, 0.3, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: index * 0.3
            }}
          />
        ))}
      </motion.div>
    </AnimatePresence>
  );
};

export default SpotlightEffect;