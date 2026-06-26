import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Play, StopCircle, CheckCircle, Upload } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import { api, TrainedModel, SimRequest } from "../services/api";

const SEA_STATES = [
  { id: 0, label: "SS 0 (Hw=0.8m, T=9.0s)" },
  { id: 1, label: "SS 1 (Hw=1.2m, T=9.5s)" },
  { id: 2, label: "SS 2 (Hw=1.6m, T=10.0s)" },
  { id: 3, label: "SS 3 (Hw=2.0m, T=10.5s)" },
  { id: 4, label: "SS 4 (Hw=2.5m, T=11.0s)" },
  { id: 5, label: "SS 5 (Hw=3.0m, T=11.5s)" },
  { id: 6, label: "SS 6 (Hw=3.5m, T=12.0s)" },
  { id: 7, label: "SS 7 (Hw=4.0m, T=12.5s)" },
  { id: 8, label: "SS 8 (Hw=4.5m, T=13.0s)" },
];

const CONTROLLERS = [
  { id: "rl", name: "RL Control (PPO)" },
  { id: "baseline", name: "Threshold Baseline" },
];

const CONTROL_MODES = [
  { id: "latching", name: "Latching" },
  { id: "linear", name: "Linear" },
];

type TestState = "idle" | "running" | "completed";

export function TestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedModel = searchParams.get("model");

  const [state, setState] = useState<TestState>("idle");
  const [progress, setProgress] = useState(0);
  
  // Form state
  const [controller, setController] = useState("rl");
  const [selectedModel, setSelectedModel] = useState(preselectedModel || "");
  const [controlMode, setControlMode] = useState("latching");
  const [seaState, setSeaState] = useState("3");
  const [regularWaves, setRegularWaves] = useState(false);
  const [simTime, setSimTime] = useState("15");
  const [saveResults, setSaveResults] = useState(true);

  const isRLController = controller === "rl";

  const [models, setModels] = useState<TrainedModel[]>([]);

  useEffect(() => {
    api.getModels().then(setModels).catch(console.error);
  }, []);

  const handleStartTest = async () => {
    setState("running");
    setProgress(10);
    try {
      const req: SimRequest = {
        mode: "test",
        control: controller as any,
        type: controlMode as any,
        sea_state: parseInt(seaState),
        regular: regularWaves,
        sim_time: parseFloat(simTime),
        save: saveResults,
        model_id: selectedModel || undefined
      };
      
      setProgress(50);
      await api.runSimulation(req);
      setProgress(100);
      setState("completed");
    } catch (e) {
      console.error(e);
      alert("Test simulation failed. Check console for details.");
      setState("idle");
    }
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
              <FlaskConical className="w-10 h-10 text-cyan-600" />
              Test Model
            </h1>
            <p className="text-lg text-slate-600">
              Evaluate trained models against specific sea states
            </p>
          </div>

          {/* Configuration Card */}
          {state === "idle" && (
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-slate-900 flex items-center gap-2">
                  <div className="w-1 h-6 bg-cyan-500 rounded-full" />
                  Test Configuration
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Select a model and configure test parameters
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
                </div>

                {/* Model Selection for RL */}
                {isRLController && (
                  <div className="space-y-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="space-y-2">
                      <Label htmlFor="model" className="text-slate-700">Trained Model</Label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger id="model" className="bg-white border-slate-300 text-slate-900">
                          <SelectValue placeholder="Select a trained model..." />
                        </SelectTrigger>
                        <SelectContent>
                          {models.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name} - SS{m.seaState} ({m.waveType})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedModel && (
                      <div className="p-3 rounded-md bg-white border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Model Details</p>
                        <p className="text-sm text-slate-700 font-mono break-all">
                          {models.find(m => m.id === selectedModel)?.path}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="border-slate-300 text-slate-700">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Custom Model
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Sea State */}
                  <div className="space-y-2">
                    <Label htmlFor="sea-state" className="text-slate-700">Sea State</Label>
                    <Select value={seaState} onValueChange={setSeaState}>
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
                    <Label htmlFor="sim-time" className="text-slate-700">Simulation Time (seconds)</Label>
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
                <div className="space-y-4">
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

                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="space-y-0.5">
                      <Label htmlFor="save-results" className="text-slate-700">Save Results</Label>
                      <p className="text-sm text-slate-500">Save test data and plots to results/test/</p>
                    </div>
                    <Switch
                      id="save-results"
                      checked={saveResults}
                      onCheckedChange={setSaveResults}
                    />
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  size="lg"
                  onClick={handleStartTest}
                  disabled={isRLController && !selectedModel}
                  className="w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-semibold disabled:opacity-50"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Test
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Running State */}
          {state === "running" && (
            <Card className="bg-white border-slate-200">
              <CardContent className="pt-6 space-y-6">
                <div className="text-center space-y-4">
                  <div className="inline-block p-4 rounded-full bg-cyan-500/10 animate-pulse">
                    <FlaskConical className="w-12 h-12 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Test in Progress</h3>
                    <p className="text-slate-500 mt-2">
                      Testing model on Sea State {seaState} • {simTime}s simulation
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Progress</span>
                    <span className="text-cyan-600 font-mono">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>

                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="text-center p-3 rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-500">Time Elapsed</p>
                    <p className="text-lg font-bold text-slate-900 mt-1">
                      {((progress / 100) * parseFloat(simTime)).toFixed(1)}s
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-500">Inst. Power</p>
                    <p className="text-lg font-bold text-emerald-600 mt-1">
                      {(120 + Math.sin(progress) * 30).toFixed(0)}W
                    </p>
                  </div>
                </div>

                <Button
                  variant="destructive"
                  onClick={handleStop}
                  className="w-full"
                >
                  <StopCircle className="w-5 h-5 mr-2" />
                  Stop Test
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
                    <h3 className="text-2xl font-bold text-slate-900">Test Completed Successfully!</h3>
                    {saveResults && (
                      <p className="text-slate-500 mt-2">
                        Results saved to results/test/test_rl_ss{seaState}_{new Date().toISOString().split('T')[0]}.csv
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="text-center p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-slate-600 mb-1">Test completed. You can view the generated results in the Results page.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    size="lg"
                    onClick={() => navigate("/results")}
                    className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500"
                  >
                    <LineChart className="w-5 h-5 mr-2" />
                    View Results
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleReset}
                    className="border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Run Another Test
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

function FlaskConical(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
      <path d="M8.5 2h7" />
      <path d="M7 16h10" />
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
