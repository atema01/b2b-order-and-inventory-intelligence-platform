// src/server.ts
// Purpose: Entry point of the backend — sets up Express app and starts server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import pool from './config/db';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import orderRoutes from './routes/orderRoutes';
import buyerRoutes from './routes/buyerRoutes';
import categoryRoutes from './routes/categoryRoutes';
import settingRoutes from './routes/settingRoutes';
import notificationRoutes from './routes/notificationRoutes';
import systemLogRoutes from './routes/systemLogRoutes';
import returnRoutes from './routes/returnRoutes';
import roleRoutes from './routes/roleRoutes';
import staffRoutes from './routes/staffRoutes';
import permissionRoutes from './routes/permissionRoutes';
import creditRoutes from './routes/creditRoutes';
import paymentRoutes from './routes/paymentRoutes';
import pricingRoutes from './routes/pricingRoutes';


// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// ======================
// Middleware Setup
// ======================

// Security: Sets various HTTP headers to protect against common attacks
app.use(helmet());

// Enable CORS: Allows your React frontend (on :5173) to call this backend
app.use(cors({
  origin: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' // Vite default
    : 'https://yourdomain.com', // Later: your production domain
  credentials: true, // Needed if using cookies (we will)
}));

// Logging: Logs every request in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Parse JSON bodies (for POST/PUT requests)
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser()); 
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/system-logs', systemLogRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/pricing', pricingRoutes);
// After all routes, before app.listen
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', requested: req.originalUrl });
});
// ======================
// Basic Routes (for testing)
// ======================

// Health check endpoint — confirms server is running
app.get('/api', (req, res) => {
  res.json({ 
    message: 'B2B Platform API is running!',
    timestamp: new Date().toISOString(),
    dbConnected: pool ? true : false
  });
});

// Test DB connection endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({ success: true, dbTime: result.rows[0].now });
  } catch (err) {
    console.error('DB test error:', err);
    res.status(500).json({ success: false, error: 'Database unreachable' });
  }
});

// ======================
// Start Server
// ======================

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api`);
});
