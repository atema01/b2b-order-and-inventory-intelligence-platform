import { getToken } from '../storage/token';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

type RequestOptions = RequestInit & { token?: string | null };

export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> => {
  const { token, headers, ...rest } = options;
  const authToken = token ?? (await getToken());

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (authToken) {
    requestHeaders.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: requestHeaders,
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: data?.error || `Request failed (${response.status})`,
    };
  }

  return { ok: true, status: response.status, data };
};
