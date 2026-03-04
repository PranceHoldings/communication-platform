/**
 * 共通型定義
 */

export type UserRole = 'super_admin' | 'client_admin' | 'client_user';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  orgId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Avatar {
  id: string;
  name: string;
  type: '2d' | '3d';
  style: 'anime' | 'real';
  source: 'preset' | 'generated' | 'org_custom';
  modelUrl: string;
  thumbnailUrl: string;
}

export interface Session {
  id: string;
  userId: string;
  scenarioId: string;
  avatarId: string;
  status: 'active' | 'processing' | 'completed' | 'error';
  startedAt: Date;
  endedAt?: Date;
}

export interface TranscriptEntry {
  id: string;
  sessionId: string;
  speaker: 'AI' | 'USER';
  text: string;
  timestampStart: number;
  timestampEnd: number;
  confidence: number;
  isConfirmed: boolean;
}
