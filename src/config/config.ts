import dotenv from 'dotenv';

// Only load .env file in development/local environments
// Vercel automatically injects environment variables in production
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  dotenv.config();
}

interface Config {
  port: number;
  nodeEnv: string;
  database_url: string;
}

const config: Config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  database_url: process.env.DATABASE_URL || '',
};

export default config;