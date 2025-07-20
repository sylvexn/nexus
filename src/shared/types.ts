export interface User {
  id: string;
  username: string;
  hashed_password: string;
  role: 'user' | 'admin';
  avatar_url?: string;
  default_expiry_days: number;
  storage_quota_bytes: number;
  storage_used_bytes: number;
  created_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  label: string;
  hashed_key: string;
  key_prefix: string;
  total_uploads: number;
  total_bytes_uploaded: number;
  created_at: string;
  last_used_at?: string;
}

export interface File {
  id: string;
  user_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  view_count: number;
  download_count: number;
  download_limit?: number;
  expires_at: string;
  created_at: string;
}

export interface FileTag {
  id: string;
  file_id: string;
  tag: string;
  created_at: string;
}

export interface FileAnalytics {
  id: string;
  file_id: string;
  ip_address: string;
  user_agent?: string;
  referrer?: string;
  action: 'view' | 'download';
  created_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Invite {
  id: string;
  role_to_grant: 'user' | 'admin';
  created_by_id: string;
  used_by_id?: string;
  used_at?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: string;
  created_at: string;
}

export interface ShareXResponse {
  url: string;
}

export interface AuthResponse {
  user: Omit<User, 'hashed_password'>;
}

export interface ErrorResponse {
  error: string;
  message: string;
} 