import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Force a SINGLE React instance across all transitive deps. Without this, Vite's
  // dep optimizer can serve a second URL-distinct copy (react.js?v=<hash>) to a
  // freshly lazy-loaded chunk, giving a null hook dispatcher -> "Invalid hook call /
  // Cannot read properties of null (reading 'useState')" (hit on BunionSurgeryEvaluation).
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  // Pre-bundle @react-pdf/renderer at server start so the optimizer doesn't re-run
  // mid-session (which forces a reload and leaves the page in a mixed-hash React state).
  optimizeDeps: {
    include: ['@react-pdf/renderer'],
  },
  build: {
    // Suppress chunk size warnings - medical apps are large by nature
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        // Manual chunks for better code splitting
        manualChunks: (id) => {
          // All vendor dependencies in one chunk to avoid circular dependencies
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          // Application chunks
          if (id.includes('/chat/')) {
            return 'chat';
          }
          // PDF templates chunk
          if (id.includes('/pdf-templates/')) {
            return 'pdf-templates';
          }
        },
        // Use content hash for better caching
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    },
    // Vite 8's default minifier is Oxc (esbuild is no longer bundled with Vite)
    minify: 'oxc'
  },
  server: {
    port: 3000,
    host: '0.0.0.0', // Bind on all interfaces - subdomains resolved via hosts file
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../backend-api/certs/key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../backend-api/certs/cert.pem'))
    },
    allowedHosts: [
      'localhost',
      'intellicare.health',
      '.intellicare.health', // Allow all subdomains
      'lvh.me',
      '.lvh.me' // Allow all subdomains of lvh.me - NO HOSTS FILE NEEDED!
    ],
    proxy: {
      '/api': {
        target: 'https://127.0.0.1:5000', // Use HTTPS
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // CRITICAL: Get the original host from multiple possible sources
            // HTTP/2 uses :authority pseudo-header, which may not be in req.headers.host
            // Try to extract from referer header as fallback
            let originalHost = req.headers['x-forwarded-host'] ||
                              req.headers.host;

            // If no host header, try to extract from origin
            if (!originalHost && req.headers.origin) {
              try {
                originalHost = new URL(req.headers.origin).host;
              } catch (e) {
                // Silent fail - will try referer next
              }
            }

            // If still no host, try to extract from referer
            if (!originalHost && req.headers.referer) {
              try {
                originalHost = new URL(req.headers.referer).host;
              } catch (e) {
                // Silent fail
              }
            }

            // CRITICAL: Preserve Origin header for CORS and cookie domain detection
            const origin = req.headers.origin || (originalHost ? `https://${originalHost}` : 'https://intellicare.health:3000');
            proxyReq.setHeader('Origin', origin);

            // CRITICAL: Preserve Host header for cookie domain detection
            // This ensures backend sees the original subdomain
            if (originalHost) {
              proxyReq.setHeader('Host', originalHost);
            }
            
            // Fix Content-Type header for JSON requests
            if (req.headers['content-type'] && req.headers['content-type'].includes('text/plain')) {
              // Check if body looks like JSON
              let body = '';
              req.on('data', chunk => body += chunk);
              req.on('end', () => {
                try {
                  JSON.parse(body);
                  // It's JSON, fix the content-type
                  proxyReq.setHeader('Content-Type', 'application/json');
                  console.log('🔧 Fixed Content-Type: text/plain -> application/json');
                } catch (e) {
                  // Not JSON, leave as is
                }
              });
            }
          });
          proxy.on('error', (err, req, res) => {
            console.error('❌ VITE PROXY ERROR:', err.message, 'for', req.url);
          });
        }
      },
      '/ws': {
        target: 'https://127.0.0.1:5000',
        changeOrigin: true,
        ws: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            const isExpected = err.message?.includes('ECONNRESET') || err.message?.includes('socket has been ended');
            if (!isExpected) {
              console.error('❌ WS proxy error:', err.message);
            }
          });
        }
      },
      '/socket.io': {
        target: 'https://127.0.0.1:5000',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxy
        secure: false,
        // Increase timeout and add heartbeat for long-running connections
        timeout: 60000,
        proxyTimeout: 60000,
        configure: (proxy, options) => {
          proxy.on('upgrade', (req, socket, head) => {
            console.log('🔌 WebSocket upgrade:', req.url);
          });
          proxy.on('error', (err, req, res) => {
            // Only log non-transient errors (ignore expected disconnections)
            const isExpectedError = 
              err.message?.includes('socket has been ended') ||
              err.message?.includes('ECONNRESET') ||
              err.message?.includes('EPIPE');
            
            if (!isExpectedError) {
              console.log('❌ Socket.IO proxy error:', err.message);
            }
          });
          // Handle proxy response for better connection stability
          proxy.on('proxyRes', (proxyRes, req, res) => {
            proxyRes.on('error', (err) => {
              // Silently handle response errors to prevent crash
            });
          });
        }
      }
    }
  }
})
