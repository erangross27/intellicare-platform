import React, { useState } from 'react';

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊',
      '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋',
      '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '😐',
      '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔',
      '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥴', '😵',
      '🤯', '🥳', '🥸', '😎', '🤓', '🧐', '😱', '😨', '😰', '😢'
    ]
  },
  {
    name: 'Gestures',
    emojis: [
      '👍', '👎', '👌', '🤌', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙',
      '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🫶', '🤝', '🙏',
      '✍️', '💪', '🦾', '🫡', '🫂', '❤️', '🧡', '💛', '💚', '💙',
      '💜', '🖤', '🤍', '💯', '💥', '💫', '⭐', '🌟', '✨', '🔥',
      '💪', '🎯', '✅', '❌', '⚠️', '📌', '📎', '💡', '🔔', '📢'
    ]
  },
  {
    name: 'Medical',
    emojis: [
      '🏥', '💊', '💉', '🩺', '🩻', '🩹', '🧬', '🔬', '🧪', '🫀',
      '🫁', '🧠', '🦷', '🦴', '👁️', '🩸', '🏃', '🧘', '🍎', '🥗'
    ]
  }
];

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function EmojiPicker({ onSelect, onClose, language = 'en' }) {
  const [activeCategory, setActiveCategory] = useState(0);

  const t = (en, he) => language === 'he' ? he : en;

  return (
    <div className="sc-emoji-picker" onClick={e => e.stopPropagation()}>
      {/* Category tabs */}
      <div className="sc-emoji-tabs">
        {EMOJI_CATEGORIES.map((cat, idx) => (
          <button
            key={cat.name}
            className={`sc-emoji-tab ${activeCategory === idx ? 'active' : ''}`}
            onClick={() => setActiveCategory(idx)}
          >
            {cat.name === 'Smileys' ? '😀' : cat.name === 'Gestures' ? '👍' : '🏥'}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="sc-emoji-grid">
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, idx) => (
          <button
            key={idx}
            className="sc-emoji-item"
            onClick={() => { onSelect(emoji); onClose(); }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export { QUICK_REACTIONS };
