import { lazy, ComponentType } from 'react'

// Performance metrics tracking
interface PerformanceMetrics {
  loadTime: number
  renderTime: number
  memoryUsage?: number
  bundleSize?: number
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map()
  private observers: Map<string, PerformanceObserver> = new Map()

  // Track component load time
  trackComponentLoad(componentName: string, startTime: number) {
    const loadTime = performance.now() - startTime
    this.updateMetrics(componentName, { loadTime })
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Component ${componentName} loaded in ${loadTime.toFixed(2)}ms`)
    }
  }

  // Track render performance
  trackRender(componentName: string, callback: () => void) {
    const startTime = performance.now()
    callback()
    const renderTime = performance.now() - startTime
    
    this.updateMetrics(componentName, { renderTime })
    
    if (process.env.NODE_ENV === 'development' && renderTime > 16) {
      console.warn(`⚠️  Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`)
    }
  }

  // Track memory usage
  trackMemoryUsage(componentName: string) {
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory
      const memoryUsage = memoryInfo.usedJSHeapSize / 1024 / 1024 // MB
      this.updateMetrics(componentName, { memoryUsage })
    }
  }

  // Start observing long tasks
  observeLongTasks() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 50) { // Tasks longer than 50ms
            console.warn(`🐌 Long task detected: ${entry.duration.toFixed(2)}ms`)
          }
        })
      })
      
      try {
        observer.observe({ entryTypes: ['longtask'] })
        this.observers.set('longtask', observer)
      } catch (e) {
        console.warn('Long task observer not supported')
      }
    }
  }

  // Observe largest contentful paint
  observeLCP() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        console.log(`🎨 LCP: ${lastEntry.startTime.toFixed(2)}ms`)
      })
      
      try {
        observer.observe({ entryTypes: ['largest-contentful-paint'] })
        this.observers.set('lcp', observer)
      } catch (e) {
        console.warn('LCP observer not supported')
      }
    }
  }

  // Get performance summary
  getSummary(): Record<string, PerformanceMetrics> {
    return Object.fromEntries(this.metrics)
  }

  // Clean up observers
  cleanup() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers.clear()
  }

  private updateMetrics(componentName: string, newMetrics: Partial<PerformanceMetrics>) {
    const existing = this.metrics.get(componentName) || { loadTime: 0, renderTime: 0 }
    this.metrics.set(componentName, { ...existing, ...newMetrics })
  }
}

export const performanceMonitor = new PerformanceMonitor()

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  performanceMonitor.observeLongTasks()
  performanceMonitor.observeLCP()
}

// Enhanced lazy loading with error boundaries and loading states
interface LazyComponentOptions {
  loading?: ComponentType
  error?: ComponentType<{ error: Error; retry: () => void }>
  delay?: number
  timeout?: number
}

export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyComponentOptions = {}
) {
  const startTime = performance.now()
  
  const LazyComponent = lazy(async () => {
    // Add artificial delay if specified (useful for testing)
    if (options.delay && process.env.NODE_ENV === 'development') {
      await new Promise(resolve => setTimeout(resolve, options.delay))
    }

    try {
      const module = await importFn()
      performanceMonitor.trackComponentLoad(module.default.name || 'LazyComponent', startTime)
      return module
    } catch (error) {
      console.error('Failed to load lazy component:', error)
      throw error
    }
  })

  return LazyComponent
}

// Preload components for better UX
export function preloadComponent(importFn: () => Promise<any>) {
  if (typeof window !== 'undefined') {
    // Use requestIdleCallback if available, otherwise setTimeout
    const preload = () => {
      importFn().catch(error => {
        console.warn('Failed to preload component:', error)
      })
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback(preload)
    } else {
      setTimeout(preload, 100)
    }
  }
}

// Bundle size analyzer (development only)
export function analyzeBundleSize() {
  if (process.env.NODE_ENV === 'development' && 'PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name.includes('.js') || entry.name.includes('.css')) {
          const size = (entry as any).transferSize || 0
          console.log(`📦 ${entry.name}: ${(size / 1024).toFixed(2)}KB`)
        }
      })
    })
    
    try {
      observer.observe({ entryTypes: ['resource'] })
    } catch (e) {
      console.warn('Resource observer not supported')
    }
  }
}

// Memory usage tracker
export function trackMemoryUsage() {
  if ('memory' in performance && process.env.NODE_ENV === 'development') {
    const memoryInfo = (performance as any).memory
    const used = (memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)
    const total = (memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)
    const limit = (memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)
    
    console.log(`🧠 Memory: ${used}MB / ${total}MB (limit: ${limit}MB)`)
    
    // Warn if memory usage is high
    const usagePercent = (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100
    if (usagePercent > 80) {
      console.warn(`⚠️  High memory usage: ${usagePercent.toFixed(1)}%`)
    }
  }
}

// Image optimization helpers
export function optimizeImageLoading() {
  if ('loading' in HTMLImageElement.prototype) {
    // Native lazy loading is supported
    document.querySelectorAll('img[data-src]').forEach((img: any) => {
      img.loading = 'lazy'
      img.src = img.dataset.src
      img.removeAttribute('data-src')
    })
  }
}

// Code splitting utilities
export const Routes = {
  // Lazy load admin routes
  AdminDashboard: createLazyComponent(
    () => import('../pages/admin/AdminDashboard'),
    { delay: 0 }
  ),
  AdminUsers: createLazyComponent(
    () => import('../pages/admin/AdminUsers'),
    { delay: 0 }
  ),
  AdminFiles: createLazyComponent(
    () => import('../pages/admin/AdminFiles'),
    { delay: 0 }
  ),
  AdminInvites: createLazyComponent(
    () => import('../pages/admin/AdminInvites'),
    { delay: 0 }
  ),
  AdminLogs: createLazyComponent(
    () => import('../pages/admin/AdminLogs'),
    { delay: 0 }
  ),
  AdminSettings: createLazyComponent(
    () => import('../pages/admin/AdminSettings'),
    { delay: 0 }
  ),
  
  // Lazy load heavy components
  AdvancedSearch: createLazyComponent(
    () => import('../components/AdvancedSearch').then(module => ({ default: module.AdvancedSearch })),
    { delay: 0 }
  ),
  LazyFileGrid: createLazyComponent(
    () => import('../components/LazyFileGrid').then(module => ({ default: module.LazyFileGrid })),
    { delay: 0 }
  ),
  FileInfoPanel: createLazyComponent(
    () => import('../components/FileInfoPanel'),
    { delay: 0 }
  )
}

// Performance optimization hooks
export function usePerformanceTracking(componentName: string) {
  const trackRender = (callback: () => void) => {
    performanceMonitor.trackRender(componentName, callback)
  }

  const trackMemory = () => {
    performanceMonitor.trackMemoryUsage(componentName)
  }

  return { trackRender, trackMemory }
}

// Debounce utility for performance
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      if (!immediate) func(...args)
    }
    
    const callNow = immediate && !timeout
    
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
    
    if (callNow) func(...args)
  }
}

// Throttle utility for performance
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// Initialize performance tracking in development
if (process.env.NODE_ENV === 'development') {
  // Track memory usage every 30 seconds
  setInterval(trackMemoryUsage, 30000)
  
  // Analyze bundle size on load
  if (typeof window !== 'undefined') {
    window.addEventListener('load', analyzeBundleSize)
  }
} 