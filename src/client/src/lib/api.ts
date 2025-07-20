import { 
  AuthResponse, 
  LoginRequest, 
  RegisterRequest, 
  ApiKey,
  File,
  Collection,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  UploadResponse
} from '@/types'
import { API_BASE_URL } from './config';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.text()
    throw new ApiError(response.status, error || `HTTP ${response.status}`)
  }

  return response.json()
}

export const authApi = {
  login: (data: LoginRequest): Promise<AuthResponse> =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  register: (data: RegisterRequest): Promise<AuthResponse> =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: (): Promise<void> =>
    apiRequest('/auth/logout', { method: 'POST' }),

  me: (): Promise<AuthResponse> =>
    apiRequest('/auth/me'),
}

export const filesApi = {
  getMyFiles: (params?: { 
    page?: number
    limit?: number
    search?: string
    type?: string
    collection_id?: string
  }): Promise<{ files: File[], total: number }> => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.search) searchParams.set('search', params.search)
    if (params?.type) searchParams.set('type', params.type)
    if (params?.collection_id) searchParams.set('collection_id', params.collection_id)
    
    const query = searchParams.toString()
    return apiRequest(`/files/me${query ? `?${query}` : ''}`)
  },

  getFile: (id: string): Promise<File> =>
    apiRequest(`/files/${id}`),

  deleteFile: (id: string): Promise<void> =>
    apiRequest(`/files/${id}`, { method: 'DELETE' }),

  deleteFiles: (fileIds: string[]): Promise<{ message: string; deletedCount: number; deletedFiles: string[] }> =>
    apiRequest('/files/bulk', { 
      method: 'DELETE',
      body: JSON.stringify({ fileIds })
    }),

  moveFilesToCollection: (fileIds: string[], collectionId: string): Promise<{ message: string; movedCount: number }> =>
    apiRequest('/files/bulk/move-to-collection', {
      method: 'POST',
      body: JSON.stringify({ fileIds, collectionId })
    }),

  removeFilesFromCollection: (fileIds: string[], collectionId: string): Promise<{ message: string; removedCount: number }> =>
    apiRequest('/files/bulk/remove-from-collection', {
      method: 'POST',
      body: JSON.stringify({ fileIds, collectionId })
    }),

  renameFile: (id: string, new_id: string): Promise<{ message: string; new_url: string }> =>
    apiRequest(`/files/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ new_id }),
    }),

  updateFile: (id: string, data: { 
    tags?: string[]; 
    expires_at?: string; 
    download_limit?: number | null 
  }): Promise<{ message: string }> =>
    apiRequest(`/files/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getFileAnalytics: (id: string): Promise<{
    file: File & { tags: string[] };
    analytics: Array<{ action: string; count: number; date: string }>;
    referrers: Array<{ referrer: string; count: number }>;
  }> =>
    apiRequest(`/files/${id}/analytics`),

  downloadFile: (id: string): Promise<string> =>
    fetch(`${API_BASE_URL}/api/files/${id}/download`, { credentials: 'include' })
      .then(response => response.url),

  upload: (formData: FormData, apiKey: string): Promise<UploadResponse> =>
    fetch('${API_BASE_URL}/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.text()
        throw new ApiError(response.status, error || `HTTP ${response.status}`)
      }
      return response.json()
    }),

  searchFiles: (filters: {
    query: string
    fileType: string[]
    dateRange: string
    sizeRange: [number, number]
    tags: string[]
    sortBy: string
    sortOrder: 'asc' | 'desc'
  }): Promise<{ files: File[] }> => {
    const searchParams = new URLSearchParams()
    if (filters.query) searchParams.set('search', filters.query)
    if (filters.fileType.length > 0) searchParams.set('types', filters.fileType.join(','))
    if (filters.dateRange !== 'all') searchParams.set('date_range', filters.dateRange)
    if (filters.sizeRange[0] > 0) searchParams.set('min_size', filters.sizeRange[0].toString())
    if (filters.sizeRange[1] < 250) searchParams.set('max_size', filters.sizeRange[1].toString())
    if (filters.tags.length > 0) searchParams.set('tags', filters.tags.join(','))
    if (filters.sortBy) searchParams.set('sort_by', filters.sortBy)
    if (filters.sortOrder) searchParams.set('sort_order', filters.sortOrder)
    
    const query = searchParams.toString()
    return apiRequest(`/files/search${query ? `?${query}` : ''}`)
  },

  getAllTags: (): Promise<{ tags: string[] }> =>
    apiRequest('/files/tags'),
}

export const apiKeysApi = {
  getMyApiKeys: (): Promise<ApiKey[]> =>
    apiRequest('/auth/api-keys').then((response: any) => response.api_keys),

  createApiKey: (data: CreateApiKeyRequest): Promise<CreateApiKeyResponse> =>
    apiRequest('/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteApiKey: (id: string): Promise<void> =>
    apiRequest(`${API_BASE_URL}/auth/api-keys/${id}`, { method: 'DELETE' }),
}

export const collectionsApi = {
  getMyCollections: (): Promise<{ collections: Collection[] }> =>
    apiRequest('/files/collections'),

  createCollection: (data: { name: string }): Promise<Collection> =>
    apiRequest('/files/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteCollection: (id: string): Promise<{ message: string }> =>
    apiRequest(`/files/collections/${id}`, { method: 'DELETE' }),

  addFileToCollection: (fileId: string, collectionId: string): Promise<{ message: string }> =>
    apiRequest(`/files/${fileId}/collections/${collectionId}`, { method: 'POST' }),

  removeFileFromCollection: (fileId: string, collectionId: string): Promise<{ message: string }> =>
    apiRequest(`/files/${fileId}/collections/${collectionId}`, { method: 'DELETE' }),
} 