import { Outlet, useLocation } from "react-router";
import { Waves } from "lucide-react";

export function Layout() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header - shown on all pages */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[var(--ocean-primary)] to-[var(--ocean-secondary)] rounded-lg flex items-center justify-center">
              <Waves className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">WEC-RL Controller</h1>
              <p className="text-sm text-slate-500">Wave Energy Converter Reinforcement Learning System</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className={isHome ? "" : "container mx-auto px-6 py-8"}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/60 backdrop-blur-sm mt-auto py-4">
        <div className="container mx-auto px-6">
          <p className="text-sm text-center text-slate-500">
            WEC-RL Controller v1.0 • Marine Energy Research Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
