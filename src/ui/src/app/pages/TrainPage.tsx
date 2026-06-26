import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Progress } from "../components/ui/progress";
import { ArrowLeft, Play, StopCircle, BarChart3, RotateCcw, Settings } from "lucide-react";
import { SEA_STATES, CONTROLLERS, CONTROL_MODES } from "../lib/constants";

type SimulationState = "idle" | "running" | "completed";

export function TrainPage() {
  const navigate = useNavigate();
  const [simulationState, setSimulationState] = useState<SimulationState>("idle");
  const [progress, setProgress] = useState(0);
  
  // Form state
  const [controller, setController] = useState("rl_control");
  const [controlMode, setControlMode] = useState("latching");
  const [seaState, setSeaState] = useState("3");
  const [mixedSeaStates, setMixedSeaStates] = useState(false);
  const [regularWaves, setRegularWaves] = useState(false);
  const [simulationTime, setSimulationTime] = useState("4");
  const [batchSize, setBatchSize] = useState("2048");
  const [entropyCoef, setEntropyCoef] = useState("0.01");
  const [retrain, setRetrain] = useState(false);

  const isRLController = controller === "rl_control";

  const handleStartTraining = () => {
    setSimulationState("running");
    setProgress(0);
    
    // Simulate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setSimulationState("completed");
          return 100;
        }
        return prev + 2;
      });
    }, 200);
  };

  const handleStop = () => {
    setSimulationState("idle");
    setProgress(0);
  };

  const handleStartAnother = () => {
    setSimulationState("idle");
    setProgress(0);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header with back button */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
        <h2 className="text-3xl font-semibold text-slate-900">Train Model</h2>
        <p className="text-slate-600 mt-2">
          Configure training parameters and start a new RL agent training session
        </p>
      </div>

      {/* Configuration Card */}
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Settings className="w-5 h-5 text-blue-600" />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Controller Selection */}
          <div className="space-y-2">
            <Label htmlFor="controller">Controller</Label>
            <Select value={controller} onValueChange={setController} disabled={simulationState === "running"}>
              <SelectTrigger id="controller">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTROLLERS.map((ctrl) => (
                  <SelectItem key={ctrl.id} value={ctrl.id}>
                    {ctrl.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-500">
              {CONTROLLERS.find((c) => c.id === controller)?.description}
            </p>
          </div>

          {/* Control Mode */}
          <div className="space-y-2">
            <Label htmlFor="controlMode">Control Mode</Label>
            <Select value={controlMode} onValueChange={setControlMode} disabled={simulationState === "running"}>
              <SelectTrigger id="controlMode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTROL_MODES.map((mode) => (
                  <SelectItem key={mode.id} value={mode.id}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-500">
              {CONTROL_MODES.find((m) => m.id === controlMode)?.description}
            </p>
          </div>

          {/* Sea State */}
          <div className="space-y-2">
            <Label htmlFor="seaState">Sea State</Label>
            <Select value={seaState} onValueChange={setSeaState} disabled={simulationState === "running" || mixedSeaStates}>
              <SelectTrigger id="seaState">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEA_STATES.map((ss) => (
                  <SelectItem key={ss.id} value={ss.id.toString()}>
                    {ss.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!mixedSeaStates && (
              <p className="text-sm text-slate-500">
                Wave height: {SEA_STATES[parseInt(seaState)].height}m, Period: {SEA_STATES[parseInt(seaState)].period}s
              </p>
            )}
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="mixedSeaStates">Mixed Sea States</Label>
                <p className="text-xs text-slate-500">Random switching during training</p>
              </div>
              <Switch
                id="mixedSeaStates"
                checked={mixedSeaStates}
                onCheckedChange={setMixedSeaStates}
                disabled={simulationState === "running"}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="regularWaves">Regular Waves</Label>
                <p className="text-xs text-slate-500">Use regular wave pattern</p>
              </div>
              <Switch
                id="regularWaves"
                checked={regularWaves}
                onCheckedChange={setRegularWaves}
                disabled={simulationState === "running"}
              />
            </div>
          </div>

          {/* Numeric inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="simulationTime">Simulation Time (hours)</Label>
              <Input
                id="simulationTime"
                type="number"
                value={simulationTime}
                onChange={(e) => setSimulationTime(e.target.value)}
                disabled={simulationState === "running"}
                min="1"
                step="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="batchSize">Batch Size</Label>
              <Input
                id="batchSize"
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(e.target.value)}
                disabled={simulationState === "running"}
                min="64"
                step="64"
              />
            </div>
          </div>

          {/* RL-specific parameters */}
          {isRLController && (
            <>
              <div className="space-y-2">
                <Label htmlFor="entropyCoef">Entropy Coefficient</Label>
                <Input
                  id="entropyCoef"
                  type="number"
                  value={entropyCoef}
                  onChange={(e) => setEntropyCoef(e.target.value)}
                  disabled={simulationState === "running"}
                  min="0"
                  step="0.001"
                />
                <p className="text-sm text-slate-500">Controls exploration vs exploitation tradeoff</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="retrain">Retrain (Fine-tune)</Label>
                  <p className="text-xs text-slate-500">Load existing model for continued training</p>
                </div>
                <Switch
                  id="retrain"
                  checked={retrain}
                  onCheckedChange={setRetrain}
                  disabled={simulationState === "running"}
                />
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-200">
            {simulationState === "idle" && (
              <Button
                onClick={handleStartTraining}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                size="lg"
              >
                <Play className="w-5 h-5 mr-2" />
                Start Training
              </Button>
            )}

            {simulationState === "running" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Training Progress</span>
                    <span className="font-medium text-slate-900">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>
                <Button
                  onClick={handleStop}
                  variant="destructive"
                  className="w-full"
                  size="lg"
                >
                  <StopCircle className="w-5 h-5 mr-2" />
                  Stop Simulation
                </Button>
              </div>
            )}

            {simulationState === "completed" && (
              <div className="space-y-3">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium text-center">
                    ✓ Training completed successfully!
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => navigate("/results")}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View Results
                  </Button>
                  <Button
                    onClick={handleStartAnother}
                    variant="outline"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Start Another
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
