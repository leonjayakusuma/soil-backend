import express, { NextFunction, Request, Response } from 'express'
import { router } from './routes/routes'
import { protectedRouter } from './routes/protectedroutes'
import docsRouter from './routes/docs'
import { errorHandler } from './middlewares/errorHandler'
import config from './config/config'

const app = express()
// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Helper function to set CORS headers - use this everywhere to ensure consistency
// This function MUST be called before any response is sent
const setCorsHeaders = (req: Request, res: Response): void => {
  // Get origin from headers, or infer from referer if origin is missing
  let origin = req.headers.origin;
  
  // Fallback: try to extract origin from referer header if origin is not present
  if (!origin && req.headers.referer) {
    try {
      origin = req.headers.referer;
    } catch (e) {
      // Invalid referer URL, ignore
    }
  }
  
  // console.log()

  // Set CORS headers - always allow the requesting origin
  // Note: When credentials: true, we must use the specific origin, not '*'
  if (origin) {
    // Always allow Vercel domains and localhost
    const isAllowed = 
      origin.includes('localhost') || 
      origin.includes('127.0.0.1') || 
      origin.includes('.vercel.app') || 
      origin.includes('vercel.app');
    
    if (isAllowed || process.env.NODE_ENV === 'development') {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      // For other origins, allow but without credentials
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  } else {
    // No origin header (e.g., Postman, curl, same-origin) - allow all but no credentials
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
};

// CORS middleware - handle all CORS headers manually for better control
// This MUST be before any routes to ensure headers are set on all responses
app.use((req: Request, res: Response, next: NextFunction) => {
  // Intercept the original end/send methods to ensure CORS headers are always set
  const originalEnd = res.end;
  const originalJson = res.json;
  const originalSend = res.send;
  
  // Wrap res.end to ensure CORS headers are set
  res.end = function(chunk?: any, encoding?: any) {
    if (!res.headersSent) {
      setCorsHeaders(req, res);
    }
    return originalEnd.call(this, chunk, encoding);
  };
  
  // Wrap res.json to ensure CORS headers are set
  res.json = function(body?: any) {
    if (!res.headersSent) {
      setCorsHeaders(req, res);
    }
    return originalJson.call(this, body);
  };
  
  // Wrap res.send to ensure CORS headers are set
  res.send = function(body?: any) {
    if (!res.headersSent) {
      setCorsHeaders(req, res);
    }
    return originalSend.call(this, body);
  };
  
  // Set headers immediately for this request
  setCorsHeaders(req, res);
  
  // Handle OPTIONS requests (CORS preflight) - must return early
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
})

// API key auth middleware (to be used only on protected route groups, e.g. `/api`)
const apiAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Allow OPTIONS requests (CORS preflight) to pass through without auth
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!config.apiKey) {
    setCorsHeaders(req, res);
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
    setCorsHeaders(req, res);
    return res.status(401).json({
      success: false,
      error: 'Missing API key',
    });
  }

  if (apiKey !== config.apiKey) {
    // setCorsHeaders(req, res);
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
  setCorsHeaders(req, res);
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  })
})

app.use(errorHandler as any);

export default app;