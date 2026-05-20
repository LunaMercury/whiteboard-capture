const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const realtimeWsUrl = import.meta.env.VITE_REALTIME_WS_URL || 'ws://localhost:3000/ws';
const fastApiBaseUrl = import.meta.env.VITE_FAST_API_BASE_URL || 'http://localhost:3000';

// Keep URL construction in one place so dev/prod can switch transports without editing components.
export function getApiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

export function getFastApiUrl(path: string): string {
  return `${fastApiBaseUrl}${path}`;
}

export function getRealtimeWsUrl(token: string): string {
  const url = new URL(realtimeWsUrl);
  url.searchParams.set('token', token);
  return url.toString();
}
