import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, Brain, FileCode, Calendar, HardDrive, FlaskConical } from "lucide-react";
import { MOCK_MODELS, SEA_STATES } from "../lib/constants";

export function ModelsPage() {
  const navigate = useNavigate();

  const modelCategories = [
    { key: "irregular", label: "Irregular Waves", models: MOCK_MODELS.irregular, color: "blue" },
    { key: "regular", label: "Regular Waves", models: MOCK_MODELS.regular, color: "cyan" },
  ];

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
        <h2 className="text-3xl font-semibold text-slate-900">Trained Models</h2>
        <p className="text-slate-600 mt-2">
          Browse and manage your trained RL model checkpoints
        </p>
      </div>

      {/* Model Categories */}
      <div className="space-y-8">
        {modelCategories.map((category) => (
          <div key={category.key}>
            <div className="flex items-center gap-3 mb-4">
              <Brain className={`w-6 h-6 text-${category.color}-600`} />
              <h3 className="text-2xl font-semibold text-slate-900">{category.label}</h3>
              <Badge variant="secondary" className="ml-2">
                {category.models.length} {category.models.length === 1 ? "model" : "models"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.models.map((model) => {
                const seaState = SEA_STATES[model.seaState];
                return (
                  <Card
                    key={model.id}
                    className="border-slate-200 hover:shadow-lg transition-shadow"
                  >
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg text-slate-900 mb-2">
                            {model.path.split("/").pop()}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className={`bg-${category.color}-50 text-${category.color}-700 border-${category.color}-200`}
                          >
                            {seaState.label}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      {/* File Path */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <FileCode className="w-4 h-4" />
                          <span className="font-medium">Path</span>
                        </div>
                        <code className="block text-xs bg-slate-100 p-2 rounded text-slate-700 break-all">
                          {model.path}
                        </code>
                      </div>

                      {/* Metadata */}
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <HardDrive className="w-3.5 h-3.5" />
                            <span>Size</span>
                          </div>
                          <p className="text-sm font-medium text-slate-900">{model.size} MB</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Modified</span>
                          </div>
                          <p className="text-sm font-medium text-slate-900">
                            {new Date(model.modified).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Model Details */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-xs text-slate-600 mb-0.5">Control Mode</p>
                          <p className="text-sm font-medium text-slate-900 capitalize">
                            {model.controlMode}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-xs text-slate-600 mb-0.5">Entropy Coef</p>
                          <p className="text-sm font-medium text-slate-900">{model.entCoef}</p>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg">
                        <p className="text-xs text-slate-600 mb-0.5">Training Steps</p>
                        <p className="text-sm font-medium text-slate-900">
                          {model.steps.toLocaleString()}
                        </p>
                      </div>

                      {/* Action Button */}
                      <Button
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                        onClick={() => navigate("/test")}
                      >
                        <FlaskConical className="w-4 h-4 mr-2" />
                        Use for Testing
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Info Card */}
      <Card className="mt-8 border-blue-200 bg-blue-50/50">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">About Model Storage</h3>
          <p className="text-sm text-slate-700 leading-relaxed">
            Models are automatically organized by wave type (irregular/regular), sea state, and 
            simulation parameters. Each model checkpoint represents a trained PPO agent that can be 
            used for testing on various sea conditions. Models are stored in the <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">models/</code> directory 
            with metadata preserved in the file structure.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
