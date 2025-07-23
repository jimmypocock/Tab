import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextRouter } from 'next/router'
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime'
import { ToastProvider } from '@/lib/toast/toast-context'

// Mock router
export const mockRouter: NextRouter = {
  basePath: '',
  pathname: '/',
  route: '/',
  asPath: '/',
  query: {},
  push: jest.fn(() => Promise.resolve(true)),
  replace: jest.fn(() => Promise.resolve(true)),
  reload: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn(() => Promise.resolve()),
  beforePopState: jest.fn(),
  events: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
  isFallback: false,
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
}

// Create a custom router with overrides
export const createMockRouter = (router: Partial<NextRouter> = {}): NextRouter => ({
  ...mockRouter,
  ...router,
})

// Theme provider mock (if you add a theme provider later)
interface ThemeProviderProps {
  children: React.ReactNode
  theme?: 'light' | 'dark'
}

const MockThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return <>{children}</>
}

// All providers wrapper
interface AllTheProvidersProps {
  children: React.ReactNode
  router?: Partial<NextRouter>
  queryClient?: QueryClient
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({ 
  children, 
  router = {},
  queryClient,
}) => {
  // Create a new QueryClient for each test
  const testQueryClient = queryClient || new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Turn off retries for tests
        gcTime: 0, // Don't cache during tests
      },
    },
  })

  const testRouter = createMockRouter(router)

  return (
    <QueryClientProvider client={testQueryClient}>
      <RouterContext.Provider value={testRouter}>
        <ToastProvider>
          <MockThemeProvider>
            {children}
          </MockThemeProvider>
        </ToastProvider>
      </RouterContext.Provider>
    </QueryClientProvider>
  )
}

// Custom render options
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  router?: Partial<NextRouter>
  queryClient?: QueryClient
}

// Custom render function
export const customRender = (
  ui: ReactElement,
  options?: CustomRenderOptions
) => {
  const { router, queryClient, ...renderOptions } = options || {}

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders router={router} queryClient={queryClient}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  })
}

// Re-export everything from React Testing Library
export * from '@testing-library/react'

// Override the default render
export { customRender as render }

// Utility to wait for loading states
export const waitForLoadingToFinish = () => {
  return screen.findByText((content, element) => {
    return !element?.className?.includes('loading') && 
           !element?.className?.includes('skeleton')
  }, { selector: '*' }, { timeout: 3000 })
    .catch(() => {}) // Ignore if nothing found
}

// Utility for testing async components
export const renderWithQuery = async (
  ui: ReactElement,
  options?: CustomRenderOptions
) => {
  const result = customRender(ui, options)
  await waitForLoadingToFinish()
  return result
}

// Mock fetch helper
export const mockFetch = (data: any, options: { ok?: boolean; status?: number } = {}) => {
  const { ok = true, status = 200 } = options
  
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      headers: new Headers(),
    } as Response)
  )
}

// Mock API response helper
export const mockApiResponse = (endpoint: string, data: any, options?: any) => {
  // Ensure fetch is mocked
  if (!jest.isMockFunction(global.fetch)) {
    global.fetch = jest.fn()
  }
  
  const fetchMock = global.fetch as jest.Mock
  
  fetchMock.mockImplementationOnce((url: string) => {
    if (url.includes(endpoint)) {
      return Promise.resolve({
        ok: options?.ok ?? true,
        status: options?.status ?? 200,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data)),
        headers: new Headers(),
      } as Response)
    }
    
    return Promise.reject(new Error(`Unexpected API call: ${url}`))
  })
}

// Helper to test error boundaries
export const ErrorBoundary: React.FC<{ children: React.ReactNode; fallback?: ReactElement }> = ({ 
  children, 
  fallback = <div>Something went wrong</div> 
}) => {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      {children}
    </React.Suspense>
  )
}

// Helper to get user from testing library
import userEvent from '@testing-library/user-event'
export const getUser = () => userEvent.setup()

// Screen size helpers for responsive testing
export const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  })
  window.dispatchEvent(new Event('resize'))
}

export const viewports = {
  mobile: () => setViewport(375, 667),
  tablet: () => setViewport(768, 1024),
  desktop: () => setViewport(1440, 900),
}

// Accessibility testing helper
export const checkA11y = async (container: HTMLElement) => {
  if (process.env.SKIP_A11Y_TESTS) return
  
  try {
    const { axe } = await import('jest-axe')
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  } catch (error) {
    console.warn('Accessibility testing not available:', error)
  }
}