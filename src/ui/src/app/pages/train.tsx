import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Play, StopCircle, CheckCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import { SEA_STATES, CONTROLLERS, CONTROL_MODES, TRAINED_MODELS } from "../data/mock-data";

type TrainingState = "idle" | "running" | "completed";

export function TrainPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<TrainingState>("idle");
  const [progress, setProgress] = useState(0);
  
  // Form state
  const [controller, setController] = useState("rl");
  const [controlMode, setControlMode] = useState("latching");
  const [seaState, setSeaState] = useState("3");
  const [mixedSeaStates, setMixedSeaStates] = useState(false);
  const [regularWaves, setRegularWaves] = useState(false);
  const [simTime, setSimTime] = useState("2");
  const [batchSize, setBatchSize] = useState("2048");
  const [entropyCoef, setEntropyCoef] = useState("0.01");
  const [retrain, setRetrain] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");

  const isRLController = controller === "rl";

  const handleStartTraining = () => {
    setState("running");
    // Simulate training progress
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 8;
      if (currentProgress >= 100) {
        currentProgress = 100;
        setState("completed");
        clearInterval(interval);
      }
      setProgress(currentProgress);
    }, 300);
  };

  const handleStop = () => {
    setState("idle");
    setProgress(0);
  };

  const handleReset = () => {
    setState("idle");
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>

        <div className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
              <Activity className="w-10 h-10 text-blue-600" />
              Train Model
            </h1>
            <p className="text-lg text-slate-600">
              Configure and train a reinforcement learning agent for wave energy control
            </p>
          </div>

          {/* Configuration Card */}
          {state === "idle" && (
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-slate-900 flex items-center gap-2">
                  <div className="w-1 h-6 bg-blue-500 rounded-full" />
                  Configuration
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Set up training parameters for your RL agent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Controller */}
                  <div className="space-y-2">
                    <Label htmlFor="controller" className="text-slate-700">Controller</Label>
                    <Select value={controller} onValueChange={setController}>
                      <SelectTrigger id="controller" className="bg-white border-slate-300 text-slate-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTROLLERS.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Control Mode */}
                  <div className="space-y-2">
                    <Label htmlFor="control-mode" className="text-slate-700">Control Mode</Label>
                    <Select value={controlMode} onValueChange={setControlMode}>
                      <SelectTrigger id="control-mode" className="bg-white border-slate-300 text-slate-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTROL_MODES.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sea State */}
                  <div className="space-y-2">
                    <Label htmlFor="sea-state" className="text-slate-700">Sea State</Label>
                    <Select value={seaState} onValueChange={setSeaState} disabled={mixedSeaStates}>
                      <SelectTrigger id="sea-state" className="bg-white border-slate-300 text-slate-900">
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
                  </div>

                  {/* Simulation Time */}
                  <div className="space-y-2">
                    <Label htmlFor="sim-time" className="text-slate-700">Simulation Time (hours)</Label>
                    <Input
                      id="sim-time"
                      type="number"
                      value={simTime}
                      onChange={(e) => setSimTime(e.target.value)}
                      className="bg-white border-slate-300 text-slate-900"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="space-y-0.5">
                      <Label htmlFor="mixed-states" className="text-slate-700">Mixed Sea States</Label>
                      <p className="text-sm text-slate-500">Randomly switch between sea states during training</p>
                    </div>
                    <Switch
                      id="mixed-states"
                      checked={mixedSeaStates}
                      onCheckedChange={setMixedSeaStates}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="space-y-0.5">
                      <Label htmlFor="regular-waves" className="text-slate-700">Regular Waves</Label>
                      <p className="text-sm text-slate-500">Use regular waves instead of irregular spectrum</p>
                    </div>
                    <Switch
                      id="regular-waves"
                      checked={regularWaves}
                      onCheckedChange={setRegularWaves}
                    />
                  </div>
                </div>

                {/* RL-specific parameters */}
                {isRLController && (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <h3 className="text-sm font-medium text-blue-600">RL Parameters</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="batch-size" className="text-slate-700">Batch Size</Label>
                        <Input
                          id="batch-size"
                          type="number"
                          value={batchSize}
                          onChange={(e) => setBatchSize(e.target.value)}
                          className="bg-white border-slate-300 text-slate-900"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="entropy-coef" className="text-slate-700">Entropy Coefficient</Label>
                        <Input
                          id="entropy-coef"
                          type="number"
                          step="0.001"
                          value={entropyCoef}
                          onChange={(e) => setEntropyCoef(e.target.value)}
                          className="bg-white border-slate-300 text-slate-900"
                        />
                      </div>
                    </div>

                    {/* Retrain */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="space-y-0.5">
                        <Label htmlFor="retrain" className="text-slate-700">Retrain (Fine-tune)</Label>
                        <p className="text-sm text-slate-500">Continue training from an existing model</p>
                      </div>
                      <Switch
                        id="retrain"
                        checked={retrain}
                        onCheckedChange={setRetrain}
                      />
                    </div>

                    {retrain && (
                      <div className="space-y-2">
                        <Label htmlFor="base-model" className="text-slate-700">Base Model</Label>
                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                          <SelectTrigger id="base-model" className="bg-white border-slate-300 text-slate-900">
                            <SelectValue placeholder="Select a model..." />
                          </SelectTrigger>
                          <SelectContent>
                            {TRAINED_MODELS.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Button */}
                <Button
                  size="lg"
                  onClick={handleStartTraining}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Training
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Running State */}
          {state === "running" && (
            <Card className="bg-white border-slate-200">
              <CardContent className="pt-6 space-y-6">
                <div className="text-center space-y-4">
                  <div className="inline-block p-4 rounded-full bg-blue-500/10 animate-pulse">
                    <Activity className="w-12 h-12 text-blue-600 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Training in Progress</h3>
                    <p className="text-slate-500 mt-2">
                      Training PPO agent on Sea State {seaState} • {simTime}h simulation
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Progress</span>
                    <span className="text-blue-600 font-mono">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>

                <div className="grid grid-cols-3 gap-4 py-4">
                  <div className="text-center p-3 rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-500">Episodes</p>
                    <p className="text-lg font-bold text-slate-900 mt-1">{Math.round(progress * 42)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-500">Avg Reward</p>
                    <p className="text-lg font-bold text-emerald-600 mt-1">
                      {(120 + progress * 0.8).toFixed(1)}
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-500">Loss</p>
                    <p className="text-lg font-bold text-orange-600 mt-1">
                      {(0.5 - progress * 0.003).toFixed(3)}
                    </p>
                  </div>
                </div>

                <Button
                  variant="destructive"
                  onClick={handleStop}
                  className="w-full"
                >
                  <StopCircle className="w-5 h-5 mr-2" />
                  Stop Simulation
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Completed State */}
          {state === "completed" && (
            <Card className="bg-white border-emerald-500/50">
              <CardContent className="pt-6 space-y-6">
                <div className="text-center space-y-4">
                  <div className="inline-block p-4 rounded-full bg-emerald-500/10">
                    <CheckCircle className="w-12 h-12 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Training Completed Successfully!</h3>
                    <p className="text-slate-500 mt-2">
                      Model saved to models/irregular/sea_state_{seaState}/
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    size="lg"
                    onClick={() => navigate("/results")}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                  >
                    <LineChart className="w-5 h-5 mr-2" />
                    Go to View Results
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleReset}
                    className="border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Start Another Training
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Activity(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function LineChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}
