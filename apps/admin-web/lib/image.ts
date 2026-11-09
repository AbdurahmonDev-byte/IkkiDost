import { API_URL } from './api';

const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

/** Product image paths come back relative (`/uploads/...`); make them absolute. */
export function imageSrc(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_ORIGIN}${path}`;
}
