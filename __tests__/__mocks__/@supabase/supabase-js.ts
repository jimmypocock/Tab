import { createSupabaseMock } from '../../helpers/supabase-mock'

// Default mock client
const defaultMockClient = createSupabaseMock()

// Export the createClient function that returns our mock
export const createClient = jest.fn(() => defaultMockClient)

// Helper to update the mock client for specific tests
export const updateMockClient = (newClient: any) => {
  createClient.mockReturnValue(newClient)
}

// Reset to default mock
export const resetMockClient = () => {
  createClient.mockReturnValue(defaultMockClient)
}