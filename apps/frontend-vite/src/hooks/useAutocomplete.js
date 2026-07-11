import { useState, useRef, useCallback, useEffect } from 'react';

const useAutocomplete = ({
  text = '',
  cursorPosition = 0,
  patientContext = null,
  visitTranscript = '',
  enabled = true,
  debounceMs = 300,
}) => {
  const [suggestion, setSuggestion] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const cacheRef = useRef(new Map());

  const fetchPrediction = useCallback(async (currentText) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const cacheKey = currentText.slice(-50);
    if (cacheRef.current.has(cacheKey)) {
      setSuggestion(cacheRef.current.get(cacheKey));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/autocomplete/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          text: currentText,
          patientId: patientContext?.patientId,
          visitTranscript,
          maxTokens: 50,
        }),
      });

      if (!response.ok) throw new Error('Prediction failed');
      const result = await response.json();

      if (result.success && result.data.prediction) {
        const prediction = result.data.prediction;
        setSuggestion(prediction);
        cacheRef.current.set(cacheKey, prediction);
        if (cacheRef.current.size > 50) {
          const firstKey = cacheRef.current.keys().next().value;
          cacheRef.current.delete(firstKey);
        }
      } else {
        setSuggestion(null);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setSuggestion(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [patientContext, visitTranscript]);

  useEffect(() => {
    if (!enabled || !text || text.length < 10) {
      setSuggestion(null);
      return;
    }

    if (cursorPosition !== text.length) {
      setSuggestion(null);
      return;
    }

    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchPrediction(text);
    }, debounceMs);

    return () => clearTimeout(debounceTimerRef.current);
  }, [text, cursorPosition, enabled, debounceMs, fetchPrediction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const acceptSuggestion = useCallback(() => {
    const accepted = suggestion;
    setSuggestion(null);
    return accepted;
  }, [suggestion]);

  const dismissSuggestion = useCallback(() => {
    setSuggestion(null);
  }, []);

  return {
    suggestion,
    isLoading,
    acceptSuggestion,
    dismissSuggestion,
  };
};

export default useAutocomplete;
