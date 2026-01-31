
export interface UserPayload {
  id: string;
  name: string;
  role: string;
  type: 'buyer' | 'seller';
  exp: number;
}

// Simulate JWT Secret (In a real app, this is server-side only)
const SECRET_KEY = 'b2b-intel-secure-secret-key';

export const generateToken = (user: { id: string; name: string; role: string; type: 'buyer' | 'seller' }): string => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: UserPayload = {
    ...user,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hour expiry
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = btoa(`${encodedHeader}.${encodedPayload}.${SECRET_KEY}`); // Mock signature

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

export const parseToken = (token: string): UserPayload | null => {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;

    // Verify signature (Simple mock verification)
    const expectedSignature = btoa(`${header}.${payload}.${SECRET_KEY}`);
    if (signature !== expectedSignature) return null;

    const decodedPayload = JSON.parse(atob(payload));
    
    // Check expiry
    if (Date.now() > decodedPayload.exp) return null;

    return decodedPayload;
  } catch (e) {
    return null;
  }
};

export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem('auth_token');
  if (!token) return false;
  return parseToken(token) !== null;
};

export const getUserFromToken = (): UserPayload | null => {
  const token = localStorage.getItem('auth_token');
  if (!token) return null;
  return parseToken(token);
};

export const hashPassword = async (password: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};
