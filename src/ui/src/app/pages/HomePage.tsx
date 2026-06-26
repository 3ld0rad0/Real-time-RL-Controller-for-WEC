import { useNavigate } from "react-router";
import { Card, CardContent } from "../components/ui/card";
import { Dumbbell, FlaskConical, BarChart3, Brain } from "lucide-react";

const actions = [
  {
    title: "Train Model",
    description: "Configure and train a new RL agent with PPO algorithm",
    icon: Dumbbell,
    path: "/train",
    color: "from-blue-500 to-blue-600",
  },
  {
    title: "Test Model",
    description: "Evaluate trained models on different sea states",
    icon: FlaskConical,
    path: "/test",
    color: "from-cyan-500 to-cyan-600",
  },
  {
    title: "View Results",
    description: "Analyze simulation data and performance metrics",
    icon: BarChart3,
    path: "/results",
    color: "from-indigo-500 to-indigo-600",
  },
  {
    title: "Models",
    description: "Browse and manage trained model checkpoints",
    icon: Brain,
    path: "/models",
    color: "from-violet-500 to-violet-600",
  },
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-semibold text-slate-900 mb-3">
          Welcome to WEC-RL Controller
        </h2>
        <p className="text-lg text-slate-600">
          Select an action below to get started with your wave energy simulation
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Card
              key={action.path}
              className="cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-slate-200 overflow-hidden group"
              onClick={() => navigate(action.path)}
            >
              <CardContent className="p-0">
                <div className="aspect-square flex flex-col items-center justify-center p-8 relative">
                  {/* Gradient background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                  
                  {/* Icon with gradient background */}
                  <div className={`w-20 h-20 mb-4 rounded-2xl bg-gradient-to-br ${action.color} flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-10 h-10 text-white" />
                  </div>

                  {/* Text content */}
                  <h3 className="text-xl font-semibold text-slate-900 mb-2 text-center">
                    {action.title}
                  </h3>
                  <p className="text-sm text-slate-600 text-center leading-relaxed">
                    {action.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Additional info section */}
      <div className="mt-16 max-w-4xl mx-auto">
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              About This Platform
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              This scientific application provides a comprehensive interface for controlling and simulating 
              Wave Energy Converters using Reinforcement Learning. Train PPO agents, run physics simulations 
              of Point Absorbers across various sea states, and analyze performance results - all from a 
              single integrated environment.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
