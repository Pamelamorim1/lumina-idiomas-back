const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const db = require('./config/database');
const storageService = require('./services/storage.service');

const app = express();
const PORT = process.env.PORT || 3333;

// Middleware setup for security and data parsing
app.use(helmet());
app.use(cors({
  origin: '*', // Adjust to frontend domain once configured
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

storageService.ensureUploadDirs();
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '7d',
  etag: true,
}));

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

// Load authentication routes
const authRoutes = require('./routes/auth.routes');
app.use('/auth', authRoutes);

// API Base Health Check
app.get('/health', async (req, res, next) => {
  try {
    // Check database connectivity using Prisma
    await db.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: 'Server is healthy and connected to PostgreSQL.',
      data: {
        timestamp: new Date(),
        uptime: process.uptime()
      }
    });
  } catch (error) {
    next(error);
  }
});

const initDb = require('./config/init-db');

// Global Error Handler (Hiding internal Stack Traces to prevent data leaks)
app.use((err, req, res, next) => {
  console.error('[Error Handler]', err);
  
  const status = err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.status(status).json({
    success: false,
    message: isProduction ? 'Internal Server Error' : err.message,
    data: null
  });
});

async function startServer() {
  try {
    // Run database schema initialization
    await initDb();
  } catch (err) {
    console.error('[Startup] Warning: Database initialization failed. Server starting anyway:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`[Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

startServer();

module.exports = app;

