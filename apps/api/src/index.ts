import 'reflect-metadata'
import { startServer } from './bootstrap/server'

startServer().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
