const isDevelopment = import.meta.env.DEV;

export const API_BASE_URL = isDevelopment 
  ? 'http://localhost:5042'
  : 'https://nx.syl.rest';

export const FRONTEND_BASE_URL = isDevelopment
  ? 'http://localhost:5041'
  : 'https://nexus.syl.rest';

export function getFileUrl(fileId: string, extension?: string): string {
  const ext = extension || '';
  return `${API_BASE_URL}/f/${fileId}${ext}`;
}

export function getFileViewUrl(fileId: string): string {
  return `${API_BASE_URL}/f/${fileId}`;
}

export function getFileDirectUrl(fileId: string, extension: string): string {
  return `${API_BASE_URL}/f/${fileId}${extension}`;
}

export function getFileDownloadUrl(fileId: string): string {
  return `${API_BASE_URL}/api/files/${fileId}/download`;
}

export function getShareableFileUrl(fileId: string): string {
  return `${API_BASE_URL}/f/${fileId}`;
} 