import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import { router } from './routes/routes'
import { protectedRouter } from './routes/protectedroutes'
import docsRouter from './routes/docs'
import { errorHandler } from './middlewares/errorHandler'
import config from './config/config'

const app = express()
// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Configure CORS to allow requests from Vercel domains and localhost
const corsOptions: cors.CorsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow all Vercel domains (preview and production)
    if (origin.includes('.vercel.app') || origin.includes('vercel.app')) {
      return callback(null, true);
    }
    
    // Allow custom domains if needed
    // Add your custom domain here if you have one
    // if (origin.includes('yourdomain.com')) {
    //   return callback(null, true);
    // }
    
    callback(null, true); // Allow all origins for now - adjust as needed
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false, // Let CORS middleware handle preflight
  optionsSuccessStatus: 200, // Some legacy browsers (IE11) choke on 204
};

app.use(cors(corsOptions))

// Explicitly handle OPTIONS requests for all routes (CORS preflight)
// This ensures preflight requests get proper CORS headers
app.options('*', (req: Request, res: Response) => {
  const origin = req.headers.origin;
  
  // Set CORS headers
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  res.status(200).end();
})

// API key auth middleware (to be used only on protected route groups, e.g. `/api`)
const apiAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Allow OPTIONS requests (CORS preflight) to pass through without auth
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!config.apiKey) {
    return res.status(500).json({
      success: false,
      error: 'API key not configured on server',
    });
  }

  const rawHeader = req.headers['x-api-key'];
  let headerKey: string | undefined;

  if (Array.isArray(rawHeader)) {
    headerKey = rawHeader[0];
  } else {
    headerKey = rawHeader as string | undefined;
  }

  const queryKey =
    typeof req.query.apiKey === 'string' ? req.query.apiKey : undefined;

  const apiKey = headerKey || queryKey;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Missing API key',
    });
  }

  if (apiKey !== config.apiKey) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key',
    });
  }

  return next();
};

// Public Routes (no API key required)
/**
 * @openapi
 * /:
 *   get:
 *     summary: Root endpoint
 *     description: Simple health check / welcome message.
 *     responses:
 *       200:
 *         description: Returns a hello world message.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Hello World!
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Hello World!' })
})

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns basic health and runtime information for the server.
 *     responses:
 *       200:
 *         description: Server is healthy.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 message:
 *                   type: string
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    message: 'Server is running and healthy' 
  })
})

// Swagger / API docs routes (public, read-only)
app.use('/api-docs', docsRouter)

// Protected Routes (API key required)
app.use('/api', apiAuthMiddleware, router)
app.use('/api/protected', apiAuthMiddleware, protectedRouter)

// 404 handler (must be after all routes)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  })
})

app.use(errorHandler);

export default app;