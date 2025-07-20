import type { Database } from 'bun:sqlite'
import type { User } from '../../../shared'

export interface HonoContext {
  Variables: {
    db: Database
    user?: Omit<User, 'hashed_password'>
  }
} 