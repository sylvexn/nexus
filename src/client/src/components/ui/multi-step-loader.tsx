import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface Step {
  id: string
  title: string
  description?: string
  status: 'pending' | 'loading' | 'completed' | 'error'
  icon?: React.ReactNode
}

interface MultiStepLoaderProps {
  steps: Step[]
  currentStep?: string
  onComplete?: () => void
  onError?: (stepId: string, error: string) => void
  className?: string
  compact?: boolean
}

const stepVariants = {
  initial: { opacity: 0, x: -20, scale: 0.95 },
  animate: { 
    opacity: 1, 
    x: 0, 
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25
    }
  },
  exit: { 
    opacity: 0, 
    x: 20, 
    scale: 0.95,
    transition: { duration: 0.2 }
  }
}

const iconVariants = {
  initial: { scale: 0, rotate: -180 },
  animate: { 
    scale: 1, 
    rotate: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20
    }
  },
  pulse: {
    scale: [1, 1.1, 1],
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
}

const progressVariants = {
  initial: { scaleX: 0 },
  animate: { 
    scaleX: 1,
    transition: { duration: 0.5, ease: "easeOut" }
  }
}

export function MultiStepLoader({
  steps,
  onComplete,
  className,
  compact = false
}: MultiStepLoaderProps) {
  const { gradients } = useTheme()
  const [progress, setProgress] = useState(0)

  // Calculate progress
  useEffect(() => {
    const completedSteps = steps.filter(step => step.status === 'completed').length
    const newProgress = (completedSteps / steps.length) * 100
    setProgress(newProgress)

    // Check if all steps are completed
    if (completedSteps === steps.length && onComplete) {
      setTimeout(onComplete, 500) // Small delay for animation
    }
  }, [steps, onComplete])

  const getStepIcon = (step: Step) => {
    if (step.icon) return step.icon

    switch (step.status) {
      case 'completed':
        return <Check className="w-4 h-4" />
      case 'loading':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'error':
        return <AlertCircle className="w-4 h-4" />
      default:
        return <div className="w-2 h-2 rounded-full bg-muted-foreground" />
    }
  }

  const getStepColor = (step: Step) => {
    switch (step.status) {
      case 'completed':
        return 'text-green-500 border-green-500 bg-green-500/10'
      case 'loading':
        return 'text-purple-500 border-purple-500 bg-purple-500/10'
      case 'error':
        return 'text-red-500 border-red-500 bg-red-500/10'
      default:
        return 'text-muted-foreground border-muted-foreground/30 bg-muted/10'
    }
  }

  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
          <motion.div
            className={`h-full bg-gradient-to-r ${gradients.primary} origin-left`}
            variants={progressVariants}
            initial="initial"
            animate="animate"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Current step info */}
        <AnimatePresence mode="wait">
          {steps.map((step) => {
            if (step.status !== 'loading') return null
            
            return (
              <motion.div
                key={step.id}
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex items-center gap-2 text-sm"
              >
                <motion.div
                  variants={iconVariants}
                  animate={step.status === 'loading' ? 'pulse' : 'animate'}
                  className={cn(
                    "w-6 h-6 rounded-full border flex items-center justify-center",
                    getStepColor(step)
                  )}
                >
                  {getStepIcon(step)}
                </motion.div>
                <span className="text-muted-foreground">{step.title}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <motion.div
            className={`h-full bg-gradient-to-r ${gradients.primary} origin-left`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Steps list */}
      <div className="space-y-3">
        <AnimatePresence>
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ delay: index * 0.1 }}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-all duration-300",
                step.status === 'loading' && "bg-gradient-to-r from-purple-500/5 via-purple-400/3 to-transparent",
                step.status === 'completed' && "bg-green-500/5",
                step.status === 'error' && "bg-red-500/5",
                "border-border/50"
              )}
            >
              {/* Step icon */}
              <motion.div
                variants={iconVariants}
                initial="initial"
                animate={step.status === 'loading' ? 'pulse' : 'animate'}
                className={cn(
                  "w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  getStepColor(step)
                )}
              >
                {getStepIcon(step)}
              </motion.div>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className={cn(
                    "font-medium text-sm",
                    step.status === 'completed' && "text-green-600",
                    step.status === 'loading' && "text-purple-600",
                    step.status === 'error' && "text-red-600"
                  )}>
                    {step.title}
                  </h4>
                  
                  {step.status === 'loading' && (
                    <motion.div
                      className="flex space-x-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1 h-1 bg-purple-500 rounded-full"
                          animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 1, 0.5]
                          }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            delay: i * 0.2
                          }}
                        />
                      ))}
                    </motion.div>
                  )}
                </div>
                
                {step.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {step.description}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Completion state */}
      <AnimatePresence>
        {progress === 100 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              transition: {
                type: "spring",
                stiffness: 300,
                damping: 25
              }
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-green-400/5 border border-green-500/20"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
              className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2"
            >
              <Check className="w-6 h-6 text-white" />
            </motion.div>
            <p className="text-green-600 font-medium">all steps completed!</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
} 