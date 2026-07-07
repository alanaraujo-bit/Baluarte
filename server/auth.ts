import { jwtVerify } from 'jose';

/**
 * Verifies the short-lived realtime JWT minted by /api/realtime-token.
 * Same HS256 secret as the HTTP API (JWT_SECRET env, shared across deploys),
 * plus an audience pin so a stolen session cookie can't be replayed here.
 */

export interface RtClaims {
  playerId: string;
  handle: string;
}

export async function verifyRealtimeToken(token: string): Promise<RtClaims | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[auth] JWT_SECRET não configurado no ambiente do game server');
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
      audience: 'rt',
    });
    if (typeof payload.sub !== 'string' || typeof payload.hnd !== 'string') {
      console.error('[auth] token válido mas sem claims sub/hnd esperadas');
      return null;
    }
    return { playerId: payload.sub, handle: payload.hnd };
  } catch (e) {
    // Nunca loga o token/segredo — só a razão da falha (assinatura, audience,
    // expiração etc.), o suficiente pra diagnosticar sem expor credenciais.
    const name = e instanceof Error ? e.name : 'unknown';
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[auth] falha ao verificar token realtime: ${name} — ${message}`);
    return null;
  }
}
