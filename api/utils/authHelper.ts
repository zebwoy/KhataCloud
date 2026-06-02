import { HandlerEvent } from '@netlify/functions';
import { verifyJwt } from './jwt.js';

export interface AuthContext {
  userType: 'admin' | 'trial';
}

export function getAuthContext(event: HandlerEvent): AuthContext | null {
  try {
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
    
    const token = parts[1];
    const payload = verifyJwt(token);
    if (!payload || !payload.userType) return null;
    
    return {
      userType: payload.userType as 'admin' | 'trial'
    };
  } catch (error) {
    return null;
  }
}
