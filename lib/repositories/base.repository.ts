/**
 * Base Repository Class
 */

import { IRepository } from '@/lib/di/types'
import { logger } from '@/lib/logger'

export abstract class BaseRepository implements IRepository {
  abstract readonly name: string
  
  constructor(protected db: any) {}

  /**
   * Log repository operations for debugging
   */
  protected log(operation: string, data?: any): void {
    logger.debug(`[${this.name}] ${operation}`, data)
  }

  /**
   * Handle repository errors consistently
   */
  protected handleError(operation: string, error: any): never {
    logger.error(`[${this.name}] ${operation} failed`, error)
    throw error
  }
  
  /**
   * Start a database transaction
   */
  protected async transaction<T>(
    callback: (tx: any) => Promise<T>
  ): Promise<T> {
    return this.db.transaction(callback)
  }
}