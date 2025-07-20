import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const iconVariants = {
  initial: { 
    scale: 0, 
    rotate: -180,
    opacity: 0,
  },
  animate: { 
    scale: 1, 
    rotate: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 20,
      duration: 0.3
    }
  },
  exit: { 
    scale: 0, 
    rotate: 180,
    opacity: 0,
    transition: {
      duration: 0.2
    }
  }
}

const glowVariants = {
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(147, 51, 234, 0)",
      "0 0 10px 2px rgba(147, 51, 234, 0.3)",
      "0 0 0 0 rgba(147, 51, 234, 0)",
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
}

export function ThemeToggle() {
  const { theme, actualTheme, setTheme } = useTheme()

  const getCurrentIcon = () => {
    switch (actualTheme) {
      case 'dark':
        return <Moon className="h-4 w-4" />
      case 'light':
        return <Sun className="h-4 w-4" />
      default:
        return <Monitor className="h-4 w-4" />
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.div
          variants={glowVariants}
          animate="animate"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="relative h-9 w-9 rounded-lg border border-border/50 bg-background/50 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground transition-all duration-300"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={actualTheme}
                variants={iconVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="absolute inset-0 flex items-center justify-center"
              >
                {getCurrentIcon()}
              </motion.div>
            </AnimatePresence>
            <motion.div
              className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-500/10 via-purple-400/5 to-purple-300/10"
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          </Button>
        </motion.div>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="min-w-32 bg-background/95 backdrop-blur-sm border border-border/50"
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <DropdownMenuItem 
            onClick={() => setTheme('light')}
            className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Sun className="h-4 w-4" />
            </motion.div>
            light
            {theme === 'light' && (
              <motion.div
                className="ml-auto h-2 w-2 rounded-full bg-purple-500"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
              />
            )}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setTheme('dark')}
            className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <motion.div
              whileHover={{ scale: 1.1, rotate: -5 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Moon className="h-4 w-4" />
            </motion.div>
            dark
            {theme === 'dark' && (
              <motion.div
                className="ml-auto h-2 w-2 rounded-full bg-purple-500"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
              />
            )}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setTheme('system')}
            className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Monitor className="h-4 w-4" />
            </motion.div>
            system
            {theme === 'system' && (
              <motion.div
                className="ml-auto h-2 w-2 rounded-full bg-purple-500"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
              />
            )}
          </DropdownMenuItem>
        </motion.div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 