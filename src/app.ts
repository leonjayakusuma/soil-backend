import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import userRoutes from './routes/userRoutes'
import config from './config/config'
import { errorHandler } from './middlewares/errorHandler'

const app = express()
const port = config.port
const nodeEnv = config.nodeEnv

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())

// Routes
app.use('/api/users', userRoutes)

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Hello World!' })
})

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

// 404 handler (must be after all routes)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  })
})

app.use(errorHandler);

export default app;