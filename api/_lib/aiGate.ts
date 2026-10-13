import { errorResponse } from './http';
import type { AiGate } from './usage';

/** Maps a failed AI gate to its HTTP response (null when allowed). */
export function aiGateResponse(gate: AiGate): Response | null {
  if (gate === 'ok') return null;
  if (gate === 'user_quota') return errorResponse(429, 'quota_exceeded', 'Daily extraction limit reached');
  return errorResponse(503, 'ai_capacity', 'AI reading is at capacity right now. Try again later.');
}
