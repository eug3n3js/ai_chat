const API_BASE_URL = "http://localhost:3001";


export const RECAPTCHA_SITE_KEY =
  "6LfhaY0sAAAAAN_Cha6xcMFlVJdpAo1MAjz3wRYg";

export const isRecaptchaConfigured = RECAPTCHA_SITE_KEY.length > 0;

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
}
