/**
 * Dependency Injection Setup
 */

import { getGlobalContainer, resetGlobalContainer } from './container'
import { productionConfig, testConfig } from './config'
import { DITokens } from './types'

// Re-export types and tokens
export { DITokens, type DIToken, type IDIContainer, type IRequestContext } from './types'
export { DIContainer } from './container'

/**
 * Initialize the DI container with appropriate configuration
 */
export function initializeDI(environment: 'production' | 'test' = 'production'): void {
  const container = getGlobalContainer()
  
  // Clear any existing registrations
  container.clear()
  
  // Register dependencies based on environment
  const config = environment === 'test' ? testConfig : productionConfig
  container.registerMany(config)
}

/**
 * Get the global DI container
 * Initializes with production config if not already initialized
 */
export function getDI(): ReturnType<typeof getGlobalContainer> {
  const container = getGlobalContainer()
  
  // Auto-initialize if empty
  try {
    container.resolve(DITokens.Database)
  } catch {
    initializeDI('production')
  }
  
  return container
}

/**
 * Create a request-scoped container
 */
export function createRequestContainer() {
  return getDI().createScope()
}

/**
 * Reset DI for testing
 */
export function resetDI(): void {
  resetGlobalContainer()
}

// Initialize on module load (can be overridden in tests)
if (process.env.NODE_ENV !== 'test') {
  initializeDI('production')
}