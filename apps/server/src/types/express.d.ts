import type { AuthContext, DeviceContext } from './auth';

declare global {
  namespace Express {
    interface Request {
      valid?: Partial<Record<'body' | 'query' | 'params', unknown>>;
      auth?: AuthContext;
      device?: DeviceContext;
    }
  }
}

export {};
