/** Identity attached to requests authenticated with a user access token (web app). */
export interface AuthContext {
  userId: string;
  sessionId: string;
}

/** Identity attached to requests authenticated with a device credential (VS Code extension). */
export interface DeviceContext {
  deviceId: string;
  userId: string;
}
