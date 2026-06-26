import { useNavigate } from "react-router";
import { Card } from "../components/ui/card";
import { Activity, FlaskConical, LineChart, Brain } from "lucide-react";

const navCards = [
  {
    icon: Activity,
    title: "Train Model",
    description: "Configure and train a new RL agent",
    path: "/train",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: FlaskConical,
    title: "Test Model",
    description: "Evaluate trained models on sea states",
    path: "/test",
    gradient: "from-cyan-500 to-teal-500",
  },
  {
    icon: LineChart,
    title: "View Results",
    description: "Analyze simulation data and metrics",
    path: "/results",
    gradient: "from-teal-500 to-emerald-500",
  },
  {
    icon: Brain,
    title: "Models",
    description: "Browse and manage trained models",
    path: "/models",
    gradient: "from-emerald-500 to-blue-500",
  },
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Wave decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <svg
          className="absolute bottom-0 w-full h-64 opacity-20"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
        >
          <path
            fill="currentColor"
            className="text-blue-300"
            d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,122.7C672,117,768,139,864,154.7C960,171,1056,181,1152,170.7C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-12">
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <svg
              className="w-16 h-16 text-blue-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2v20M2 12h20M6.5 6.5l11 11M6.5 17.5l11-11" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <h1 className="text-6xl font-bold text-slate-900">
            WEC-RL Controller
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Wave Energy Converter Reinforcement Learning Control System
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 pt-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>System Ready</span>
          </div>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl">
          {navCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.path}
                className="group relative overflow-hidden bg-white border-slate-200 hover:border-blue-500 transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/10"
                onClick={() => navigate(card.path)}
              >
                <div className="aspect-square p-8 flex flex-col items-center justify-center text-center space-y-4">
                  {/* Gradient background */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`}
                  />
                  
                  {/* Icon */}
                  <div className="relative">
                    <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-300`} />
                    <div className={`relative p-4 rounded-2xl bg-gradient-to-br ${card.gradient} shadow-md`}>
                      <Icon className="w-10 h-10 text-white" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="relative space-y-2">
                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-sm text-slate-500 group-hover:text-slate-600 transition-colors">
                      {card.description}
                    </p>
                  </div>

                  {/* Hover indicator */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                </div>
              </Card>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="mt-16 text-center text-sm text-slate-400">
          <p>Point Absorber Physics Simulation • PPO Algorithm • TCP Socket Control</p>
        </div>
      </div>
    </div>
  );
}
