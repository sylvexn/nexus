import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

interface MobileOptimizedGridProps {
  children: ReactNode
  className?: string
}

const containerVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
}

const itemVariants = {
  initial: { 
    opacity: 0, 
    y: 20,
    scale: 0.95 
  },
  animate: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25
    }
  }
}

export function MobileOptimizedGrid({ children, className }: MobileOptimizedGridProps) {
  const isMobile = useIsMobile()

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      className={cn(
        "grid gap-3",
        // Mobile: 2 columns with larger touch targets
        "grid-cols-2 sm:grid-cols-3",
        // Tablet: 4 columns
        "md:grid-cols-4 lg:grid-cols-5",
        // Desktop: 6 columns
        "xl:grid-cols-6 2xl:grid-cols-8",
        // Mobile-specific adjustments
        isMobile && "gap-2 p-1",
        className
      )}
    >
      {children}
    </motion.div>
  )
}

interface MobileOptimizedGridItemProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  onLongPress?: () => void
}

export function MobileOptimizedGridItem({ 
  children, 
  className, 
  onClick, 
  onLongPress 
}: MobileOptimizedGridItemProps) {
  const isMobile = useIsMobile()

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        "group relative cursor-pointer",
        // Mobile-specific touch interactions
        isMobile && [
          "touch-manipulation",
          "active:scale-95",
          "transition-transform duration-100"
        ],
        className
      )}
      onClick={onClick}
      onTouchStart={isMobile && onLongPress ? (e) => {
        const timeoutId = setTimeout(() => {
          onLongPress()
          // Prevent click from firing after long press
          e.preventDefault()
        }, 500)
        
        const cleanup = () => {
          clearTimeout(timeoutId)
          document.removeEventListener('touchend', cleanup)
          document.removeEventListener('touchmove', cleanup)
        }
        
        document.addEventListener('touchend', cleanup)
        document.addEventListener('touchmove', cleanup)
      } : undefined}
      whileHover={!isMobile ? { scale: 1.02 } : undefined}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.div>
  )
} 