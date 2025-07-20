import { motion } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface EnhancedSkeletonProps {
  className?: string
  variant?: 'default' | 'file-card' | 'list-item' | 'circular'
  count?: number
}

const shimmerVariants = {
  animate: {
    backgroundPosition: ['200% 0', '-200% 0'],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'linear'
    }
  }
}

export function EnhancedSkeleton({ 
  className, 
  variant = 'default',
  count = 1 
}: EnhancedSkeletonProps) {
  const { actualTheme } = useTheme()

  const shimmerBg = actualTheme === 'dark' 
    ? 'linear-gradient(90deg, transparent, rgba(147, 51, 234, 0.1), transparent)'
    : 'linear-gradient(90deg, transparent, rgba(147, 51, 234, 0.05), transparent)'

  const baseClasses = cn(
    "animate-pulse rounded-md bg-muted relative overflow-hidden",
    className
  )

  const getVariantClasses = () => {
    switch (variant) {
      case 'file-card':
        return "h-32 w-full"
      case 'list-item':
        return "h-12 w-full"
      case 'circular':
        return "h-10 w-10 rounded-full"
      default:
        return "h-4 w-full"
    }
  }

  const SkeletonItem = () => (
    <motion.div
      variants={shimmerVariants}
      animate="animate"
      className={cn(baseClasses, getVariantClasses())}
      style={{
        backgroundImage: shimmerBg,
        backgroundSize: '200% 100%',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
    </motion.div>
  )

  if (count === 1) {
    return <SkeletonItem />
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <SkeletonItem />
        </motion.div>
      ))}
    </div>
  )
}

export function FileGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
        >
          <EnhancedSkeleton variant="file-card" />
        </motion.div>
      ))}
    </div>
  )
}

export function FileListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <EnhancedSkeleton variant="list-item" />
        </motion.div>
      ))}
    </div>
  )
} 