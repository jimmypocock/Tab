export const eq = jest.fn((field: any, value: any) => ({ field, value }))
export const ne = jest.fn((field: any, value: any) => ({ field, value }))
export const gt = jest.fn((field: any, value: any) => ({ field, value }))
export const gte = jest.fn((field: any, value: any) => ({ field, value }))
export const lt = jest.fn((field: any, value: any) => ({ field, value }))
export const lte = jest.fn((field: any, value: any) => ({ field, value }))
export const and = jest.fn((...conditions: any[]) => ({ and: conditions }))
export const or = jest.fn((...conditions: any[]) => ({ or: conditions }))
export const desc = jest.fn((field: any) => ({ desc: field }))
export const asc = jest.fn((field: any) => ({ asc: field }))
export const sql = jest.fn((strings: TemplateStringsArray, ...values: any[]) => ({
  sql: strings.join('?'),
  values,
}))
export const relations = jest.fn(() => ({}))