import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Checkbox } from "../components/ui/checkbox";
import { ArrowLeft, TrendingUp, Move, Zap, Activity } from "lucide-react";
import { MOCK_RESULT_FILES, generateMockResultData } from "../lib/constants";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { ChevronDown } from "lucide-react";

type ResultType = "test" | "train";
type SignalType = "position" | "velocity" | "power_inst" | "excitation_force";

const SIGNALS: { id: SignalType; label: string; color: string; unit: string }[] = [
  { id: "position", label: "Position", color: "#3b82f6", unit: "m" },
  { id: "velocity", label: "Velocity", color: "#10b981", unit: "m/s" },
  { id: "power_inst", label: "Instantaneous Power", color: "#f59e0b", unit: "W" },
  { id: "excitation_force", label: "Excitation Force", color: "#8b5cf6", unit: "N" },
];

export function ResultsPage() {
  const navigate = useNavigate();
  const [resultType, setResultType] = useState<ResultType>("test");
  const [selectedFile, setSelectedFile] = useState(MOCK_RESULT_FILES.test[0]);
  const [selectedSignals, setSelectedSignals] = useState<SignalType[]>(["position", "power_inst"]);
  const [isDataOpen, setIsDataOpen] = useState(false);
  const [isPlotOpen, setIsPlotOpen] = useState(false);

  // Generate mock data
  const rawData = useMemo(() => generateMockResultData(15), [selectedFile]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const meanPower = rawData.power_inst.reduce((a, b) => a + b, 0) / rawData.power_inst.length;
    const maxDisplacement = Math.max(...rawData.position.map(Math.abs));
    const maxVelocity = Math.max(...rawData.velocity.map(Math.abs));

    return {
      meanPower: meanPower.toFixed(2),
      maxDisplacement: maxDisplacement.toFixed(3),
      maxVelocity: maxVelocity.toFixed(3),
    };
  }, [rawData]);

  // Prepare chart data (downsample for performance)
  const chartData = useMemo(() => {
    const downsampleFactor = Math.ceil(rawData.time.length / 2000);
    return rawData.time
      .filter((_, i) => i % downsampleFactor === 0)
      .map((time, i) => {
        const actualIndex = i * downsampleFactor;
        return {
          time,
          position: rawData.position[actualIndex],
          velocity: rawData.velocity[actualIndex],
          power_inst: rawData.power_inst[actualIndex],
          excitation_force: rawData.excitation_force[actualIndex],
        };
      });
  }, [rawData]);

  const toggleSignal = (signal: SignalType) => {
    setSelectedSignals((prev) =>
      prev.includes(signal) ? prev.filter((s) => s !== signal) : [...prev, signal]
    );
  };

  const currentFiles = MOCK_RESULT_FILES[resultType];

  return (
    <div className="max-w-7xl mx-auto">
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
        <h2 className="text-3xl font-semibold text-slate-900">View Results</h2>
        <p className="text-slate-600 mt-2">
          Analyze simulation data and performance metrics from training and testing runs
        </p>
      </div>

      {/* Result Type Toggle */}
      <div className="mb-6">
        <Tabs value={resultType} onValueChange={(v) => setResultType(v as ResultType)}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="test">Test Results</TabsTrigger>
            <TabsTrigger value="train">Training Results</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* File Selection */}
      <Card className="mb-6 border-slate-200">
        <CardContent className="p-6">
          <div className="space-y-2">
            <Label htmlFor="file">Select Result File</Label>
            <Select value={selectedFile} onValueChange={setSelectedFile}>
              <SelectTrigger id="file">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentFiles.map((file) => (
                  <SelectItem key={file} value={file}>
                    {file}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Mean Power</p>
                <p className="text-3xl font-semibold text-slate-900">{metrics.meanPower}</p>
                <p className="text-sm text-slate-500 mt-1">Watts</p>
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Max Displacement</p>
                <p className="text-3xl font-semibold text-slate-900">{metrics.maxDisplacement}</p>
                <p className="text-sm text-slate-500 mt-1">Meters</p>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <Move className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Max Velocity</p>
                <p className="text-3xl font-semibold text-slate-900">{metrics.maxVelocity}</p>
                <p className="text-sm text-slate-500 mt-1">m/s</p>
              </div>
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Chart */}
      <Card className="mb-6 border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Activity className="w-5 h-5 text-indigo-600" />
            Interactive Time Series Plot
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {/* Signal Selection */}
          <div className="mb-6">
            <Label className="mb-3 block">Select Signals to Display</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {SIGNALS.map((signal) => (
                <div key={signal.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={signal.id}
                    checked={selectedSignals.includes(signal.id)}
                    onCheckedChange={() => toggleSignal(signal.id)}
                  />
                  <label
                    htmlFor={signal.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: signal.color }}
                      />
                      {signal.label}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="bg-slate-50 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="time"
                  label={{ value: "Time (s)", position: "insideBottom", offset: -5 }}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.5rem",
                  }}
                />
                <Legend />
                {selectedSignals.map((signalId) => {
                  const signal = SIGNALS.find((s) => s.id === signalId);
                  return (
                    <Line
                      key={signalId}
                      type="monotone"
                      dataKey={signalId}
                      name={signal?.label}
                      stroke={signal?.color}
                      dot={false}
                      strokeWidth={2}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Expandable Sections */}
      <div className="space-y-4">
        {/* Saved Plot */}
        <Card className="border-slate-200">
          <Collapsible open={isPlotOpen} onOpenChange={setIsPlotOpen}>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="hover:bg-slate-50 transition-colors cursor-pointer">
                <CardTitle className="flex items-center justify-between text-slate-900">
                  <span>Saved PNG Plot</span>
                  <ChevronDown
                    className={`w-5 h-5 transition-transform ${isPlotOpen ? "rotate-180" : ""}`}
                  />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-6 pt-0">
                <div className="bg-slate-100 rounded-lg p-8 text-center text-slate-500">
                  Static matplotlib plot would be displayed here
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Raw Data */}
        <Card className="border-slate-200">
          <Collapsible open={isDataOpen} onOpenChange={setIsDataOpen}>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="hover:bg-slate-50 transition-colors cursor-pointer">
                <CardTitle className="flex items-center justify-between text-slate-900">
                  <span>Raw Data (DataFrame)</span>
                  <ChevronDown
                    className={`w-5 h-5 transition-transform ${isDataOpen ? "rotate-180" : ""}`}
                  />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-6 pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left p-2 font-medium text-slate-700">Time (s)</th>
                        <th className="text-left p-2 font-medium text-slate-700">Position (m)</th>
                        <th className="text-left p-2 font-medium text-slate-700">Velocity (m/s)</th>
                        <th className="text-left p-2 font-medium text-slate-700">Power (W)</th>
                        <th className="text-left p-2 font-medium text-slate-700">Force (N)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawData.time.slice(0, 50).map((time, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-2 font-mono text-xs">{time.toFixed(2)}</td>
                          <td className="p-2 font-mono text-xs">{rawData.position[i].toFixed(4)}</td>
                          <td className="p-2 font-mono text-xs">{rawData.velocity[i].toFixed(4)}</td>
                          <td className="p-2 font-mono text-xs">{rawData.power_inst[i].toFixed(2)}</td>
                          <td className="p-2 font-mono text-xs">{rawData.excitation_force[i].toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-500 mt-4 text-center">
                    Showing first 50 of {rawData.time.length} data points
                  </p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>
    </div>
  );
}
