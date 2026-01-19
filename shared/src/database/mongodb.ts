/**
 * MongoDB connection utility
 * Used by Chat Service and Agent Service
 */

import mongoose, { ConnectOptions } from 'mongoose'

export async function connectMongoDB(uri: string): Promise<void> {
  const minPoolSize = parseInt(process.env.MONGODB_MIN_POOL_SIZE || process.env.MONGODB_POOL_SIZE || '10', 10)
  const maxPoolSize = parseInt(process.env.MONGODB_MAX_POOL_SIZE || '50', 10)
  
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    maxPoolSize,
    minPoolSize,
    maxIdleTimeMS: 30000,
    socketTimeoutMS: 45000,
  } as ConnectOptions)
  
  mongoose.set('bufferCommands', false)
}

export async function disconnectMongoDB(): Promise<void> {
  await mongoose.disconnect()
}

