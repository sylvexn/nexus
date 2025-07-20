import { forwardRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Check, X } from 'lucide-react'
import { Button, ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean
  isSuccess?: boolean
  isError?: boolean
  loadingText?: string
  successText?: string
  errorText?: string
  resetDelay?: number
}

const iconVariants = {
  initial: { scale: 0, rotate: -180, opacity: 0 },
  animate: { 
    scale: 1, 
    rotate: 0, 
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 20
    }
  },
  exit: { 
    scale: 0, 
    rotate: 180, 
    opacity: 0,
    transition: { duration: 0.2 }
  }
}

const textVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.2 }
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: { duration: 0.2 }
  }
}

export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({
    children,
    isLoading = false,
    isSuccess = false,
    isError = false,
    loadingText = 'loading...',
    successText = 'success!',
    errorText = 'error',
    disabled,
    className,
    ...props
  }, ref) => {
    const currentState = isLoading ? 'loading' : isSuccess ? 'success' : isError ? 'error' : 'default'
    
    const getButtonClass = () => {
      if (isSuccess) return 'bg-green-500 hover:bg-green-600 border-green-500'
      if (isError) return 'bg-red-500 hover:bg-red-600 border-red-500'
      return ''
    }

    const getCurrentText = () => {
      if (isLoading) return loadingText
      if (isSuccess) return successText
      if (isError) return errorText
      return children
    }

    const getCurrentIcon = () => {
      if (isLoading) return <Loader2 className="w-4 h-4 animate-spin" />
      if (isSuccess) return <Check className="w-4 h-4" />
      if (isError) return <X className="w-4 h-4" />
      return null
    }

    return (
      <motion.div
        whileHover={!disabled && !isLoading ? { scale: 1.02 } : {}}
        whileTap={!disabled && !isLoading ? { scale: 0.98 } : {}}
        className="relative"
      >
        <Button
          ref={ref}
          disabled={disabled || isLoading}
          className={cn(
            "relative overflow-hidden transition-all duration-300",
            getButtonClass(),
            className
          )}
          {...props}
        >
          {/* Background overlay for state changes */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-purple-400/5 to-transparent"
            initial={{ opacity: 0, x: '-100%' }}
            animate={
              isLoading
                ? {
                    opacity: 1,
                    x: ['100%', '-100%'],
                    transition: {
                      x: {
                        repeat: Infinity,
                        duration: 1.5,
                        ease: 'linear'
                      }
                    }
                  }
                : { opacity: 0, x: '100%' }
            }
          />

          {/* Content */}
          <div className="flex items-center gap-2 relative z-10">
            <AnimatePresence mode="wait">
              {getCurrentIcon() && (
                <motion.div
                  key={currentState + '-icon'}
                  variants={iconVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {getCurrentIcon()}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.span
                key={currentState + '-text'}
                variants={textVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="whitespace-nowrap"
              >
                {getCurrentText()}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Success/Error ripple effect */}
          <AnimatePresence>
            {(isSuccess || isError) && (
              <motion.div
                className={cn(
                  "absolute inset-0 rounded-md",
                  isSuccess ? "bg-green-500/20" : "bg-red-500/20"
                )}
                initial={{ scale: 0, opacity: 0.5 }}
                animate={{ 
                  scale: 1.2, 
                  opacity: 0,
                  transition: { duration: 0.6, ease: "easeOut" }
                }}
                exit={{ opacity: 0 }}
              />
            )}
          </AnimatePresence>
        </Button>
      </motion.div>
    )
  }
)

LoadingButton.displayName = 'LoadingButton' 