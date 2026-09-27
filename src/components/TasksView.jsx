import React, { useState } from 'react';
import {
  Plus,
  Search,
  Clock,
  Calendar,
  CheckCircle2,
  Trash2,
  Edit2
} from 'lucide-react';

export default function TasksView({
  tasks = [],
  onOpenAddModal,
  onEditTask,
  onDeleteTask,
  onCompleteTask
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredTasks = tasks.filter((task) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = task.title?.toLowerCase().includes(q);
      const matchDesc = task.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }

    if (categoryFilter !== 'all' && task.category !== categoryFilter) {
      return false;
    }

    if (filter === 'pending') return task.status === 'pending' || task.status === 'in_progress';
    if (filter === 'deep_focus') return (task.cognitive_load || 3) >= 4 && task.status !== 'completed';
    if (filter === 'low_load') return (task.cognitive_load || 3) <= 2 && task.status !== 'completed';
    if (filter === 'postponed') return task.status === 'postponed';
    if (filter === 'completed') return task.status === 'completed';

    return true;
  });

  const getLoadBadge = (load) => {
    const badges = {
      1: { emoji: '🧺', label: 'Very gentle', bg: 'bg-[#F2F7F2] text-[#426147] border-[#DFEBDD]' },
      2: { emoji: '📝', label: 'Low effort', bg: 'bg-[#F4F1FA] text-[#5C4872] border-[#E6DEEE]' },
      3: { emoji: '🌱', label: 'Moderate', bg: 'bg-[#FFF6ED] text-[#7A5636] border-[#FBE5D2]' },
      4: { emoji: '📖', label: 'High focus', bg: 'bg-[#FFF0F4] text-[#854559] border-[#FCDCE6]' },
      5: { emoji: '💻', label: 'Deep problem solving', bg: 'bg-[#FFF0F3] text-[#8A3751] border-[#FCD6E0]' }
    };
    const b = badges[load] || badges[3];
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${b.bg}`}>
        <span>{b.emoji}</span>
        <span>{b.label}</span>
      </span>
    );
  };

  const categories = [
    { id: 'all', label: 'All Categories' },
    { id: 'coursework', label: 'Coursework' },
    { id: 'coding', label: 'Coding' },
    { id: 'admin', label: 'Admin' },
    { id: 'chores', label: 'Chores' },
    { id: 'language', label: 'Language' },
    { id: 'personal', label: 'Personal' }
  ];

  return (
    <div className="space-y-6 pb-16">
      
      {/* Top Header & Add Task Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-[#3E3A3F] tracking-tight">
            All Tasks & Commitments
          </h2>
          <p className="text-xs text-[#857C82]">
            Keep track of what needs doing, tagged by effort level and deadlines.
          </p>
        </div>

        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F8C8DC] hover:bg-[#F2ADC5] text-[#3E3A3F] text-xs sm:text-sm font-semibold shadow-soft transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add a task</span>
        </button>
      </div>

      {/* Search and Category Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#F3EAE7] shadow-soft">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#A89E9B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search through tasks..."
            className="w-full text-xs bg-[#FFF9F7] border border-[#F1E5E1] rounded-full pl-9 pr-4 py-2 text-[#3E3A3F] placeholder-[#B0A6A3] focus:outline-none focus:border-[#F8C8DC]"
          />
        </div>

        {/* Category Dropdown */}
        <div className="w-full sm:w-44">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full text-xs bg-[#FFF9F7] border border-[#F1E5E1] rounded-full px-3.5 py-2 text-[#5A5056] focus:outline-none focus:border-[#F8C8DC] cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Filter Tabs as soft pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: `All (${tasks.length})` },
          { id: 'pending', label: 'Active' },
          { id: 'deep_focus', label: 'High Focus' },
          { id: 'low_load', label: 'Low Effort' },
          { id: 'postponed', label: 'Set Aside' },
          { id: 'completed', label: 'Completed' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              filter === tab.id
                ? 'bg-[#3E3A3F] text-white shadow-soft font-semibold'
                : 'bg-white text-[#7E747A] border border-[#F3EAE7] hover:border-[#E5D7D3] hover:text-[#3E3A3F]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Task List: Simple card list, relaxed spacing */}
      <div className="space-y-3.5">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 rounded-3xl border border-[#F3EAE7] bg-white text-[#A39996] text-sm shadow-soft">
            No tasks found here.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isPostponed = task.status === 'postponed';

            return (
              <div
                key={task.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-soft ${
                  isCompleted
                    ? 'bg-[#FFFAF8] border-[#F1E5E1] opacity-60'
                    : isPostponed
                    ? 'bg-[#FFFDFB] border-[#F7E7DE]'
                    : 'bg-white border-[#F3EAE7] hover:border-[#E8DAD5]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  
                  <div className="flex items-start gap-3.5 min-w-0">
                    <button
                      onClick={() => !isCompleted && onCompleteTask(task)}
                      disabled={isCompleted}
                      className={`w-5 h-5 mt-0.5 rounded-full border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                        isCompleted
                          ? 'bg-[#98B69E] border-[#81A388] text-white'
                          : 'border-[#D5C5BE] hover:border-[#F2ADC5] hover:bg-[#F8C8DC]/30 text-transparent hover:text-[#3E3A3F]'
                      }`}
                      title={isCompleted ? 'Completed' : 'Mark done'}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-semibold truncate ${
                            isCompleted ? 'line-through text-[#8A8186]' : 'text-[#2D2B2E]'
                          }`}
                        >
                          {task.title}
                        </span>

                        {getLoadBadge(task.cognitive_load || 3)}

                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#FFF9F7] border border-[#F1E5E1] text-[#70666C]">
                          {task.category}
                        </span>
                      </div>

                      {task.description && (
                        <p className="text-xs text-[#6B6166] leading-relaxed max-w-2xl">
                          {task.description}
                        </p>
                      )}

                      {/* Postpone reason if applicable */}
                      {isPostponed && task.postpone_reason && (
                        <p className="text-[11px] text-[#825742] bg-[#FCEEE6] border border-[#F7D8CE] rounded-xl px-3 py-1.5 mt-1.5 inline-block">
                          {task.postpone_reason}
                        </p>
                      )}

                      {/* Metadata badges */}
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[#857C82]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#A89E9B]" />
                          Est: {task.estimated_duration}m
                          {task.actual_duration && (
                            <span className="text-[#4E7055] font-medium"> · Took: {task.actual_duration}m</span>
                          )}
                        </span>

                        {task.deadline && (
                          <span className="flex items-center gap-1 text-[#665B62]">
                            <Calendar className="w-3 h-3 text-[#857C82]" />
                            Due: {new Date(task.deadline).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}

                        {task.postponed_count > 0 && (
                          <span className="text-[#825742] bg-[#FCEEE6] px-2 py-0.5 rounded-full text-[10px] font-medium">
                            Moved {task.postponed_count}x
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onEditTask(task)}
                      className="p-2 rounded-full text-[#857C82] hover:text-[#3E3A3F] hover:bg-[#FFF9F7] transition-colors cursor-pointer"
                      title="Edit task"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-2 rounded-full text-[#857C82] hover:text-[#B54A4A] hover:bg-[#FFF9F7] transition-colors cursor-pointer"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
