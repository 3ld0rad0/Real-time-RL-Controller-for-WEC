import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Progress } from "../components/ui/progress";
import { ArrowLeft, Play, StopCircle, BarChart3, RotateCcw, FlaskConical } from "lucide-react";
import { SEA_STATES, CONTROLLERS, CONTROL_MODES, MOCK_MODELS } from "../lib/constants";

type SimulationState = "idle" | "running" | "completed";

export function TestPage() {
  const navigate = useNavigate();
  const [simulationState, setSimulationState] = useState<SimulationState>("idle");
  const [progress, setProgress] = useState(0);
  
  // Form state
  const [controller, setController] = useState("rl_control");
  const [selectedModel, setSelectedModel] = useState(MOCK_MODELS.irregular[0].id);
  const [controlMode, setControlMode] = useState("latching");
  const [seaState, setSeaState] = useState("3");
  const [regularWaves, setRegularWaves] = useState(false);
  const [simulationTime, setSimulationTime] = useState("15");
  const [saveResults, setSaveResults] = useState(true);

  const isRLController = controller === "rl_control";
  const allModels = [...MOCK_MODELS.irregular, ...MOCK_MODELS.regular];
  const currentModel = allModels.find(m => m.id === selectedModel);

  const handleStartTest = () => {
    setSimulationState("running");
    setProgress(0);
    
    // Simulate progress - faster than training
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setSimulationState("completed");
          return 100;
        }
        return prev + 5;
      });
    }, 100);
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
        <h2 className="text-3xl font-semibold text-slate-900">Test Model</h2>
        <p className="text-slate-600 mt-2">
          Evaluate trained models on specific sea states and wave conditions
        </p>
      </div>

      {/* Configuration Card */}
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <FlaskConical className="w-5 h-5 text-cyan-600" />
            Test Configuration
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
          </div>

          {/* Model Selection (RL only) */}
          {isRLController && (
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel} disabled={simulationState === "running"}>
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">Irregular Waves</div>
                  {MOCK_MODELS.irregular.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.path.split('/').pop()} ({SEA_STATES[model.seaState].label})
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 border-t mt-1 pt-2">Regular Waves</div>
                  {MOCK_MODELS.regular.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.path.split('/').pop()} ({SEA_STATES[model.seaState].label})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentModel && (
                <div className="text-sm p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-slate-700">
                    <span className="font-medium">Model path:</span> <code className="text-xs">{currentModel.path}</code>
                  </p>
                  <p className="text-slate-600 text-xs mt-1">
                    Size: {currentModel.size} MB • Modified: {new Date(currentModel.modified).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Control Mode (auto-suggested from model) */}
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
            {currentModel && (
              <p className="text-sm text-blue-600">
                ℹ Auto-suggested from model: {currentModel.controlMode}
              </p>
            )}
          </div>

          {/* Sea State (auto-suggested from model) */}
          <div className="space-y-2">
            <Label htmlFor="seaState">Sea State</Label>
            <Select value={seaState} onValueChange={setSeaState} disabled={simulationState === "running"}>
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
            {currentModel && (
              <p className="text-sm text-blue-600">
                ℹ Auto-suggested from model: {SEA_STATES[currentModel.seaState].label}
              </p>
            )}
          </div>

          {/* Regular Waves Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="regularWaves">Regular Waves</Label>
              <p className="text-xs text-slate-500">Use regular wave pattern for testing</p>
            </div>
            <Switch
              id="regularWaves"
              checked={regularWaves}
              onCheckedChange={setRegularWaves}
              disabled={simulationState === "running"}
            />
          </div>

          {/* Simulation Time */}
          <div className="space-y-2">
            <Label htmlFor="simulationTime">Simulation Time (seconds)</Label>
            <Input
              id="simulationTime"
              type="number"
              value={simulationTime}
              onChange={(e) => setSimulationTime(e.target.value)}
              disabled={simulationState === "running"}
              min="1"
              step="1"
            />
            <p className="text-sm text-slate-500">Default: 15 seconds for quick evaluation</p>
          </div>

          {/* Save Results Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="saveResults">Save Results</Label>
              <p className="text-xs text-slate-500">Export test data and plots to results folder</p>
            </div>
            <Switch
              id="saveResults"
              checked={saveResults}
              onCheckedChange={setSaveResults}
              disabled={simulationState === "running"}
            />
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-200">
            {simulationState === "idle" && (
              <Button
                onClick={handleStartTest}
                className="w-full bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800"
                size="lg"
              >
                <Play className="w-5 h-5 mr-2" />
                Start Test
              </Button>
            )}

            {simulationState === "running" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Testing Progress</span>
                    <span className="font-medium text-slate-900">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                  <p className="text-sm text-slate-500 text-center">Running simulation...</p>
                </div>
                <Button
                  onClick={handleStop}
                  variant="destructive"
                  className="w-full"
                  size="lg"
                >
                  <StopCircle className="w-5 h-5 mr-2" />
                  Stop Test
                </Button>
              </div>
            )}

            {simulationState === "completed" && (
              <div className="space-y-3">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium text-center">
                    ✓ Test completed successfully!
                  </p>
                  {saveResults && (
                    <p className="text-green-700 text-sm text-center mt-1">
                      Results saved to results/test/
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => navigate("/results")}
                    className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View Results
                  </Button>
                  <Button
                    onClick={handleStartAnother}
                    variant="outline"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Test Another
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
