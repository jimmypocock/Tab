/**
 * Dependency Injection Container
 */

import { DIToken, IDIContainer, DependencyConfig } from './types'

export class DIContainer implements IDIContainer {
  private services = new Map<symbol, any>()
  private factories = new Map<symbol, () => any>()
  private singletons = new Set<symbol>()
  private parent?: DIContainer

  constructor(parent?: DIContainer) {
    this.parent = parent
  }

  /**
   * Register a dependency
   */
  register<T>(token: DIToken, factory: () => T, singleton = true): void {
    this.factories.set(token, factory)
    if (singleton) {
      this.singletons.add(token)
    }
  }

  /**
   * Resolve a dependency
   */
  resolve<T>(token: DIToken): T {
    // Check if we have a singleton instance
    if (this.services.has(token)) {
      return this.services.get(token)
    }

    // Check if we have a factory
    const factory = this.factories.get(token)
    if (factory) {
      const instance = factory()
      
      // Store singleton instances
      if (this.singletons.has(token)) {
        this.services.set(token, instance)
      }
      
      return instance
    }

    // Check parent container
    if (this.parent) {
      return this.parent.resolve(token)
    }

    throw new Error(`No registration found for token: ${token.toString()}`)
  }

  /**
   * Create a child scope for request-scoped dependencies
   */
  createScope(): IDIContainer {
    return new DIContainer(this)
  }

  /**
   * Register multiple dependencies at once
   */
  registerMany(configs: DependencyConfig[]): void {
    configs.forEach(({ token, factory, singleton }) => {
      this.register(token, () => factory(this), singleton)
    })
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.services.clear()
    this.factories.clear()
    this.singletons.clear()
  }

  /**
   * Check if container is configured with dependencies
   */
  isConfigured(): boolean {
    return this.factories.size > 0
  }
}

// Global container instance
let globalContainer: DIContainer | null = null

/**
 * Get or create the global DI container
 */
export function getGlobalContainer(): DIContainer {
  if (!globalContainer) {
    globalContainer = new DIContainer()
  }
  return globalContainer
}

/**
 * Reset the global container (for testing)
 */
export function resetGlobalContainer(): void {
  if (globalContainer) {
    globalContainer.clear()
  }
  globalContainer = null
}