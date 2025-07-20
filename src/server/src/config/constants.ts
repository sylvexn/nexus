export const MAX_FILE_SIZE = 250 * 1024 * 1024; // 250MB
export const DEFAULT_STORAGE_QUOTA = 20 * 1024 * 1024 * 1024; // 20GiB

const isDevelopment = process.env.NODE_ENV !== 'production';

export const API_DOMAIN = isDevelopment 
  ? process.env.DEV_API_DOMAIN || 'localhost:5042'
  : process.env.API_DOMAIN || 'nx.syl.rest';

export const FRONTEND_DOMAIN = isDevelopment
  ? process.env.DEV_FRONTEND_DOMAIN || 'localhost:5041'
  : process.env.FRONTEND_DOMAIN || 'nexus.syl.rest';

export const API_BASE_URL = isDevelopment
  ? `http://${API_DOMAIN}`
  : `https://${API_DOMAIN}`;

export const FRONTEND_BASE_URL = isDevelopment
  ? `http://${FRONTEND_DOMAIN}`
  : `https://${FRONTEND_DOMAIN}`;

export const ALLOWED_DOMAINS = [API_DOMAIN, FRONTEND_DOMAIN];

export const CORS_ORIGINS = [FRONTEND_BASE_URL];

export const DEFAULT_PORT = 5042; 

export const API_KEY_PREFIX_LENGTH = 8;
export const FILE_ID_LENGTH = 16;
export const ADMIN_INVITE_ID_LENGTH = 8;

export function getFileUrl(fileId: string, extension: string): string {
  return `${API_BASE_URL}/f/${fileId}${extension}`;
} 