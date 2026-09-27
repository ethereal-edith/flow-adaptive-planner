import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar } from 'lucide-react';

export default function TaskModal({ isOpen, onClose, onSave, taskToEdit }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState(45);
  const [deadline, setDeadline] = useState('');
  const [importance, setImportance] = useState(3);
  const [cognitiveLoad, setCognitiveLoad] = useState(3);
  const [flexibility, setFlexibility] = useState('flexible');
  const [category, setCategory] = useState('coursework');
  const [preferredTime, setPreferredTime] = useState('any');

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setDescription(taskToEdit.description || '');
      setEstimatedDuration(taskToEdit.estimated_duration || 45);
      setDeadline(taskToEdit.deadline ? taskToEdit.deadline.slice(0, 16) : '');
      setImportance(taskToEdit.importance || 3);
      setCognitiveLoad(taskToEdit.cognitive_load || 3);
      setFlexibility(taskToEdit.flexibility || 'flexible');
      setCategory(taskToEdit.category || 'coursework');
      setPreferredTime(taskToEdit.preferred_time_of_day || 'any');
    } else {
      setTitle('');
      setDescription('');
      setEstimatedDuration(45);
      setDeadline('');
      setImportance(3);
      setCognitiveLoad(3);
      setFlexibility('flexible');
      setCategory('coursework');
      setPreferredTime('any');
    }
  }, [taskToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      id: taskToEdit ? taskToEdit.id : `task-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      estimated_duration: Number(estimatedDuration) || 30,
      actual_duration: taskToEdit?.actual_duration || null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      importance: Number(importance),
      cognitive_load: Number(cognitiveLoad),
      flexibility,
      category,
      preferred_time_of_day: preferredTime,
      status: taskToEdit ? taskToEdit.status : 'pending',
      postponed_count: taskToEdit ? taskToEdit.postponed_count : 0,
      postpone_reason: taskToEdit ? taskToEdit.postpone_reason : null,
      created_at: taskToEdit?.created_at || new Date().toISOString(),
      completed_at: taskToEdit?.completed_at || null
    });

    onClose();
  };

  const categories = [
    { id: 'coursework', label: 'Coursework' },
    { id: 'coding', label: 'Coding / Dev' },
    { id: 'admin', label: 'Admin / Email' },
    { id: 'chores', label: 'Chores / Home' },
    { id: 'language', label: 'Language' },
    { id: 'personal', label: 'Personal' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3E3A3F]/30 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-[#F3EAE7] bg-white shadow-soft-lg p-6 sm:p-7 overflow-y-auto max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#F3EAE7]">
          <h2 className="text-lg font-heading font-bold text-[#3E3A3F]">
            {taskToEdit ? 'Edit Task' : 'Add a New Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#857C82] hover:text-[#3E3A3F] hover:bg-[#FFF9F7] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          
          <div>
            <label className="block text-xs font-semibold text-[#5C5257] mb-1.5">
              Task title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Advanced Database Assignment (B+ Tree)"
              className="w-full text-sm bg-[#FFF9F7] border border-[#EEDCD7] rounded-2xl px-4 py-2.5 text-[#3E3A3F] placeholder-[#B5AAA2] focus:outline-none focus:border-[#F8C8DC]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5C5257] mb-1.5">
              Notes or details
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any sub-steps or links"
              className="w-full text-sm bg-[#FFF9F7] border border-[#EEDCD7] rounded-2xl px-4 py-2.5 text-[#3E3A3F] placeholder-[#B5AAA2] focus:outline-none focus:border-[#F8C8DC]"
            />
          </div>

          {/* Duration & Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#5C5257] mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#857C82]" />
                <span>Estimated duration (min)</span>
              </label>
              <input
                type="number"
                min="5"
                step="5"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                className="w-full text-sm bg-[#FFF9F7] border border-[#EEDCD7] rounded-2xl px-4 py-2 text-[#3E3A3F] focus:outline-none focus:border-[#F8C8DC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5C5257] mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#857C82]" />
                <span>Deadline (optional)</span>
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full text-sm bg-[#FFF9F7] border border-[#EEDCD7] rounded-2xl px-4 py-2 text-[#3E3A3F] focus:outline-none focus:border-[#F8C8DC]"
              />
            </div>
          </div>

          {/* Cognitive Load Slider */}
          <div className="rounded-2xl bg-[#FFF9F7] border border-[#F1E5E1] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#3E3A3F]">
              <span>Effort & Cognitive Load</span>
              <span className="font-heading font-bold text-[#8A5265]">{cognitiveLoad} / 5</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={cognitiveLoad}
              onChange={(e) => setCognitiveLoad(Number(e.target.value))}
              className="w-full accent-[#F2ADC5] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-[#857C82]">
              <span>1: Chores / light admin</span>
              <span>3: Moderate</span>
              <span>5: Deep focus / coding</span>
            </div>
          </div>

          {/* Importance Slider */}
          <div className="rounded-2xl bg-[#FFF9F7] border border-[#F1E5E1] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#3E3A3F]">
              <span>Urgency / Importance</span>
              <span className="font-heading font-bold text-[#825742]">{importance} / 5</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={importance}
              onChange={(e) => setImportance(Number(e.target.value))}
              className="w-full accent-[#E09F7C] cursor-pointer"
            />
          </div>

          {/* Category & Preferred Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#5C5257] mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs bg-[#FFF9F7] border border-[#EEDCD7] rounded-2xl px-3.5 py-2.5 text-[#3E3A3F] focus:outline-none focus:border-[#F8C8DC] cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5C5257] mb-1.5">Preferred time</label>
              <select
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full text-xs bg-[#FFF9F7] border border-[#EEDCD7] rounded-2xl px-3.5 py-2.5 text-[#3E3A3F] focus:outline-none focus:border-[#F8C8DC] cursor-pointer"
              >
                <option value="any">Any time</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </select>
            </div>
          </div>

          {/* Flexibility */}
          <div>
            <label className="block text-xs font-semibold text-[#5C5257] mb-1.5">Schedule flexibility</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFlexibility('flexible')}
                className={`py-2 px-3 rounded-2xl text-xs font-medium border text-center transition-colors cursor-pointer ${
                  flexibility === 'flexible'
                    ? 'bg-[#F8C8DC]/40 border-[#F2ADC5] text-[#3E3A3F] font-semibold'
                    : 'bg-[#FFF9F7] border-[#EEDCD7] text-[#857C82]'
                }`}
              >
                Flexible (Engine can adapt)
              </button>
              <button
                type="button"
                onClick={() => setFlexibility('fixed')}
                className={`py-2 px-3 rounded-2xl text-xs font-medium border text-center transition-colors cursor-pointer ${
                  flexibility === 'fixed'
                    ? 'bg-[#F8C8DC]/40 border-[#F2ADC5] text-[#3E3A3F] font-semibold'
                    : 'bg-[#FFF9F7] border-[#EEDCD7] text-[#857C82]'
                }`}
              >
                Fixed (Anchor in place)
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F3EAE7]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-full text-xs font-medium text-[#857C82] hover:text-[#3E3A3F]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full text-xs font-semibold bg-[#F8C8DC] hover:bg-[#F2ADC5] text-[#3E3A3F] shadow-soft transition-colors cursor-pointer"
            >
              Save task
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
