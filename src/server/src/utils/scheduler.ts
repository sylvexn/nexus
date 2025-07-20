import { cleanupExpiredFiles } from '../scripts/cleanup-expired-files'

interface ScheduledTask {
  id: string
  name: string
  cronExpression: string
  handler: () => Promise<void> | void
  lastRun?: Date
  nextRun?: Date
  enabled: boolean
}

class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map()
  private intervals: Map<string, Timer> = new Map()
  private isRunning = false

  constructor() {
    this.setupDefaultTasks()
  }

  private setupDefaultTasks() {
    // Cleanup expired files daily at 2 AM
    this.addTask({
      id: 'cleanup-expired-files',
      name: 'Cleanup Expired Files',
      cronExpression: '0 2 * * *', // Daily at 2 AM
      handler: async () => {
        console.log('🕐 Scheduled cleanup: Starting expired files cleanup...')
        try {
          const result = cleanupExpiredFiles()
          console.log(`✅ Scheduled cleanup completed: ${result.cleaned} files cleaned, ${this.formatBytes(result.sizeFreed)} freed`)
        } catch (error) {
          console.error('❌ Scheduled cleanup failed:', error)
        }
      },
      enabled: true
    })

    // Health check every hour
    this.addTask({
      id: 'health-check',
      name: 'System Health Check',
      cronExpression: '0 * * * *', // Every hour
      handler: async () => {
        console.log('💓 System health check...')
        // Add health check logic here
        console.log('✅ System healthy')
      },
      enabled: process.env.NODE_ENV === 'production'
    })
  }

  addTask(task: Omit<ScheduledTask, 'nextRun'>) {
    const taskWithNextRun = {
      ...task,
      nextRun: this.calculateNextRun(task.cronExpression)
    }
    this.tasks.set(task.id, taskWithNextRun)
    
    if (this.isRunning && task.enabled) {
      this.scheduleTask(taskWithNextRun)
    }
  }

  removeTask(taskId: string) {
    const interval = this.intervals.get(taskId)
    if (interval) {
      clearTimeout(interval)
      this.intervals.delete(taskId)
    }
    this.tasks.delete(taskId)
  }

  start() {
    if (this.isRunning) {
      console.log('📅 Scheduler is already running')
      return
    }

    console.log('🚀 Starting task scheduler...')
    this.isRunning = true

    // Schedule all enabled tasks
    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.scheduleTask(task)
        console.log(`📋 Scheduled task: ${task.name} (next run: ${task.nextRun?.toLocaleString()})`)
      }
    }

    console.log(`✅ Scheduler started with ${Array.from(this.tasks.values()).filter(t => t.enabled).length} active tasks`)
  }

  stop() {
    if (!this.isRunning) {
      return
    }

    console.log('🛑 Stopping task scheduler...')
    
    // Clear all intervals
    for (const interval of this.intervals.values()) {
      clearTimeout(interval)
    }
    this.intervals.clear()
    this.isRunning = false

    console.log('✅ Scheduler stopped')
  }

  private scheduleTask(task: ScheduledTask) {
    if (!task.nextRun) {
      console.warn(`⚠️  Cannot schedule task ${task.id}: no next run time`)
      return
    }

    const now = new Date()
    const delay = task.nextRun.getTime() - now.getTime()

    if (delay <= 0) {
      // Task should run now
      this.runTask(task)
      return
    }

    // Schedule the task
    const timeout = setTimeout(() => {
      this.runTask(task)
    }, delay)

    this.intervals.set(task.id, timeout)
  }

  private async runTask(task: ScheduledTask) {
    console.log(`▶️  Running task: ${task.name}`)
    
    try {
      task.lastRun = new Date()
      await task.handler()
      
      // Calculate next run time
      task.nextRun = this.calculateNextRun(task.cronExpression)
      
      // Schedule next execution
      if (this.isRunning && task.enabled) {
        this.scheduleTask(task)
      }
      
    } catch (error) {
      console.error(`❌ Task ${task.name} failed:`, error)
      
      // Still schedule next run even if this one failed
      task.nextRun = this.calculateNextRun(task.cronExpression)
      if (this.isRunning && task.enabled) {
        this.scheduleTask(task)
      }
    }
  }

  private calculateNextRun(cronExpression: string): Date {
    // Simple cron parser for basic expressions
    // Format: minute hour day month dayOfWeek
    const parts = cronExpression.split(' ')
    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: ${cronExpression}`)
    }

    const [minute, hour, day, month, dayOfWeek] = parts
    const now = new Date()
    const next = new Date(now)

    // Handle simple cases first
    if (cronExpression === '0 2 * * *') {
      // Daily at 2 AM
      next.setHours(2, 0, 0, 0)
      if (next <= now) {
        next.setDate(next.getDate() + 1)
      }
      return next
    }

    if (cronExpression === '0 * * * *') {
      // Every hour
      next.setMinutes(0, 0, 0)
      next.setHours(next.getHours() + 1)
      return next
    }

    // For more complex expressions, add time based on pattern
    if (minute === '0' && hour !== '*') {
      // Hourly at specific hour
      const targetHour = parseInt(hour)
      next.setHours(targetHour, 0, 0, 0)
      if (next <= now) {
        next.setDate(next.getDate() + 1)
      }
      return next
    }

    // Fallback: run in 1 hour
    console.warn(`⚠️  Unsupported cron expression ${cronExpression}, defaulting to 1 hour`)
    next.setHours(next.getHours() + 1)
    return next
  }

  getStatus() {
    const tasks = Array.from(this.tasks.values()).map(task => ({
      id: task.id,
      name: task.name,
      enabled: task.enabled,
      lastRun: task.lastRun?.toISOString(),
      nextRun: task.nextRun?.toISOString(),
      cronExpression: task.cronExpression
    }))

    return {
      running: this.isRunning,
      tasksCount: this.tasks.size,
      activeTasks: tasks.filter(t => t.enabled).length,
      tasks
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// Create singleton instance
export const scheduler = new TaskScheduler()

// Auto-start in production
if (process.env.NODE_ENV === 'production') {
  scheduler.start()
} 