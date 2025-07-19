import { IPaymentProcessor } from './interface'
import { ProcessorType, ProcessorConfig, ProcessorNotFoundError } from './types'
import { StripeProcessor } from './stripe/stripe-processor'

export class ProcessorFactory {
  static create(config: ProcessorConfig): IPaymentProcessor {
    switch (config.processorType) {
      case ProcessorType.STRIPE:
        return new StripeProcessor(config)
      
      case ProcessorType.SQUARE:
        // TODO: Implement SquareProcessor
        throw new ProcessorNotFoundError(ProcessorType.SQUARE)
      
      case ProcessorType.PAYPAL:
        // TODO: Implement PayPalProcessor
        throw new ProcessorNotFoundError(ProcessorType.PAYPAL)
      
      case ProcessorType.AUTHORIZE_NET:
        // TODO: Implement AuthorizeNetProcessor
        throw new ProcessorNotFoundError(ProcessorType.AUTHORIZE_NET)
      
      default:
        throw new ProcessorNotFoundError(config.processorType)
    }
  }

  static getSupportedProcessors(): ProcessorType[] {
    return [ProcessorType.STRIPE] // Add others as they're implemented
  }

  static isSupported(processorType: ProcessorType): boolean {
    return this.getSupportedProcessors().includes(processorType)
  }
}