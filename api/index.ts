// api/index.ts
// Explicitly import pg to ensure it's bundled with the function
import 'pg';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../src/app';
import { connectDatabase } from '../src/config/database';

let ready: Promise<void> | null = null;
let isConnecting = false;

const ensureReady = async (): Promise<void> => {
  if (ready) {
    return ready;
  }
  
  if (isConnecting) {
    // Wait for existing connection attempt
    while (isConnecting && !ready) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (ready) return ready;
  }
  
  isConnecting = true;
  ready = connectDatabase()
    .then(() => {
      isConnecting = false;
      return;
    })
    .catch((error) => {
      isConnecting = false;
      ready = null; // Reset so we can retry
      throw error;
    });
  
  return ready;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensureReady();
    return app(req as any, res as any);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}