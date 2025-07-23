import { Page, expect } from '@playwright/test'

/**
 * Visual testing helper utilities
 */

export interface ScreenshotOptions {
  fullPage?: boolean
  animations?: 'disabled' | 'allow'
  mask?: string[]
  clip?: { x: number; y: number; width: number; height: number }
  maxDiffPixels?: number
  threshold?: number
}

/**
 * Take a screenshot with consistent options for visual regression
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options: ScreenshotOptions = {}
) {
  // Default options for consistent screenshots
  const defaultOptions: ScreenshotOptions = {
    fullPage: false,
    animations: 'disabled',
    maxDiffPixels: 100,
    threshold: 0.2,
  }

  const mergedOptions = { ...defaultOptions, ...options }

  // Wait for animations to complete
  if (mergedOptions.animations === 'disabled') {
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    })
  }

  // Wait for network to be idle
  await page.waitForLoadState('networkidle')

  // Take screenshot
  await expect(page).toHaveScreenshot(name, {
    fullPage: mergedOptions.fullPage,
    mask: mergedOptions.mask?.map(selector => page.locator(selector)),
    clip: mergedOptions.clip,
    maxDiffPixels: mergedOptions.maxDiffPixels,
    threshold: mergedOptions.threshold,
  })
}

/**
 * Wait for element to be stable before taking screenshot
 */
export async function waitForStableElement(
  page: Page,
  selector: string,
  timeout: number = 5000
) {
  const element = page.locator(selector)
  
  // Wait for element to be visible
  await element.waitFor({ state: 'visible', timeout })
  
  // Wait for element position to stabilize
  let previousBox = await element.boundingBox()
  let stableCount = 0
  const requiredStableChecks = 3
  
  while (stableCount < requiredStableChecks) {
    await page.waitForTimeout(100)
    const currentBox = await element.boundingBox()
    
    if (
      previousBox &&
      currentBox &&
      Math.abs(previousBox.x - currentBox.x) < 1 &&
      Math.abs(previousBox.y - currentBox.y) < 1 &&
      Math.abs(previousBox.width - currentBox.width) < 1 &&
      Math.abs(previousBox.height - currentBox.height) < 1
    ) {
      stableCount++
    } else {
      stableCount = 0
    }
    
    previousBox = currentBox
  }
}

/**
 * Mock dynamic content for consistent screenshots
 */
export async function mockDynamicContent(page: Page) {
  // Mock current date/time
  await page.addInitScript(() => {
    // Mock Date
    const constantDate = new Date('2024-01-15T10:00:00.000Z')
    // @ts-ignore
    Date = class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(constantDate.getTime())
        } else {
          // @ts-ignore
          super(...args)
        }
      }
      
      static now() {
        return constantDate.getTime()
      }
    }
    
    // Mock Math.random for consistent IDs
    Math.random = () => 0.5
  })
}

/**
 * Hide elements that change frequently
 */
export async function hideDynamicElements(page: Page) {
  const dynamicSelectors = [
    '[data-testid="timestamp"]',
    '[data-testid="user-avatar"]',
    '.notification-badge',
    '.live-update',
  ]
  
  for (const selector of dynamicSelectors) {
    await page.addStyleTag({
      content: `${selector} { visibility: hidden !important; }`
    })
  }
}

/**
 * Capture multiple viewport sizes
 */
export async function captureResponsiveScreenshots(
  page: Page,
  name: string,
  viewports: Array<{ width: number; height: number; label: string }>
) {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.waitForTimeout(500) // Wait for responsive adjustments
    await takeScreenshot(page, `${name}-${viewport.label}.png`)
  }
}

/**
 * Standard viewports for responsive testing
 */
export const STANDARD_VIEWPORTS = [
  { width: 1920, height: 1080, label: 'desktop-full' },
  { width: 1440, height: 900, label: 'desktop' },
  { width: 1024, height: 768, label: 'tablet-landscape' },
  { width: 768, height: 1024, label: 'tablet-portrait' },
  { width: 375, height: 812, label: 'mobile' },
]

/**
 * Compare screenshots with custom thresholds
 */
export async function compareScreenshots(
  page: Page,
  name: string,
  options: {
    threshold?: number
    maxDiffPixelRatio?: number
  } = {}
) {
  const { threshold = 0.01, maxDiffPixelRatio = 0.01 } = options
  
  await expect(page).toHaveScreenshot(name, {
    threshold,
    maxDiffPixelRatio,
  })
}