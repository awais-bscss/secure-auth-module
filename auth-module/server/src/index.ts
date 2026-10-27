import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { connectDB } from './db/connect';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';

// Fail-fast environment variable validation
const requiredEnvVars = [
  'PORT',
  'CLIENT_ORIGIN',
  'MONGODB_URI',
  'ACCESS_TOKEN_SECRET',
  'REFRESH_TOKEN_SECRET',
];

const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`[Server Config] Fatal Error: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const app = express();
const port = parseInt(process.env.PORT || '4000', 10);
const clientOrigin = process.env.CLIENT_ORIGIN!;

// Security headers with helmet
app.use(helmet());

// CORS configuration - strict origin lock with credentials
app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Mount routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: 'The requested route does not exist',
  });
});

// Start server only after DB connection succeeds
async function startServer(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI!;
  await connectDB(mongoUri);

  app.listen(port, () => {
    console.log(`[Server] Auth module server running on http://localhost:${port}`);
    console.log(`[Server] Allowing CORS requests strictly from: ${clientOrigin}`);
  });
}

startServer();
