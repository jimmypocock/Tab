# Visual Regression Testing

This directory contains visual regression tests using Playwright to ensure UI consistency across changes.

## Overview

Visual regression testing captures screenshots of the application and compares them against baseline images to detect unintended visual changes.

## Running Tests

### First Time Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Generate baseline screenshots:
   ```bash
   npm run test:visual
   ```
   This will create baseline screenshots in `e2e/screenshots/`

### Running Tests

- **Run all visual tests:**
  ```bash
  npm run test:e2e
  ```

- **Update baseline screenshots:**
  ```bash
  npm run test:visual
  ```

- **Run tests with UI mode:**
  ```bash
  npm run test:e2e:ui
  ```

- **Debug tests:**
  ```bash
  npm run test:e2e:debug
  ```

## Test Structure

### Test Files

- `authentication.spec.ts` - Login, registration, and auth flow visuals
- `dashboard.spec.ts` - Dashboard layout and responsive design
- `tab-management.spec.ts` - Tab creation, editing, and management
- `payment-flow.spec.ts` - Customer payment experience
- `settings.spec.ts` - Settings pages and configuration
- `critical-user-journeys.spec.ts` - End-to-end user flows

### Helper Utilities

- `helpers/visual-testing.ts` - Reusable functions for consistent screenshots

## Best Practices

### 1. Consistent Screenshots

- Always disable animations
- Mock dynamic content (dates, random IDs)
- Hide frequently changing elements
- Wait for network idle state

### 2. Responsive Testing

```typescript
import { captureResponsiveScreenshots, STANDARD_VIEWPORTS } from './helpers/visual-testing'

// Test across multiple viewports
await captureResponsiveScreenshots(page, 'dashboard', STANDARD_VIEWPORTS)
```

### 3. Element Stability

```typescript
import { waitForStableElement } from './helpers/visual-testing'

// Wait for element position to stabilize
await waitForStableElement(page, '[data-testid="stats-grid"]')
```

### 4. Focused Screenshots

```typescript
// Capture specific element
await takeScreenshot(page, 'button-hover.png', {
  clip: await button.boundingBox() || undefined,
})
```

## CI/CD Integration

In CI environments:

1. Tests run in headless mode
2. Failed screenshots are uploaded as artifacts
3. Strict pixel comparison (threshold: 0.01)

## Updating Baselines

When intentional UI changes are made:

1. Review the changes locally
2. Run `npm run test:visual` to update baselines
3. Commit the new baseline images
4. Include explanation in PR description

## Troubleshooting

### Screenshots Don't Match

1. Check for dynamic content not properly mocked
2. Ensure animations are disabled
3. Verify viewport size is consistent
4. Check for font rendering differences

### Tests are Flaky

1. Add explicit waits for network idle
2. Use `waitForStableElement` helper
3. Increase timeout for slow elements
4. Mock external API calls

### Platform Differences

- Use Docker for consistent rendering across platforms
- Or maintain separate baselines per platform
- Configure CI to use specific platform baselines

## Screenshot Organization

```
e2e/screenshots/
├── chromium/
│   ├── dashboard-overview.png
│   ├── login-page.png
│   └── ...
├── firefox/
│   └── ...
└── webkit/
    └── ...
```

## Configuration

See `playwright.config.ts` for:
- Browser configurations
- Screenshot comparison thresholds
- Viewport sizes
- Test timeouts

## Adding New Visual Tests

1. Create test file in `e2e/`
2. Import visual testing helpers
3. Mock dynamic content
4. Capture screenshots at key states
5. Run locally to generate baselines
6. Commit baselines with test