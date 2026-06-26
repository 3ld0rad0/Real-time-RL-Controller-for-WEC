import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, TrendingUp, FileText, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Checkbox } from "../components/ui/checkbox";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { api, SimulationResult, SimDataPoint } from "../services/api";

type SignalType = "position" | "velocity" | "power_inst" | "excitation_force" | "control_signal";

const SIGNAL_CONFIG: Record<SignalType, { label: string; color: string; unit: string }> = {
  position: { label: "Position", color: "#3b82f6", unit: "m" },
  velocity: { label: "Velocity", color: "#8b5cf6", unit: "m/s" },
  power_inst: { label: "Instantaneous Power", color: "#10b981", unit: "W" },
  excitation_force: { label: "Excitation Force", color: "#f59e0b", unit: "N" },
  control_signal: { label: "Control Signal", color: "#ec4899", unit: "" },
};

export function ResultsPage() {
  const navigate = useNavigate();
  const [resultType, setResultType] = useState<"test" | "train">("test");
  const [selectedResultId, setSelectedResultId] = useState<string>("");
  const [visibleSignals, setVisibleSignals] = useState<SignalType[]>(["position", "velocity", "power_inst"]);
  const [showRawData, setShowRawData] = useState(false);
  const [showPlot, setShowPlot] = useState(false);

  const [results, setResults] = useState<SimulationResult[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [selectedData, setSelectedData] = useState<SimDataPoint[] | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => {
    api.getResults().then((data) => {
      setResults(data);
      setIsLoadingList(false);
      if (data.length > 0) {
        setSelectedResultId(data[0].id);
      }
    }).catch(e => {
      console.error(e);
      setIsLoadingList(false);
    });
  }, []);

  const selectedResult = results.find((r) => r.id === selectedResultId);
  const filteredResults = results.filter((r) => r.type === resultType);

  useEffect(() => {
    if (selectedResult) {
      setIsLoadingData(true);
      api.getResultData(selectedResult.filename).then((data) => {
        setSelectedData(data);
        setIsLoadingData(false);
      }).catch(e => {
        console.error(e);
        setIsLoadingData(false);
      });
    } else {
      setSelectedData(null);
    }
  }, [selectedResult]);

  const toggleSignal = (signal: SignalType) => {
    setVisibleSignals((prev) =>
      prev.includes(signal) ? prev.filter((s) => s !== signal) : [...prev, signal]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container max-w-7xl mx-auto px-6 py-8">
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
              <TrendingUp className="w-10 h-10 text-teal-600" />
              View Results
            </h1>
            <p className="text-lg text-slate-600">
              Analyze simulation data and performance metrics
            </p>
          </div>

          {/* Type Selector */}
          <Tabs value={resultType} onValueChange={(v) => setResultType(v as "test" | "train")} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-100 border border-slate-200">
              <TabsTrigger value="test" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
                Test Results
              </TabsTrigger>
              <TabsTrigger value="train" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                Training Results
              </TabsTrigger>
            </TabsList>

            <TabsContent value={resultType} className="space-y-6 mt-6">
              {/* File Selector */}
              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900 flex items-center gap-2">
                    <div className="w-1 h-6 bg-teal-500 rounded-full" />
                    Select Result File
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="result-file" className="text-slate-700">Result File</Label>
                    <Select value={selectedResultId} onValueChange={setSelectedResultId} disabled={isLoadingList || filteredResults.length === 0}>
                      <SelectTrigger id="result-file" className="bg-white border-slate-300 text-slate-900">
                        <SelectValue placeholder={isLoadingList ? "Loading results..." : "Select a result file"} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredResults.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.filename} - {new Date(r.timestamp).toLocaleDateString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {selectedResult && (
                <>
                  {/* Summary Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-blue-50 border border-blue-200">
                      <CardHeader className="pb-3">
                        <CardDescription className="text-blue-700">Mean Power</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-blue-900">
                          {selectedResult.meanPower.toFixed(1)}
                          <span className="text-lg text-blue-700 ml-2">W</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-orange-50 border border-orange-200">
                      <CardHeader className="pb-3">
                        <CardDescription className="text-orange-700">Max Displacement</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-orange-900">
                          {selectedResult.maxDisplacement.toFixed(2)}
                          <span className="text-lg text-orange-700 ml-2">m</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-purple-50 border border-purple-200">
                      <CardHeader className="pb-3">
                        <CardDescription className="text-purple-700">Max Velocity</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-purple-900">
                          {selectedResult.maxVelocity.toFixed(2)}
                          <span className="text-lg text-purple-700 ml-2">m/s</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Chart */}
                  <Card className="bg-white border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-slate-900">Time Series Data</CardTitle>
                      <CardDescription className="text-slate-500">
                        Select signals to visualize
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Signal Checkboxes */}
                      <div className="flex flex-wrap gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                        {(Object.keys(SIGNAL_CONFIG) as SignalType[]).map((signal) => (
                          <div key={signal} className="flex items-center space-x-2">
                            <Checkbox
                              id={signal}
                              checked={visibleSignals.includes(signal)}
                              onCheckedChange={() => toggleSignal(signal)}
                            />
                            <Label
                              htmlFor={signal}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-slate-700"
                            >
                              <span
                                className="inline-block w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: SIGNAL_CONFIG[signal].color }}
                              />
                              {SIGNAL_CONFIG[signal].label}
                            </Label>
                          </div>
                        ))}
                      </div>

                      {/* Chart */}
                      <div className="w-full h-96 bg-white rounded-lg p-4 flex items-center justify-center">
                        {isLoadingData ? (
                           <div className="flex flex-col items-center text-slate-500">
                             <Loader2 className="w-8 h-8 animate-spin mb-2" />
                             <p>Loading result data...</p>
                           </div>
                        ) : selectedData ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={selectedData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis
                                dataKey="time"
                                stroke="#64748b"
                                label={{ value: "Time (s)", position: "insideBottom", offset: -5, fill: "#64748b" }}
                              />
                              <YAxis stroke="#64748b" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "8px",
                                  color: "#0f172a",
                                }}
                              />
                              <Legend />
                              {visibleSignals.map((signal) => (
                                <Line
                                  key={signal}
                                  type="monotone"
                                  dataKey={signal}
                                  stroke={SIGNAL_CONFIG[signal].color}
                                  name={SIGNAL_CONFIG[signal].label}
                                  dot={false}
                                  strokeWidth={2}
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-slate-500">No data available</div>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 text-center">
                        {selectedData ? `Data points: ${selectedData.length} | Auto-downsampled for performance` : ""}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Expandable Sections */}
                  <div className="space-y-4">
                    {/* Saved Plot */}
                    <Collapsible open={showPlot} onOpenChange={setShowPlot}>
                      <Card className="bg-white border-slate-200">
                        <CollapsibleTrigger className="w-full">
                          <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors">
                            <CardTitle className="text-slate-900 flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-slate-500" />
                                Saved PNG Plot
                              </span>
                              {showPlot ? (
                                <ChevronUp className="w-5 h-5 text-slate-500" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-slate-500" />
                              )}
                            </CardTitle>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent>
                            <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-center min-h-64 border border-slate-200">
                              {selectedResult.plotUrl ? (
                                <img 
                                  src={selectedResult.plotUrl} 
                                  alt="Matplotlib Plot" 
                                  className="max-w-full max-h-[600px] object-contain rounded"
                                />
                              ) : (
                                <p className="text-slate-500 text-center">
                                  No static plot available for this simulation
                                  <br />
                                  <span className="text-sm">
                                    (Generated by Python backend during simulation)
                                  </span>
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>

                    {/* Raw Data */}
                    <Collapsible open={showRawData} onOpenChange={setShowRawData}>
                      <Card className="bg-white border-slate-200">
                        <CollapsibleTrigger className="w-full">
                          <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors">
                            <CardTitle className="text-slate-900 flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-slate-500" />
                                Raw Data (DataFrame)
                              </span>
                              {showRawData ? (
                                <ChevronUp className="w-5 h-5 text-slate-500" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-slate-500" />
                              )}
                            </CardTitle>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-100 text-slate-700">
                                  <tr>
                                    <th className="px-4 py-2 text-left border-b border-slate-200">Time (s)</th>
                                    <th className="px-4 py-2 text-left border-b border-slate-200">Position (m)</th>
                                    <th className="px-4 py-2 text-left border-b border-slate-200">Velocity (m/s)</th>
                                    <th className="px-4 py-2 text-left border-b border-slate-200">Power (W)</th>
                                    <th className="px-4 py-2 text-left border-b border-slate-200">Excitation (N)</th>
                                    <th className="px-4 py-2 text-left border-b border-slate-200">Control</th>
                                  </tr>
                                </thead>
                                <tbody className="text-slate-600 bg-white">
                                  {selectedData?.slice(0, 20).map((row, idx) => (
                                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                      <td className="px-4 py-2 font-mono">{row.time?.toFixed(2) || "0"}</td>
                                      <td className="px-4 py-2 font-mono">{row.position?.toFixed(3) || "0"}</td>
                                      <td className="px-4 py-2 font-mono">{row.velocity?.toFixed(3) || "0"}</td>
                                      <td className="px-4 py-2 font-mono">{row.power_inst?.toFixed(2) || "0"}</td>
                                      <td className="px-4 py-2 font-mono">{row.excitation_force?.toFixed(2) || "0"}</td>
                                      <td className="px-4 py-2 font-mono">{row.control_signal?.toFixed(3) || "0"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {(selectedData?.length || 0) > 20 && (
                                <div className="text-center py-4 text-slate-500 text-xs bg-white">
                                  Showing 20 of {selectedData?.length} rows
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}


