import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Files, 
  Settings, 
  Upload, 
  LogOut,
} from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { DialogTitle } from "@/components/ui/dialog"
import { useAuthStore } from '@/store/auth'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { logout } = useAuthStore()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  const runCommand = (command: () => void) => {
    onOpenChange(false)
    command()
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only">command palette</DialogTitle>
      <CommandInput placeholder="type a command or search..." />
      <CommandList>
        <CommandEmpty>no results found.</CommandEmpty>
        <CommandGroup heading="navigation">
          <CommandItem onSelect={() => runCommand(() => navigate('/'))}>
            <Files className="mr-2 h-4 w-4" />
            <span>files</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>settings</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="actions">
          <CommandItem onSelect={() => runCommand(() => {
            // Trigger file upload
            const input = document.createElement('input')
            input.type = 'file'
            input.multiple = true
            input.click()
          })}>
            <Upload className="mr-2 h-4 w-4" />
            <span>upload files</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="account">
          <CommandItem onSelect={() => runCommand(() => {
            logout()
            navigate('/login')
          })}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>sign out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
} 