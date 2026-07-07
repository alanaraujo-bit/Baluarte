# VANGUARDA — Resista à Ruína

Arena survival roguelite premium para navegador, mobile-first, construído inteiramente do zero — sem engine, sem frameworks, sem assets externos. HTML5 + CSS3 + TypeScript + Canvas 2D + Web Audio, empacotado como PWA offline.

## O jogo

Você é a Vanguarda: a última linha de defesa contra a Ruína, um enxame geométrico corrompido. Arraste o polegar para mover — o ataque é automático. Colete fragmentos, suba de nível e escolha melhorias aleatórias durante a partida. A cada cinco ondas, um Colosso aparece. Ao morrer, as moedas coletadas ficam com você e podem ser gastas no **Hangar** em melhorias permanentes.

- Sessões de 2–5 minutos, dificuldade crescente por ondas
- 13 melhorias de partida (perfurante, ricochete, lâminas orbitais, pulso nova, fragmentação...)
- 6 melhorias permanentes compradas com moedas
- Combo de abates multiplica o XP; recordes e progresso salvos localmente
- 6 tipos de inimigos + chefe com padrões de ataque próprios
- Trilha sonora synthwave e efeitos 100% sintetizados em tempo real (nenhum arquivo de áudio)
- Toda a arte é vetorial-neon procedural, pré-renderizada em atlas na inicialização

## Rodando

```bash
npm install
npm run dev        # servidor local em http://127.0.0.1:8137
npm run build      # build de produção em dist/
npm run typecheck  # verificação de tipos
npm run icons      # regenera os ícones PWA (PNG codificado à mão, sem deps)
```

Publique o conteúdo de `dist/` em qualquer host estático (HTTPS habilita o modo offline/instalável).

## Arquitetura

```
src/
  core/    game loop (hit-stop, time scale), viewport (DPR/safe-area),
           input (joystick virtual + teclado), save (localStorage), pools
  fx/      sprites neon pré-renderizados, partículas aditivas,
           números flutuantes, fundo parallax infinito (hash determinístico)
  audio/   sintetizador de SFX (Web Audio) e sequenciador musical com lookahead
  game/    balance (todos os números de tuning), player, inimigos (spatial hash),
           projéteis, armas, coletáveis, ondas, upgrades, meta-progressão, HUD,
           GameScene (orquestração via interface World)
  ui/      telas DOM (menu, hangar, ajustes, level-up, pausa, fim de jogo)
  i18n/    todo o texto do jogador em pt-BR
scripts/   build (esbuild), gerador de ícones (rasterizador SDF → PNG)
public/    index.html, styles.css, manifest, service worker, ícones
```

Princípios: dependências de runtime **zero** (esbuild/tsc apenas em dev), zero alocação em hot paths (pools + spatial hash com buckets carimbados), sistemas comunicam-se pela interface `World` com a `GameScene` no centro. Código e comentários em inglês; toda a experiência do jogador em português brasileiro.
