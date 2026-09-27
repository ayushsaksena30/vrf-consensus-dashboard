'use client';

import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { BarChart } from '@tremor/react';
import { ChevronDown, ChevronUp, Download, ExternalLink, Pause, Play, RotateCcw } from 'lucide-react';
import { run_simulation } from 'vrf-bft-simulator';
import { NetworkTopology, type RoundSnapshot } from '@/components/network-topology';
import { attackScenarios, sampleScenarioParameters, type SimulationParameters } from '@/lib/scenarios';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { HoverHint, TooltipProvider } from '@/components/ui/tooltip';

interface SimulationResult {
  malicious_selection_count: number;
  probability: number;
  baseline_probability: number;
  reduction_percentage: number;
  malicious_node_ids: number[];
  snapshots: RoundSnapshot[];
}

const playbackSpeeds = ['0.5x', '1x', '2x', '4x', 'Custom'] as const;
type PlaybackSpeed = (typeof playbackSpeeds)[number];

function shuffleNodeIds(count: number) {
  const ids = Array.from({ length: count }, (_, index) => index + 1);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
  }
  return ids;
}

export default function Dashboard() {
  const [isWasmReady, setIsWasmReady] = useState(false);
  const [data, setData] = useState<SimulationResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSimulationReset, setIsSimulationReset] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [previewMaliciousNodeOrder] = useState(() => shuffleNodeIds(200));
  const [lastRunConfig, setLastRunConfig] = useState<SimulationParameters | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>('1x');
  const [customSpeed, setCustomSpeed] = useState(2);

  // Core Hyperparameters
  const [nodes, setNodes] = useState(50);
  const [maliciousPercent, setMaliciousPercent] = useState(30);
  const [rounds, setRounds] = useState(1000);
  const [baseRate, setBaseRate] = useState(0.2);

  // Advanced Hyperparameters
  const [slashPenalty, setSlashPenalty] = useState(0.2);
  const [rewardAmount, setRewardAmount] = useState(0.05);
  const [trustFloor, setTrustFloor] = useState(0.15);
  const [trustCeil, setTrustCeil] = useState(2.0);

  const canResetSimulation = data !== null
    && !isSimulationReset
    && lastRunConfig?.nodes === nodes
    && lastRunConfig.maliciousPercent === maliciousPercent
    && lastRunConfig.rounds === rounds
    && lastRunConfig.baseRate === baseRate
    && lastRunConfig.slashPenalty === slashPenalty
    && lastRunConfig.rewardAmount === rewardAmount
    && lastRunConfig.trustFloor === trustFloor
    && lastRunConfig.trustCeil === trustCeil;

  const maliciousCount = Math.round((maliciousPercent / 100) * nodes);
  const previewMaliciousNodeIds = useMemo(
    () => previewMaliciousNodeOrder.filter((id) => id <= nodes).slice(0, maliciousCount),
    [maliciousCount, nodes, previewMaliciousNodeOrder],
  );

  const runSimulationWithParameters = (parameters: SimulationParameters, presetName: string | null = null, autoplay = false) => {
    const nextMaliciousCount = Math.round((parameters.maliciousPercent / 100) * parameters.nodes);
    setNodes(parameters.nodes);
    setMaliciousPercent(parameters.maliciousPercent);
    setRounds(parameters.rounds);
    setBaseRate(parameters.baseRate);
    setSlashPenalty(parameters.slashPenalty);
    setRewardAmount(parameters.rewardAmount);
    setTrustFloor(parameters.trustFloor);
    setTrustCeil(parameters.trustCeil);

    const result = run_simulation(
      parameters.nodes,
      nextMaliciousCount,
      parameters.rounds,
      parameters.baseRate,
      parameters.slashPenalty,
      parameters.rewardAmount,
      parameters.trustFloor,
      parameters.trustCeil,
    ) as Omit<SimulationResult, 'malicious_node_ids'> & { malicious_node_ids?: number[] };
    const simulationResult: SimulationResult = {
      ...result,
      malicious_node_ids: Array.isArray(result.malicious_node_ids)
        ? result.malicious_node_ids
        : shuffleNodeIds(parameters.nodes).slice(0, nextMaliciousCount),
    };
    setLastRunConfig(parameters);
    setSelectedPreset(presetName);
    setCurrentRound(0);
    setIsPlaying(autoplay);
    setIsSimulationReset(false);
    setData(simulationResult);
  };

  const runSimulation = (autoplay = false) => runSimulationWithParameters({
    nodes,
    maliciousPercent,
    rounds,
    baseRate,
    slashPenalty,
    rewardAmount,
    trustFloor,
    trustCeil,
  }, selectedPreset, autoplay);

  const applyPreset = (preset: (typeof attackScenarios)[number]) => {
    const parameters = sampleScenarioParameters(preset.parameters);
    setNodes(parameters.nodes);
    setMaliciousPercent(parameters.maliciousPercent);
    setRounds(parameters.rounds);
    setBaseRate(parameters.baseRate);
    setSlashPenalty(parameters.slashPenalty);
    setRewardAmount(parameters.rewardAmount);
    setTrustFloor(parameters.trustFloor);
    setTrustCeil(parameters.trustCeil);
    setSelectedPreset(preset.name);
    setIsPlaying(false);
    setCurrentRound(0);
    setIsSimulationReset(true);
  };

  const downloadReport = () => {
    if (!data) return;

    const report = {
      generated_at: new Date().toISOString(),
      simulation_parameters: lastRunConfig,
      malicious_selection_count: data.malicious_selection_count,
      probability: data.probability,
      snapshots: data.snapshots,
    };
    const reportBlob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const reportUrl = URL.createObjectURL(reportBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = reportUrl;
    downloadLink.download = `vrf-consensus-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    downloadLink.hidden = true;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(reportUrl), 0);
  };

  const onWasmReady = useEffectEvent(() => {
    setIsWasmReady(true);
    runSimulation();
  });

  useEffect(() => {
    Promise.resolve().then(() => onWasmReady()).catch(console.error);
  }, []);

  const snapshots = data?.snapshots ?? [];
  const previewSnapshot = useMemo<RoundSnapshot>(() => ({
    validators: [],
    slashed_nodes: [],
    trust_scores: Array.from({ length: nodes }, () => 1),
  }), [nodes]);
  const isPreviewRound = currentRound === 0;
  const currentSnapshot = isPreviewRound ? previewSnapshot : snapshots[currentRound - 1] ?? previewSnapshot;
  const configMatchesSimulation = lastRunConfig?.nodes === nodes && lastRunConfig.maliciousPercent === maliciousPercent;
  const maliciousNodeIds = data && (currentRound > 0 || configMatchesSimulation)
    ? data.malicious_node_ids
    : previewMaliciousNodeIds;
  const speedMultiplier = playbackSpeed === 'Custom' ? customSpeed : Number.parseFloat(playbackSpeed);
  const selectedSpeedIndex = playbackSpeeds.indexOf(playbackSpeed);

  const trustDistributionData = useMemo(() => {
    const buckets = [
      { range: '0.0-0.5', nodes: 0 },
      { range: '0.5-1.0', nodes: 0 },
      { range: '1.0-1.5', nodes: 0 },
      { range: '1.5-2.0+', nodes: 0 },
    ];

    currentSnapshot.trust_scores.forEach((score) => {
      if (score < 0.5) buckets[0].nodes += 1;
      else if (score < 1.0) buckets[1].nodes += 1;
      else if (score < 1.5) buckets[2].nodes += 1;
      else buckets[3].nodes += 1;
    });

    return buckets;
  }, [currentSnapshot]);

  const advancePlayback = useEffectEvent(() => {
    if (!isPlaying) return;
    if (currentRound >= snapshots.length) {
      setIsPlaying(false);
      return;
    }
    setCurrentRound(currentRound + 1);
  });

  useEffect(() => {
    if (!isPlaying) return;

    const intervalId = window.setInterval(() => advancePlayback(), 200 / speedMultiplier);
    return () => window.clearInterval(intervalId);
  }, [isPlaying, speedMultiplier]);

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-background p-4 text-foreground sm:p-6">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="mb-5 flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 className="text-sm font-semibold text-foreground">Made by Ayush Saksena</h2>
              <nav aria-label="Ayush Saksena links" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <a className="underline underline-offset-4 transition-colors hover:text-foreground" href="https://github.com/ayushsaksena30/" rel="noreferrer" target="_blank">GitHub</a>
                <a className="underline underline-offset-4 transition-colors hover:text-foreground" href="https://www.linkedin.com/in/ayush-saksena/" rel="noreferrer" target="_blank">LinkedIn</a>
                <a className="underline underline-offset-4 transition-colors hover:text-foreground" href="https://ayush-saksena.vercel.app/" rel="noreferrer" target="_blank">Portfolio</a>
                <a className="underline underline-offset-4 transition-colors hover:text-foreground" href="mailto:asaksena100@gmail.com">Email</a>
              </nav>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-3">
            <Button asChild variant="outline">
              <a href="https://github.com/ayushsaksena30/vrf-bft-simulator-rust" rel="noreferrer" target="_blank">
                Simulator engine repository
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            </Button>
            <Button disabled={!data} onClick={downloadReport} variant="outline">
              <Download aria-hidden="true" className="size-4" />
              Download Report
            </Button>
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 space-y-6 lg:w-80">
          <div>
            <div className="mb-5">
              <h1 className="text-2xl font-semibold tracking-tight">VRF Consensus</h1>
              <p className="mt-1 text-sm text-muted-foreground">BFT Network Simulation</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Attack scenarios</p>
            <div className="grid grid-cols-3 gap-2">
              {attackScenarios.map((preset) => (
                <HoverHint content={`Stage ${preset.name}: ${preset.parameters.nodes[0]}-${preset.parameters.nodes[1]} nodes, ${preset.parameters.maliciousPercent[0]}-${preset.parameters.maliciousPercent[1]}% malicious, base rate ${preset.parameters.baseRate[0]}-${preset.parameters.baseRate[1]}, slash penalty ${preset.parameters.slashPenalty[0]}-${preset.parameters.slashPenalty[1]}, reward ${preset.parameters.rewardAmount[0]}-${preset.parameters.rewardAmount[1]}.`} key={preset.name}>
                  <Button
                    aria-pressed={selectedPreset === preset.name}
                    className="h-auto min-h-9 whitespace-normal px-2 py-1 text-xs leading-tight"
                    disabled={!isWasmReady}
                    onClick={() => applyPreset(preset)}
                    variant={selectedPreset === preset.name ? 'default' : 'outline'}
                  >
                    {preset.name}
                  </Button>
                </HoverHint>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Network Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <HoverHint content="Set the total validator population. More nodes make the network denser and increase simulation work.">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Total Nodes</Label>
                  <span className="font-mono text-sm tabular-nums">{nodes}</span>
                </div>
                <Slider value={[nodes]} onValueChange={(value) => { setSelectedPreset(null); setNodes(value[0]); }} max={200} min={5} step={1} />
              </div>
              </HoverHint>

              <HoverHint content="Choose what share of the network is malicious. This controls the adversarial pressure in the simulation.">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Malicious Nodes</Label>
                  <span className="font-mono text-sm tabular-nums text-destructive">{maliciousPercent}% ({maliciousCount})</span>
                </div>
                <Slider value={[maliciousPercent]} onValueChange={(value) => { setSelectedPreset(null); setMaliciousPercent(value[0]); }} max={100} min={0} step={1} />
              </div>
              </HoverHint>

              <HoverHint content="Set how many consensus rounds to simulate. Each round adds a snapshot to the playback timeline.">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Simulation Rounds</Label>
                  <span className="font-mono text-sm tabular-nums">{rounds}</span>
                </div>
                <Slider value={[rounds]} onValueChange={(value) => { setSelectedPreset(null); setRounds(value[0]); }} max={5000} min={100} step={100} />
              </div>
              </HoverHint>

              <div className="border-t border-border pt-4">
                <HoverHint content="Open or close penalty, reward, and trust-boundary controls. Changing these parameters clears the selected preset.">
                <button
                  onClick={() => {
                    if (showAdvanced) {
                      setSelectedPreset(null);
                      setBaseRate(0.2);
                      setSlashPenalty(0.2);
                      setRewardAmount(0.05);
                      setTrustFloor(0.15);
                      setTrustCeil(2.0);
                    }
                    setShowAdvanced(!showAdvanced);
                  }}
                  className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  aria-expanded={showAdvanced}
                >
                  Advanced Mechanics
                  {showAdvanced ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
                </button>
                </HoverHint>
              </div>

              {showAdvanced && (
                <div className="animate-in slide-in-from-top-2 space-y-6 pt-2 fade-in">
                  <HoverHint content="Set the base trust change applied during each simulation round.">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Base Rate</Label>
                      <span className="font-mono text-sm tabular-nums text-muted-foreground">{baseRate.toFixed(2)}</span>
                    </div>
                    <Slider value={[baseRate]} onValueChange={(value) => { setSelectedPreset(null); setBaseRate(value[0]); }} max={0.5} min={0.05} step={0.01} />
                  </div>
                  </HoverHint>

                  <HoverHint content="Set how much trust is removed from a slashed node. A larger penalty makes slashing more severe.">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Slash Penalty</Label>
                      <span className="font-mono text-sm tabular-nums text-destructive">{slashPenalty.toFixed(2)}</span>
                    </div>
                    <Slider value={[slashPenalty]} onValueChange={(value) => { setSelectedPreset(null); setSlashPenalty(value[0]); }} max={1.0} min={0.05} step={0.01} />
                  </div>
                  </HoverHint>

                  <HoverHint content="Set the trust reward for successful behavior. Larger rewards strengthen positive feedback.">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Bonus Reward</Label>
                      <span className="font-mono text-sm tabular-nums text-primary">{rewardAmount.toFixed(2)}</span>
                    </div>
                    <Slider value={[rewardAmount]} onValueChange={(value) => { setSelectedPreset(null); setRewardAmount(value[0]); }} max={0.5} min={0.01} step={0.01} />
                  </div>
                  </HoverHint>

                  <HoverHint content="Trust below this value is treated as low trust and pushed toward the network edge.">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Trust Floor</Label>
                      <span className="font-mono text-sm tabular-nums text-muted-foreground">{trustFloor.toFixed(2)}</span>
                    </div>
                    <Slider value={[trustFloor]} onValueChange={(value) => { setSelectedPreset(null); setTrustFloor(value[0]); }} max={0.5} min={0.01} step={0.01} />
                  </div>
                  </HoverHint>

                  <HoverHint content="Trust above this value reaches the high-trust color range and is drawn toward the center.">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Trust Ceiling</Label>
                      <span className="font-mono text-sm tabular-nums text-muted-foreground">{trustCeil.toFixed(1)}</span>
                    </div>
                    <Slider value={[trustCeil]} onValueChange={(value) => { setSelectedPreset(null); setTrustCeil(value[0]); }} max={5.0} min={1.0} step={0.1} />
                  </div>
                  </HoverHint>
                </div>
              )}

              <HoverHint content="Run the current parameters and regenerate every simulation round.">
                <Button
                  onClick={() => {
                    if (canResetSimulation) {
                      setIsPlaying(false);
                      setCurrentRound(0);
                      setIsSimulationReset(true);
                    } else {
                      runSimulation(true);
                    }
                  }}
                  disabled={!isWasmReady}
                  className="mt-4 w-full font-semibold"
                  variant={canResetSimulation ? 'destructive' : 'default'}
                >
                  {!isWasmReady ? 'Loading Engine...' : canResetSimulation ? <><RotateCcw aria-hidden="true" className="size-4" />Reset Simulation</> : 'Run Simulation'}
                </Button>
              </HoverHint>
            </CardContent>
          </Card>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          {data ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Theoretical Baseline (Random)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-3xl text-foreground">{(data.baseline_probability * 100).toFixed(1)}%</p>
                  <p className="mt-1 text-xs text-muted-foreground">Expected malicious selection rate without VRF</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">VRF Selection Rate (Actual)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-3xl text-primary">{(data.probability * 100).toFixed(1)}%</p>
                  <p className="mt-1 text-xs text-muted-foreground">{data.malicious_selection_count} total malicious validator seats</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Threat Reduction</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`font-mono text-3xl ${data.reduction_percentage > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {data.reduction_percentage > 0 ? '-' : '+'}{Math.abs(data.reduction_percentage).toFixed(1)}%
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Relative to random baseline</p>
                </CardContent>
              </Card>

            </div>
          ) : (
            <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border bg-card">
              <p className="font-mono text-sm text-muted-foreground">Awaiting WASM core...</p>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Peer-to-Peer Topology</CardTitle>
              <p className="text-sm text-muted-foreground">
                {isPreviewRound
                  ? `Round 0 · ${nodes} nodes · ${maliciousCount} malicious nodes`
                  : `Round ${currentRound} of ${snapshots.length} · ${currentSnapshot.validators.length} validators · ${currentSnapshot.slashed_nodes.length} slashed`}
              </p>
            </CardHeader>
            <CardContent>
              <NetworkTopology
                snapshot={currentSnapshot}
                history={snapshots}
                currentRound={currentRound}
                nodeCount={isPreviewRound ? nodes : currentSnapshot.trust_scores.length}
                isPreviewRound={isPreviewRound}
                maliciousNodeIds={maliciousNodeIds}
                trustFloor={trustFloor}
                trustCeil={trustCeil}
                onInteraction={() => setIsPlaying(false)}
              />
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div className="flex items-center gap-3">
                      <HoverHint content={isPlaying ? 'Pause playback and keep the current round on screen.' : 'Play the snapshots in order. Graph interaction also pauses playback.'}>
                        <Button
                          aria-label={isPlaying ? 'Pause playback' : 'Play rounds'}
                          className="shrink-0"
                          disabled={snapshots.length < 1}
                          onClick={() => {
                            if (isPlaying) {
                              setIsPlaying(false);
                            } else {
                              if (currentRound >= snapshots.length) setCurrentRound(0);
                              setIsPlaying(true);
                            }
                          }}
                          size="icon"
                          variant="outline"
                        >
                          {isPlaying ? <Pause aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4" />}
                        </Button>
                      </HoverHint>
                      <HoverHint content="Drag to inspect a specific round. Interacting with the graph pauses playback automatically.">
                        <div className="flex-1">
                          <Slider
                            aria-label="Simulation round"
                            disabled={snapshots.length < 1}
                            max={snapshots.length}
                            min={0}
                            onValueChange={(value) => setCurrentRound(value[0])}
                            step={1}
                            value={[currentRound]}
                          />
                        </div>
                      </HoverHint>
                      <span className="min-w-20 text-right font-mono text-sm tabular-nums text-muted-foreground">
                        {currentRound} / {snapshots.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Round 0</span>
                      <span>Round {snapshots.length}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                      <span className="text-sm text-muted-foreground">Playback speed</span>
                      <HoverHint content="Choose how quickly the timeline advances. Select Custom for a manual multiplier.">
                      <div className="relative grid h-11 w-[18rem] grid-cols-5 items-center rounded-full border border-border bg-muted p-1">
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-full bg-background shadow-sm transition-transform duration-300 ease-in-out motion-reduce:transition-none"
                          style={{ transform: `translateX(${selectedSpeedIndex * 100}%)`, width: 'calc((100% - 8px) / 5)' }}
                        />
                        {playbackSpeeds.map((speed) => (
                          <button
                            aria-label={`Playback speed ${speed}`}
                            aria-pressed={playbackSpeed === speed}
                            className={`relative z-10 h-9 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${playbackSpeed === speed ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            key={speed}
                            onClick={() => setPlaybackSpeed(speed)}
                            type="button"
                          >
                            {speed}
                          </button>
                        ))}
                      </div>
                      </HoverHint>
                      {playbackSpeed === 'Custom' && (
                        <HoverHint content="Set a custom playback multiplier from 0.25x to 8x.">
                        <div className="flex min-w-44 flex-1 items-center gap-3 sm:max-w-64">
                          <Slider
                            aria-label="Custom playback speed"
                            max={8}
                            min={0.25}
                            onValueChange={(value) => setCustomSpeed(value[0])}
                            step={0.25}
                            value={[customSpeed]}
                          />
                          <span className="w-12 text-right font-mono text-sm tabular-nums">{customSpeed}x</span>
                        </div>
                        </HoverHint>
                      )}
                    </div>
                </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Trust Distribution</CardTitle>
              <p className="text-sm text-muted-foreground">
                Round {currentRound} · {currentSnapshot.trust_scores.length} nodes by trust score
              </p>
            </CardHeader>
            <CardContent>
              <BarChart
                className="trust-distribution-chart h-64"
                data={trustDistributionData}
                index="range"
                categories={['nodes']}
                colors={['teal']}
                yAxisWidth={40}
                showAnimation={false}
                showLegend={false}
              />
            </CardContent>
          </Card>
        </main>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}