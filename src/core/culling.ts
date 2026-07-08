/**
 * Margem de corte por câmera, em px. Cobre o maior sprite assado do jogo
 * (boss Arquivista, raio 48 → meia-diagonal assada ≈156px) com folga, então
 * nada some visivelmente perto da borda da tela.
 */
export const CULL_MARGIN = 160;

/** Testa se um ponto do mundo cai dentro da tela (+ margem), dada a câmera. */
export function isVisible(
  x: number, y: number,
  camX: number, camY: number,
  vpW: number, vpH: number,
  margin = CULL_MARGIN,
): boolean {
  const sx = x - camX + vpW / 2;
  const sy = y - camY + vpH / 2;
  return sx > -margin && sx < vpW + margin && sy > -margin && sy < vpH + margin;
}
