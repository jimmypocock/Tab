import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

// Setup worker for browser environments (Storybook, dev tools, etc.)
export const worker = setupWorker(...handlers)