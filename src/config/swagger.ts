import swaggerJsdoc from 'swagger-jsdoc'
import path from 'path'
import fs from 'fs'

// Determine the base URL dynamically based on environment
const getBaseUrl = (): string => {
  // Vercel provides VERCEL_URL automatically
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Allow custom API_URL to be set
  if (process.env.API_URL) {
    return process.env.API_URL;
  }
  // Fall back to localhost for development
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
};

const baseUrl = getBaseUrl();

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Express Sequelize Supabase API',
    version: '1.0.0',
    description: 'API documentation for the Express + Sequelize + Supabase project',
  },
  servers: [
    {
      url: baseUrl,
      description: process.env.VERCEL_URL ? 'Production server' : 'Local dev server',
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key required for all /api and /api/protected endpoints',
      },
    },
  },
  security: [
    {
      ApiKeyAuth: [],
    },
  ],
}

// Build API file globs that work in both local dev (src/*.ts)
// and Vercel/serverless build (dist/*.js)
const root = process.cwd()

const candidateGlobs = [
  // TS sources (local dev)
  path.join(root, 'src/app.ts'),
  path.join(root, 'src/routes/*.ts'),
  path.join(root, 'src/controllers/*.ts'),
  // Compiled JS (production / Vercel)
  path.join(root, 'dist/app.js'),
  path.join(root, 'dist/routes/*.js'),
  path.join(root, 'dist/controllers/*.js'),
]

// Filter to only include globs whose base directory exists
const apiFileGlobs = candidateGlobs.filter((pattern) => {
  const dir = pattern.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
  return fs.existsSync(dir)
})

export const swaggerOptions: swaggerJsdoc.Options = {
  swaggerDefinition,
  apis: apiFileGlobs,
}

export const swaggerSpec = swaggerJsdoc(swaggerOptions)


