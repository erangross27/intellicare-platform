import { useState, useRef, useCallback, useEffect } from 'react';
import secureApi from '../services/secureApiClient';
import secureStorage from '../utils/secureStorage';

/**
 * useVoiceMode — manages on-demand TTS playback for agent messages.
 * Doctor clicks a speaker icon on any agent message to hear it read aloud.
 * Clicking again (stop icon) stops playback.
 * Reads voice preferences (voiceId, modelId, ttsEnabled) from secureStorage.
 * On mount, syncs TTS preferences from MongoDB to secureStorage so they
 * persist across browser sessions.
 */
export function useVoiceMode() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [ttsEnabled, setTtsEnabled] = useState(() => secureStorage.getItem('ttsEnabled') !== 'false');
  const audioRef = useRef(null);
  const abortRef = useRef(null);
  const syncedRef = useRef(false);

  // On mount, fetch TTS preferences from DB and sync to secureStorage
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    secureApi.get('/api/user/settings').then(res => {
      const tts = res?.user?.ttsPreferences;
      if (tts) {
        if (tts.voiceId) secureStorage.setItem('ttsVoiceId', tts.voiceId);
        if (tts.modelId) secureStorage.setItem('ttsModelId', tts.modelId);
        if (tts.enabled !== undefined) {
          secureStorage.setItem('ttsEnabled', String(tts.enabled));
          setTtsEnabled(tts.enabled);
        }
      }
    }).catch(() => { /* secureStorage fallback is fine */ });
  }, []);

  /**
   * Speak text through TTS on demand (per-message speaker button).
   * @param {string} text - The message text to read aloud
   * @param {string} messageId - The message ID being spoken
   */
  const speakResponse = useCallback(async (text, messageId) => {
    console.log('🔊 [useVoiceMode] speakResponse called:', { textLen: text?.length, messageId });
    if (!text || text.trim().length === 0) return;

    // Abort any in-progress speech
    if (abortRef.current) {
      abortRef.current.abort();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // Read saved voice preferences
    const voiceId = secureStorage.getItem('ttsVoiceId') || undefined;
    const modelId = secureStorage.getItem('ttsModelId') || undefined;

    try {
      setIsSpeaking(true);
      setSpeakingMessageId(messageId);

      console.log('🔊 [useVoiceMode] Calling secureApi.post /api/tts/speak...', { voiceId, modelId });
      const audioBlob = await secureApi.post('/api/tts/speak', {
        text: text.trim(),
        ...(voiceId && { voiceId }),
        ...(modelId && { modelId }),
      }, {
        responseType: 'blob',
        signal: controller.signal,
      });

      console.log('🔊 [useVoiceMode] TTS response received, blob size:', audioBlob?.size);
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      audio.onerror = (e) => {
        console.error('🔊 [useVoiceMode] Audio playback error:', e);
        setIsSpeaking(false);
        setSpeakingMessageId(null);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      await audio.play();
      console.log('🔊 [useVoiceMode] Audio playing!');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('🔊 [useVoiceMode] TTS error:', err);
      }
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  }, []);

  /**
   * Stop any in-progress speech immediately.
   */
  const stopSpeaking = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setSpeakingMessageId(null);
  }, []);

  return {
    isSpeaking,
    ttsEnabled,
    speakingMessageId,
    speakResponse,
    stopSpeaking,
  };
}
