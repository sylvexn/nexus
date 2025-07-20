export interface User {
  id: string
  username: string
  role: 'user' | 'admin'
  avatar_url?: string
  default_expiry_days: number
  storage_quota_bytes: number
  storage_used_bytes: number
  created_at: string
}

export interface ApiKey {
  id: string
  user_id: string
  label: string
  key_prefix: string
  total_uploads: number
  total_bytes_uploaded: number
  created_at: string
  last_used_at?: string
}

export interface File {
  id: string
  user_id: string
  original_filename: string
  mime_type: string
  size_bytes: number
  view_count: number
  download_count: number
  download_limit?: number
  expires_at: string
  created_at: string
  tags: string[]
}

export interface Collection {
  id: string
  user_id: string
  name: string
  created_at: string
  file_count?: number
}

export interface UploadResponse {
  url: string
}

export interface AuthResponse {
  user: User
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  invite_code: string
}

export interface CreateApiKeyRequest {
  label: string
}

export interface CreateApiKeyResponse {
  key: string
  api_key: ApiKey
} 