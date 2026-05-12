// backend/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const verifyRouter = require('./routes/verify');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

// Routes
app.use('/api', verifyRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    services: {
      nodejs: 'running',
      pythonService: process.env.PYTHON_SERVICE_URL,
      ollama: process.env.OLLAMA_HOST
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// CRITICAL FIX: Added '0.0.0.0' to allow Emulator/Mobile access
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Fact-Checking System Backend`);
  console.log(`📍 Network Access: http://10.0.2.2:${PORT}`);
  console.log(`📍 Local Access:   http://localhost:${PORT}`);
  console.log(`🦙 Ollama: ${process.env.OLLAMA_HOST}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV}\n`);
});

module.exports = app;