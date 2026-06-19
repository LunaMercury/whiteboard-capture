const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:18080';
const realtimeWsUrl = import.meta.env.VITE_REALTIME_WS_URL || 'ws://localhost:18081/ws';
const fastApiBaseUrl = import.meta.env.VITE_FAST_API_BASE_URL || 'http://localhost:18081';

// 네이버 OAuth 로그인 URL (백엔드 라우팅 기준)
export const NAVER_OAUTH_URL = `${apiBaseUrl}/auth/naver/login`;

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
