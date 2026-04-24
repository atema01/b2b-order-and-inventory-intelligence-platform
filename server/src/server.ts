import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import http from 'http';
import pool from './config/db';
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
import aiRoutes from './routes/aiRoutes';
import { ensureFinanceSchema } from './utils/ensureFinanceSchema';
import { ensureForecastSchema } from './utils/ensureForecastSchema';
import { startForecastScheduler } from './services/forecastScheduler';
import { initializeRealtime } from './services/realtime';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!isProduction) {
  allowedOrigins.push('http://localhost:3000');
  allowedOrigins.push('http://localhost:5173');
}

app.use(helmet());
app.set('trust proxy', 1);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

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
app.use('/api/ai', aiRoutes);

app.get('/api', (req, res) => {
  res.json({
    message: 'B2B Platform API is running!',
    timestamp: new Date().toISOString(),
    dbConnected: Boolean(pool)
  });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({ success: true, dbTime: result.rows[0].now });
  } catch (err) {
    console.error('DB test error:', err);
    res.status(500).json({ success: false, error: 'Database unreachable' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', requested: req.originalUrl });
});

const startServer = async () => {
  try {
    await ensureFinanceSchema();
    console.log('Finance schema verified');

    await ensureForecastSchema();
    console.log('Forecast schema verified');

    initializeRealtime(httpServer, allowedOrigins);

    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api`);
      startForecastScheduler();
    });
  } catch (err) {
    console.error('Failed to verify server schema:', err);
    process.exit(1);
  }
};

startServer();
