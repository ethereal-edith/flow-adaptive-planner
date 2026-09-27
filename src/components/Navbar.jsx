import React from 'react';
import {
  Compass,
  CheckSquare,
  Calendar,
  Sparkles,
  BarChart3,
  Settings
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenAiModal, onOpenSettings, dailyState }) {
  const navItems = [
    { id: 'today', label: 'Today', icon: Compass },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'insights', label: 'Insights', icon: BarChart3 },
  ];

  const getEnergyEmoji = (e) => {
    if (e <= 1) return { emoji: '🌙', label: 'Exhausted' };
    if (e === 2) return { emoji: '☁️', label: 'Low energy' };
    if (e === 3) return { emoji: '🌤️', label: 'Okay' };
    if (e === 4) return { emoji: '☀️', label: 'High energy' };
    return { emoji: '✨', label: 'Peak focus' };
  };

  const energyInfo = getEnergyEmoji(dailyState?.energy || 3);

  return (
    <header className="sticky top-0 z-30 bg-[#FFF9F7]/95 backdrop-blur-md border-b border-[#F3EAE7]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
        
        {/* Brand with subtle handwritten style */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F8C8DC] flex items-center justify-center shadow-soft">
            <span className="font-logo text-2xl text-[#3E3A3F] leading-none pt-0.5">f</span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-logo text-3xl text-[#3E3A3F] font-bold tracking-tight">Flow</span>
              <span className="text-xs font-heading font-medium text-[#857C82]">adaptive planner</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Soft rounded pill style */}
        <nav className="flex items-center gap-1 sm:gap-2 bg-white/80 p-1.5 rounded-full border border-[#F3EAE7] shadow-soft">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#F8C8DC] text-[#3E3A3F] shadow-sm font-semibold'
                    : 'text-[#857C82] hover:text-[#3E3A3F] hover:bg-[#FFF9F7]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#3E3A3F]' : 'text-[#857C82]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Actions: AI Planner button & Energy pill & Settings */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenAiModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#EAE4F2] hover:bg-[#DFD5E8] text-[#554366] text-xs sm:text-sm font-medium transition-all cursor-pointer shadow-soft"
            title="Chat with AI Planner"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#7E6596]" />
            <span className="hidden sm:inline">Ask Flow</span>
          </button>

          {/* Current energy soft pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#F3EAE7] text-xs font-medium text-[#3E3A3F] shadow-soft">
            <span>{energyInfo.emoji}</span>
            <span className="text-[#685F65]">{energyInfo.label}</span>
          </div>

          <button
            onClick={onOpenSettings}
            className="p-2 rounded-full text-[#857C82] hover:text-[#3E3A3F] hover:bg-white transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
}
