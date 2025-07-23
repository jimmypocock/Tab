import { NextRequest } from 'next/server'

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogContext {
  requestId?: string
  merchantId?: string
  tabId?: string
  userId?: string
  apiKey?: string
  method?: string
  path?: string
  statusCode?: number
  duration?: number
  [key: string]: any
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private serviceName = process.env.SERVICE_NAME || 'tab-api'

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      ...context,
    }

    return this.isDevelopment
      ? `[${timestamp}] ${level.toUpperCase()}: ${message} ${
          context ? JSON.stringify(context, null, 2) : ''
        }`
      : JSON.stringify(logEntry)
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ) {
    const formattedMessage = this.formatMessage(level, message, context)

    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage, error)
        break
      case LogLevel.WARN:
        console.warn(formattedMessage)
        break
      case LogLevel.INFO:
        console.info(formattedMessage)
        break
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.debug(formattedMessage)
        }
        break
    }
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context)
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log(LogLevel.ERROR, message, context, error)
  }

  // Log API requests
  logRequest(request: NextRequest, context?: LogContext) {
    const { method, url } = request
    const path = new URL(url).pathname

    this.info('API Request', {
      method,
      path,
      ...context,
    })
  }

  // Log API responses
  logResponse(
    request: NextRequest,
    statusCode: number,
    duration: number,
    context?: LogContext
  ) {
    const { method, url } = request
    const path = url ? new URL(url).pathname : 'unknown'

    const level = statusCode >= 500 ? LogLevel.ERROR : 
                  statusCode >= 400 ? LogLevel.WARN : 
                  LogLevel.INFO

    this.log(level, 'API Response', {
      method,
      path,
      statusCode,
      duration,
      ...context,
    })
  }

  // Log database queries (for debugging)
  logQuery(operation: string, table: string, duration: number, context?: LogContext) {
    this.debug('Database Query', {
      operation,
      table,
      duration,
      ...context,
    })
  }

  // Log external service calls
  logExternalCall(
    service: string,
    operation: string,
    duration: number,
    success: boolean,
    context?: LogContext
  ) {
    const level = success ? LogLevel.INFO : LogLevel.ERROR
    this.log(level, 'External Service Call', {
      service,
      operation,
      duration,
      success,
      ...context,
    })
  }
}

// Export singleton instance
export const logger = new Logger()

// Middleware to generate request IDs
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}