/// <reference types="vite/client" />

const API_BASE = '/api'

export interface AdminDashboardData {
  metrics: {
    totalUsers: number
    totalFiles: number
    totalStorage: number
    activeInvites: number
  }
  charts: {
    uploadStats: Array<{ date: string; count: number }>
    fileTypes: Array<{ type: string; count: number }>
  }
}

export interface AdminInvite {
  id: string
  role_to_grant: 'user' | 'admin'
  created_by_id: string
  used_by_id: string | null
  used_at: string | null
  created_at: string
  used_by_username?: string
  created_by_username?: string
}

export interface AdminUser {
  id: string
  username: string
  role: 'user' | 'admin'
  avatar_url: string | null
  default_expiry_days: number
  storage_quota_bytes: number
  storage_used_bytes: number
  created_at: string
  file_count?: number
  api_key_count?: number
}

export interface AdminFile {
  id: string
  user_id: string
  original_filename: string
  mime_type: string
  size_bytes: number
  view_count: number
  download_count: number
  download_limit: number | null
  expires_at: string
  created_at: string
  owner_username?: string
}

export interface AdminAuditLog {
  id: string
  user_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  details: string | null
  created_at: string
  user_username?: string
}

export interface PaginationParams {
  page?: number
  limit?: number
  search?: string
  [key: string]: any
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

class AdminApiService {
  private async fetch(endpoint: string, options: RequestInit = {}) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    try {
      console.log(`Admin API request: ${API_BASE}/admin${endpoint}`)
      
      const response = await fetch(`${API_BASE}/admin${endpoint}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      })

      clearTimeout(timeoutId)

      console.log(`Admin API response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Admin API error response:', errorText)
        
        let error
        try {
          error = JSON.parse(errorText)
        } catch {
          error = { message: errorText || 'Unknown error' }
        }
        
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`Admin API success: ${endpoint}`, data)
      return data
    } catch (error) {
      clearTimeout(timeoutId)
      console.error(`Admin API fetch error for ${endpoint}:`, error)
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout - please try again')
        }
        throw error
      }
      
      throw new Error('Network error - please check your connection')
    }
  }

  async getDashboard(): Promise<AdminDashboardData> {
    return this.fetch('/dashboard')
  }

  async getInvites(params: PaginationParams = {}): Promise<{ invites: AdminInvite[]; pagination: any }> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.append(key, value.toString())
      }
    })
    
    return this.fetch(`/invites?${query}`)
  }

  async createInvite(role_to_grant: 'user' | 'admin'): Promise<AdminInvite> {
    return this.fetch('/invites', {
      method: 'POST',
      body: JSON.stringify({ role_to_grant }),
    })
  }

  async revokeInvite(inviteId: string): Promise<{ message: string }> {
    return this.fetch(`/invites/${inviteId}`, {
      method: 'DELETE',
    })
  }

  async getUsers(params: PaginationParams = {}): Promise<{ users: AdminUser[]; pagination: any }> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.append(key, value.toString())
      }
    })
    
    return this.fetch(`/users?${query}`)
  }

  async updateUser(userId: string, updates: Partial<Pick<AdminUser, 'default_expiry_days' | 'storage_quota_bytes' | 'role'>>): Promise<{ user: AdminUser }> {
    return this.fetch(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async getFiles(params: PaginationParams = {}): Promise<{ files: AdminFile[]; pagination: any }> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.append(key, value.toString())
      }
    })
    
    return this.fetch(`/files?${query}`)
  }

  async updateFile(fileId: string, expires_at: string): Promise<{ file: AdminFile }> {
    return this.fetch(`/files/${fileId}`, {
      method: 'PUT',
      body: JSON.stringify({ expires_at }),
    })
  }

  async getAuditLogs(params: PaginationParams = {}): Promise<{ logs: AdminAuditLog[]; actions: string[]; pagination: any }> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.append(key, value.toString())
      }
    })
    
    return this.fetch(`/logs?${query}`)
  }

  async getSettings(): Promise<{ globalSettings: { defaultExpiryDays: number; defaultStorageQuota: number } }> {
    return this.fetch('/settings')
  }

  async updateSettings(settings: { defaultExpiryDays: number; defaultStorageQuota: number }): Promise<{ message: string; globalSettings: any }> {
    return this.fetch('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  }
}

export const adminApi = new AdminApiService() 