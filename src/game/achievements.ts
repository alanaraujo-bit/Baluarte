import type { SaveData } from '../core/save';
import { META_DEFS } from './meta';
import { CAMPAIGN } from './campaign';

/**
 * 20 conquistas cuidadosamente balanceadas, cobrindo todos os sistemas
 * do jogo: kills, tempo, moedas, campanha, chefes, skins, melhorias,
 * gemas, pontuação e ondas.
 *
 * Fácil (6)  — 25-50 moedas  — todo jogador consegue com algumas partidas
 * Médio (8)  — 75-150 moedas — exige dedicação moderada
 * Difícil (6) — 200-500 moedas — só os pilotos mais dedicados
 *
 * Total de recompensa possível: ~3.080 moedas
 * (o suficiente pra comprar quase todas as skins)
 */

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
  category: 'easy' | 'medium' | 'hard';
  reward: number;
}

function ach(
  id: string, name: string, desc: string, icon: string, color: string,
  category: 'easy' | 'medium' | 'hard', reward: number,
): AchievementDef {
  return { id, name, desc, icon, color, category, reward };
}

export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  // ═══════════════════════════════════════════════
  // FÁCEIS (6)
  // ═══════════════════════════════════════════════

  ach(
    'primeira-partida', 'Primeira Partida',
    'Complete sua primeira partida',
    'multi', '#35f0ff', 'easy', 25,
  ),
  ach(
    'aprendiz', 'Aprendiz',
    'Conclua o tutorial',
    'vital', '#52ffa8', 'easy', 25,
  ),
  ach(
    'centena', 'Centena',
    'Elimine 100 inimigos no total',
    'pierce', '#ff5d73', 'easy', 30,
  ),
  ach(
    'primeira-estrela', 'Primeira Estrela',
    'Ganhe sua primeira estrela na campanha',
    'power', '#ffc857', 'easy', 30,
  ),
  ach(
    'coletor', 'Coletor',
    'Colete 500 gemas no total',
    'magnet', '#52ffa8', 'easy', 40,
  ),
  ach(
    'rico', 'Rico',
    'Acumule 500 moedas',
    'coin', '#ffc857', 'easy', 50,
  ),

  // ═══════════════════════════════════════════════
  // MÉDIOS (8)
  // ═══════════════════════════════════════════════

  ach(
    'veterano', 'Veterano',
    'Alcance a onda 10 em uma única partida',
    'thrusters', '#35f0ff', 'medium', 75,
  ),
  ach(
    'implacavel', 'Implacável',
    'Complete 10 partidas',
    'rate', '#ff5d73', 'medium', 75,
  ),
  ach(
    'exterminador', 'Exterminador',
    'Elimine 1.000 inimigos no total',
    'frag', '#ff9f43', 'medium', 100,
  ),
  ach(
    'invencivel', 'Invencível',
    'Sobreviva 30 minutos no total',
    'vital', '#52ffa8', 'medium', 100,
  ),
  ach(
    'colecionador', 'Colecionador',
    'Tenha 3 skins diferentes',
    'coin', '#f368e0', 'medium', 100,
  ),
  ach(
    'maximizado', 'Maximizado',
    'Chegue ao nível máximo em 3 melhorias permanentes',
    'crit', '#c56cf0', 'medium', 125,
  ),
  ach(
    'matador-de-chefes', 'Matador de Chefes',
    'Derrote todos os 3 chefes',
    'blades', '#ffc857', 'medium', 150,
  ),
  ach(
    'tricampeao', 'Tricampeão',
    'Consiga 3 estrelas em 5 fases da campanha',
    'ricochet', '#ffc857', 'medium', 150,
  ),

  // ═══════════════════════════════════════════════
  // DIFÍCEIS (6)
  // ═══════════════════════════════════════════════

  ach(
    'sobrevivente-lendario', 'Sobrevivente Lendário',
    'Sobreviva 1 hora no total',
    'regen', '#52ffa8', 'hard', 200,
  ),
  ach(
    'lendario', 'Lendário',
    'Alcance a onda 15 em uma única partida',
    'thrusters', '#ffc857', 'hard', 250,
  ),
  ach(
    'pontuacao-maxima', 'Pontuação Máxima',
    'Alcance 500.000 pontos',
    'crit', '#ffc857', 'hard', 300,
  ),
  ach(
    'completista', 'Completista',
    'Complete todas as 20 fases da campanha',
    'ricochet', '#35f0ff', 'hard', 350,
  ),
  ach(
    'legado', 'Legado',
    'Consiga 3 estrelas em todas as fases da campanha',
    'vital', '#ffc857', 'hard', 500,
  ),
  ach(
    'a-lenda', 'A Lenda',
    'Alcance a onda 20 em uma única partida',
    'power', '#ffc857', 'hard', 500,
  ),
];

// ————— checker —————

/**
 * Examina o estado atual do save e retorna os IDs das conquistas
 * que acabaram de ser desbloqueadas (ainda não estão em `unlocked`).
 * Totalmente baseado em stats persistentes — não precisa de contexto
 * de run porque os dados já foram salvos antes da chamada.
 */
export function checkAchievements(save: SaveData, unlocked: string[]): string[] {
  const newly: string[] = [];
  const has = (id: string) => unlocked.includes(id);

  /** Quantas fases têm pelo menos N estrelas. */
  const starsAtLeast = (min: number) =>
    Object.values(save.campaignStars).filter((v) => v >= min).length;

  // Fáceis
  if (!has('primeira-partida') && save.runs >= 1) newly.push('primeira-partida');
  if (!has('aprendiz') && save.tutorialDone) newly.push('aprendiz');
  if (!has('centena') && save.totalKills >= 100) newly.push('centena');
  if (!has('primeira-estrela') && starsAtLeast(1) >= 1) newly.push('primeira-estrela');
  if (!has('coletor') && save.totalGems >= 500) newly.push('coletor');
  if (!has('rico') && save.coins >= 500) newly.push('rico');

  // Médios
  if (!has('veterano') && save.bestWave >= 10) newly.push('veterano');
  if (!has('implacavel') && save.runs >= 10) newly.push('implacavel');
  if (!has('exterminador') && save.totalKills >= 1000) newly.push('exterminador');
  if (!has('invencivel') && save.totalTime >= 1800) newly.push('invencivel');
  if (!has('colecionador') && save.ownedSkins.length >= 3) newly.push('colecionador');
  if (!has('maximizado')) {
    const maxedCount = META_DEFS.filter((d) => (save.meta[d.id] ?? 0) >= d.max).length;
    if (maxedCount >= 3) newly.push('maximizado');
  }
  if (!has('matador-de-chefes')) {
    const killed = save.bossesKilled ?? [];
    if (killed.includes('boss') && killed.includes('queen') && killed.includes('archivist')) {
      newly.push('matador-de-chefes');
    }
  }
  if (!has('tricampeao') && starsAtLeast(3) >= 5) newly.push('tricampeao');

  // Difíceis
  if (!has('sobrevivente-lendario') && save.totalTime >= 3600) newly.push('sobrevivente-lendario');
  if (!has('lendario') && save.bestWave >= 15) newly.push('lendario');
  if (!has('pontuacao-maxima') && save.bestScore >= 500_000) newly.push('pontuacao-maxima');
  if (!has('completista') && save.campaignLevel >= 21) newly.push('completista');
  if (!has('legado') && starsAtLeast(3) >= CAMPAIGN.length) newly.push('legado');
  if (!has('a-lenda') && save.bestWave >= 20) newly.push('a-lenda');

  return newly;
}
