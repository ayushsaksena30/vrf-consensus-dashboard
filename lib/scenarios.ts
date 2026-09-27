export type ParameterRange = readonly [minimum: number, maximum: number];

export interface SimulationParameters {
  nodes: number;
  maliciousPercent: number;
  rounds: number;
  baseRate: number;
  slashPenalty: number;
  rewardAmount: number;
  trustFloor: number;
  trustCeil: number;
}

export interface ScenarioParameterRanges {
  nodes: ParameterRange;
  maliciousPercent: ParameterRange;
  rounds: ParameterRange;
  baseRate: ParameterRange;
  slashPenalty: ParameterRange;
  rewardAmount: ParameterRange;
  trustFloor: ParameterRange;
  trustCeil: ParameterRange;
}

export interface AttackScenario {
  name: string;
  parameters: ScenarioParameterRanges;
}

export const attackScenarios: AttackScenario[] = [
  {
    name: 'Baseline',
    parameters: {
      nodes: [45, 60],
      maliciousPercent: [25, 35],
      rounds: [800, 1200],
      baseRate: [0.18, 0.22],
      slashPenalty: [0.15, 0.25],
      rewardAmount: [0.04, 0.06],
      trustFloor: [0.12, 0.18],
      trustCeil: [1.8, 2.2],
    },
  },
  {
    name: 'Sybil Swarm',
    parameters: {
      nodes: [80, 150],
      maliciousPercent: [40, 60],
      rounds: [800, 1500],
      baseRate: [0.15, 0.3],
      slashPenalty: [0.05, 0.1],
      rewardAmount: [0.03, 0.08],
      trustFloor: [0.1, 0.25],
      trustCeil: [1.8, 3.0],
    },
  },
  {
    name: 'Draconian Network',
    parameters: {
      nodes: [40, 60],
      maliciousPercent: [5, 15],
      rounds: [800, 1200],
      baseRate: [0.18, 0.22],
      slashPenalty: [0.7, 0.9],
      rewardAmount: [0.01, 0.02],
      trustFloor: [0.1, 0.2],
      trustCeil: [1.8, 2.2],
    },
  },
];

function sampleRange([minimum, maximum]: ParameterRange, step: number) {
  const stepCount = Math.floor((maximum - minimum) / step + 1e-9);
  const value = minimum + Math.floor(Math.random() * (stepCount + 1)) * step;
  return Number(value.toFixed(4));
}

export function sampleScenarioParameters(ranges: ScenarioParameterRanges): SimulationParameters {
  return {
    nodes: sampleRange(ranges.nodes, 1),
    maliciousPercent: sampleRange(ranges.maliciousPercent, 1),
    rounds: sampleRange(ranges.rounds, 100),
    baseRate: sampleRange(ranges.baseRate, 0.01),
    slashPenalty: sampleRange(ranges.slashPenalty, 0.01),
    rewardAmount: sampleRange(ranges.rewardAmount, 0.01),
    trustFloor: sampleRange(ranges.trustFloor, 0.01),
    trustCeil: sampleRange(ranges.trustCeil, 0.1),
  };
}