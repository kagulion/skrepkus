import { Battle, ClipsState, has } from './state';

export const BATTLE_WIDTH = 310;
export const BATTLE_HEIGHT = 150;
export const ROUND_SECONDS = 0.4;
const MAX_SQUADRONS = 100;

export function checkForBattles(s: ClipsState): void {
  if (s.battle || s.probeCount < 1 || s.drifterCount <= s.warTrigger) return;

  const scale = Math.max(1, Math.ceil(Math.max(s.probeCount, s.drifterCount) / MAX_SQUADRONS));
  const probes = Math.ceil(s.probeCount / scale);
  const drifters = Math.ceil(s.drifterCount / scale);
  s.battle = {
    scale,
    initialProbes: probes,
    initialDrifters: drifters,
    probes,
    drifters,
    elapsed: 0,
    outcome: null,
    honor: null,
  };
  s.battleFlag = true;
  s.battleID++;
  s.battleName = s.battleNameFlag ? `Рубеж №${s.battleID}` : `Атака дрейферов ${s.battleID}`;
}

function losses(fleet: number, attackers: number, strength: number, defense: number): number {
  if (fleet === 0 || strength <= 0 || attackers === 0) return 0;
  const pressure = (attackers * strength) / (fleet * defense);
  const fraction = (pressure / (1 + pressure)) * (0.15 + Math.random() * 0.15);
  return Math.max(1, Math.floor(fleet * fraction));
}

function resolveRound(s: ClipsState, b: Battle): void {
  const probes = Math.min(b.probes, Math.ceil(s.probeCount / b.scale));
  const drifters = Math.min(b.drifters, Math.ceil(s.drifterCount / b.scale));
  const maneuver = s.attackSpeedFlag ? 1 + s.probeSpeed / 4 : 1;
  const lostProbes = losses(probes, drifters, s.drifterCombat, maneuver);
  const lostDrifters = losses(drifters, probes, s.probeCombat, 1);
  const probeLoss = Math.min(s.probeCount, lostProbes * b.scale);
  const drifterLoss = Math.min(s.drifterCount, lostDrifters * b.scale);
  s.probeCount -= probeLoss;
  s.drifterCount -= drifterLoss;
  s.probesLostCombat += probeLoss;
  s.driftersKilled += drifterLoss;
  b.probes = Math.min(Math.max(0, probes - lostProbes), Math.ceil(s.probeCount / b.scale));
  b.drifters = Math.min(Math.max(0, drifters - lostDrifters), Math.ceil(s.drifterCount / b.scale));

  if (b.probes > 0 && b.drifters > 0) return;
  b.outcome = b.probes > 0 ? 'win' : b.drifters > 0 ? 'loss' : 'draw';
  if (!has(s, '121') || b.outcome === 'draw') return;
  if (b.outcome === 'win') {
    s.honorReward = b.initialDrifters + s.bonusHonor;
    s.honor += s.honorReward;
    if (has(s, '134')) s.bonusHonor += 10;
    b.honor = s.honorReward;
  } else {
    s.honor -= b.initialProbes;
    s.bonusHonor = 0;
    s.threnodyTitle = s.battleName;
    b.honor = -b.initialProbes;
  }
}

export function stepBattle(s: ClipsState, dt: number): void {
  const b = s.battle;
  if (!b) return;
  b.elapsed += dt;
  while (!b.outcome && b.elapsed >= ROUND_SECONDS) {
    b.elapsed -= ROUND_SECONDS;
    resolveRound(s, b);
  }
  if (b.outcome && b.elapsed >= s.battleEndTimer * 0.016) s.battle = null;
}
