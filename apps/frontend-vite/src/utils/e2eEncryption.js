/**
 * End-to-End Encryption Utilities
 * Encrypts sensitive data before sending to server
 */

// Generate RSA key pair for the session
export const generateKeyPair = async () => {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Export public key for server
    const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKey)));
    
    return {
      keyPair,
      publicKeyBase64
    };
  } catch (error) {
    process.env.NODE_ENV !== 'production' && console.error('Failed to generate key pair:', error);
    return null;
  }
};

// Encrypt password with AES-256-GCM
export const encryptPassword = async (password) => {
  try {
    // Generate random key and IV
    const key = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // Encrypt the password
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    // Export key for transmission
    const exportedKey = await window.crypto.subtle.exportKey('raw', key);
    
    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return {
      encrypted: btoa(String.fromCharCode(...combined)),
      key: btoa(String.fromCharCode(...new Uint8Array(exportedKey)))
    };
  } catch (error) {
    process.env.NODE_ENV !== 'production' && console.error('Encryption failed:', error);
    return null;
  }
};

// Hash password with PBKDF2 for additional security
export const hashPassword = async (password, salt = null) => {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // Generate or use provided salt
    const saltBytes = salt 
      ? new Uint8Array(atob(salt).split('').map(c => c.charCodeAt(0)))
      : window.crypto.getRandomValues(new Uint8Array(16));
    
    // Import password as key
    const passwordKey = await window.crypto.subtle.importKey(
      'raw',
      data,
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    // Derive bits using PBKDF2
    const derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      256
    );
    
    return {
      hash: btoa(String.fromCharCode(...new Uint8Array(derivedBits))),
      salt: btoa(String.fromCharCode(...saltBytes))
    };
  } catch (error) {
    process.env.NODE_ENV !== 'production' && console.error('Hashing failed:', error);
    return null;
  }
};

// Create encrypted payload for transmission
export const createEncryptedPayload = async (data) => {
  const payload = {
    timestamp: Date.now(),
    data: data,
    nonce: btoa(String.fromCharCode(...window.crypto.getRandomValues(new Uint8Array(16))))
  };
  
  // Encrypt sensitive fields
  if (data.password) {
    const encrypted = await encryptPassword(data.password);
    if (encrypted) {
      payload.data.password = encrypted.encrypted;
      payload.encryptionKey = encrypted.key;
      payload.encrypted = true;
    }
  }
  
  return payload;
};

// Verify server response signature
export const verifyServerSignature = async (data, signature, publicKey) => {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));
    const signatureBuffer = new Uint8Array(atob(signature).split('').map(c => c.charCodeAt(0)));
    
    const cryptoKey = await window.crypto.subtle.importKey(
      'spki',
      new Uint8Array(atob(publicKey).split('').map(c => c.charCodeAt(0))),
      {
        name: 'RSA-PSS',
        hash: 'SHA-256'
      },
      false,
      ['verify']
    );
    
    const valid = await window.crypto.subtle.verify(
      {
        name: 'RSA-PSS',
        saltLength: 32
      },
      cryptoKey,
      signatureBuffer,
      dataBuffer
    );
    
    return valid;
  } catch (error) {
    process.env.NODE_ENV !== 'production' && console.error('Signature verification failed:', error);
    return false;
  }
};

// Secure session storage with encryption
export const secureStorage = {
  setItem: async (key, value) => {
    try {
      const encrypted = await encryptPassword(JSON.stringify(value));
      if (encrypted) {
        secureStorage.setItem(key, JSON.stringify(encrypted));
      }
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Secure storage failed:', error);
    }
  },
  
  getItem: async (key) => {
    try {
      const stored = secureStorage.getItem(key);
      if (!stored) return null;
      
      // For now, return as-is (decryption would need the key)
      // In production, you'd store the key securely
      return JSON.parse(stored);
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error('Secure retrieval failed:', error);
      return null;
    }
  },
  
  removeItem: (key) => {
    secureStorage.removeItem(key);
  }
};

// Generate secure random token
export const generateSecureToken = () => {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
};

// Validate password strength
export const validatePasswordStrength = (password) => {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };
  
  const score = Object.values(checks).filter(Boolean).length;
  
  return {
    checks,
    score,
    isStrong: score >= 4,
    message: score < 3 ? 'Weak' : score < 4 ? 'Medium' : 'Strong'
  };
};