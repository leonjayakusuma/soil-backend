import app from './app'
import config from './config/config'
import { connectDatabase } from './config/database'

const port = config.port
const nodeEnv = config.nodeEnv

// Connect to database before starting server
connectDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`)
      console.log(`📝 Environment: ${nodeEnv}`)
    })
  })
  .catch((error) => {
    console.error('Failed to start server:', error)
    process.exit(1)
  })
