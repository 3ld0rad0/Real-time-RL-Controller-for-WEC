import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Brain, FileCode, Calendar, HardDrive, TestTube, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { api, TrainedModel } from "../services/api";

export function ModelsPage() {
  const navigate = useNavigate();
  const [models, setModels] = useState<TrainedModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.getModels()
      .then(data => {
        setModels(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load models:", err);
        setIsLoading(false);
      });
  }, []);

  const irregularModels = models.filter((m) => m.waveType === "irregular");
  const regularModels = models.filter((m) => m.waveType === "regular");

  const handleUseForTesting = (modelId: string) => {
    navigate(`/test?model=${modelId}`);
  };

  const ModelCard = ({ model }: { model: TrainedModel }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <Card className="bg-white border-slate-200 hover:border-blue-500/50 transition-all shadow-sm">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1 min-w-0">
                <CardTitle className="text-slate-900 text-lg break-all" title={model.name}>
                  {model.name}
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Sea State {model.seaState} • Hw={model.waveHeight}m, T={model.period}s
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className={`${
                    model.waveType === "irregular"
                      ? "border-blue-300 text-blue-700 bg-blue-50"
                      : "border-purple-300 text-purple-700 bg-purple-50"
                  }`}
                >
                  {model.waveType}
                </Badge>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Action Button always visible */}
            <Button
              onClick={() => handleUseForTesting(model.id)}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
            >
              <TestTube className="w-4 h-4 mr-2" />
              Use for Testing
            </Button>

            <CollapsibleContent className="space-y-4 pt-4 border-t border-slate-100">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500">Size</p>
                    <p className="text-slate-900 font-medium">{model.size.toFixed(1)} MB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500">Last Modified</p>
                    <p className="text-slate-900 font-medium">
                      {new Date(model.lastModified).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Entropy Coefficient */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Entropy Coefficient</span>
                  <span className="text-sm font-mono text-emerald-600">{model.entCoef}</span>
                </div>
              </div>
            </CollapsibleContent>
          </CardContent>
        </Collapsible>
      </Card>
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

        <div className="space-y-8">
          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
              <Brain className="w-10 h-10 text-emerald-600" />
              Trained Models
            </h1>
            <p className="text-lg text-slate-600">
              Browse and manage your trained PPO agents
            </p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-blue-50 border-blue-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="text-blue-700">Total Models</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-900">{models.length}</div>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 border-purple-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="text-purple-700">Regular Waves</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-900">{regularModels.length}</div>
              </CardContent>
            </Card>

            <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="text-emerald-700">Irregular Waves</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-900">{irregularModels.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Irregular Wave Models */}
          {irregularModels.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-300 to-transparent" />
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  Irregular Wave Models
                  <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50 ml-2">
                    {irregularModels.length}
                  </Badge>
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-300 to-transparent" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {irregularModels.map((model) => (
                  <ModelCard key={model.id} model={model} />
                ))}
              </div>
            </div>
          )}

          {/* Regular Wave Models */}
          {regularModels.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-300 to-transparent" />
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  Regular Wave Models
                  <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50 ml-2">
                    {regularModels.length}
                  </Badge>
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-300 to-transparent" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {regularModels.map((model) => (
                  <ModelCard key={model.id} model={model} />
                ))}
              </div>
            </div>
          )}

          {/* Empty/Loading State */}
          {isLoading ? (
            <Card className="bg-white border-slate-200">
              <CardContent className="py-12 text-center flex flex-col items-center">
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Loading Models...</h3>
                <p className="text-slate-500">Scanning model directories</p>
              </CardContent>
            </Card>
          ) : models.length === 0 ? (
            <Card className="bg-white border-slate-200">
              <CardContent className="py-12 text-center">
                <Brain className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">No Models Found</h3>
                <p className="text-slate-500 mb-6">
                  Train your first model to get started
                </p>
                <Button
                  onClick={() => navigate("/train")}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                >
                  Go to Train Page
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}


