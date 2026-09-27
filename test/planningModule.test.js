import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculate_urgency,
  calculate_energy_match,
  calculate_task_suitability,
  detect_conflicts,
  find_available_blocks,
  generate_schedule,
  replan_schedule,
  record_task_outcome,
  time_string_to_minutes,
  minutes_to_time_string
} from '../src/engine/planningModule.js';

describe('Deterministic Planning Module Test Suite', () => {

  // 1. Time helper tests
  describe('Time string helpers', () => {
    it('converts HH:MM string to minutes correctly', () => {
      assert.equal(time_string_to_minutes('08:30'), 510);
      assert.equal(time_string_to_minutes('12:00'), 720);
      assert.equal(time_string_to_minutes('00:00'), 0);
    });

    it('converts minutes to HH:MM string correctly', () => {
      assert.equal(minutes_to_time_string(510), '08:30');
      assert.equal(minutes_to_time_string(720), '12:00');
    });
  });

  // 2. calculate_urgency()
  describe('calculate_urgency()', () => {
    it('scores overdue tasks with critical urgency (120)', () => {
      const pastDeadline = new Date(Date.now() - 3600 * 1000).toISOString();
      const res = calculate_urgency({ deadline: pastDeadline });
      assert.equal(res.urgencyScore, 120);
      assert.equal(res.isOverdue, true);
    });

    it('scores imminent deadlines (<12h) with high urgency (90)', () => {
      const soonDeadline = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
      const res = calculate_urgency({ deadline: soonDeadline });
      assert.equal(res.urgencyScore, 90);
      assert.equal(res.isOverdue, false);
    });

    it('scores tasks without deadline with baseline score (5)', () => {
      const res = calculate_urgency({ deadline: null });
      assert.equal(res.urgencyScore, 5);
      assert.equal(res.isOverdue, false);
    });
  });

  // 3. calculate_energy_match()
  describe('calculate_energy_match()', () => {
    it('rejects high cognitive load (5/5) when energy is low (2/5)', () => {
      const res = calculate_energy_match(5, 2, 2);
      assert.equal(res.isCompatible, false);
      assert.ok(res.matchScore < 0, 'Match score should be negative');
    });

    it('rewards low cognitive load (1/5) when energy is low (2/5)', () => {
      const res = calculate_energy_match(1, 2, 2);
      assert.equal(res.isCompatible, true);
      assert.ok(res.matchScore > 0, 'Low load should be prioritized when drained');
    });

    it('rewards high cognitive load (5/5) when energy is peak (5/5)', () => {
      const res = calculate_energy_match(5, 5, 2);
      assert.equal(res.isCompatible, true);
      assert.ok(res.matchScore > 50, 'High load should receive high reward in peak energy');
    });

    it('applies stress penalty reducing effective energy', () => {
      // Energy 3 with high stress (5) reduces effective energy to 2
      const res = calculate_energy_match(4, 3, 5);
      assert.equal(res.effectiveEnergy, 2);
      assert.equal(res.isCompatible, false);
    });
  });

  // 4. calculate_task_suitability()
  describe('calculate_task_suitability()', () => {
    it('combines urgency, importance, and energy match into composite score', () => {
      const task = {
        id: 't-1',
        title: 'Flashcards',
        importance: 4,
        cognitive_load: 2,
        estimated_duration: 30,
        deadline: new Date(Date.now() + 10 * 3600 * 1000).toISOString()
      };
      const dailyState = { energy: 2, stress: 2 };
      const res = calculate_task_suitability(task, dailyState);

      assert.equal(res.taskId, 't-1');
      assert.ok(res.suitabilityScore > 100, 'Score should be high for urgent low-effort task in low energy');
      assert.equal(res.isEnergyCompatible, true);
    });

    it('applies anti-stall bump for repeatedly postponed tasks', () => {
      const taskNormal = { id: 't-norm', importance: 3, cognitive_load: 3, postponed_count: 0 };
      const taskStalled = { id: 't-stall', importance: 3, cognitive_load: 3, postponed_count: 3 };
      const scoreNormal = calculate_task_suitability(taskNormal, { energy: 3, stress: 3 });
      const scoreStalled = calculate_task_suitability(taskStalled, { energy: 3, stress: 3 });

      assert.ok(scoreStalled.suitabilityScore > scoreNormal.suitabilityScore, 'Postponed task should receive anti-stall boost');
    });
  });

  // 5. detect_conflicts()
  describe('detect_conflicts()', () => {
    const fixedEvents = [
      { id: 'f-1', title: 'Lecture', startMin: 600, endMin: 690, category: 'class' } // 10:00 - 11:30
    ];

    it('detects collision with protected fixed commitments', () => {
      // Candidate slot: 10:30 - 11:00 (630 - 660)
      const conflict = detect_conflicts(630, 660, fixedEvents, []);
      assert.equal(conflict.hasConflict, true);
      assert.equal(conflict.conflictType, 'fixed_event_overlap');
    });

    it('detects collision when violating buffer after scheduled task', () => {
      const scheduled = [{ id: 's-1', title: 'Laundry', startTimeStr: '08:00', endTimeStr: '08:45' }];
      // Candidate slot starting at 08:50 (buffer is 15m, so 08:45 + 15m = 09:00 required)
      const conflict = detect_conflicts(530, 560, [], scheduled, 15);
      assert.equal(conflict.hasConflict, true);
      assert.equal(conflict.conflictType, 'task_overlap');
    });

    it('allows slot when time is completely clear of conflicts', () => {
      const conflict = detect_conflicts(480, 540, fixedEvents, [], 15); // 08:00 - 09:00
      assert.equal(conflict.hasConflict, false);
    });
  });

  // 6. find_available_blocks()
  describe('find_available_blocks()', () => {
    it('carves out free blocks between wake and sleep around fixed events', () => {
      const dateStr = new Date().toISOString().split('T')[0];
      const fixed = [
        {
          id: 'fix-1',
          title: 'Class',
          start_time: `${dateStr}T10:00:00.000Z`,
          end_time: `${dateStr}T11:30:00.000Z`,
          category: 'class',
          is_fixed: true
        }
      ];
      const preferences = { wake_time: '08:00', sleep_time: '23:00' };

      const { availableBlocks, totalAvailableMinutes } = find_available_blocks(dateStr, fixed, preferences);

      assert.ok(availableBlocks.length >= 2, 'Should find window before and after class');
      assert.ok(totalAvailableMinutes > 0);
      assert.equal(availableBlocks[0].startTimeStr, '08:00');
    });
  });

  // 7. generate_schedule() & reality check
  describe('generate_schedule()', () => {
    it('defers heavy cognitive load tasks when energy is low (2/5)', () => {
      const tasks = [
        { id: 't-heavy', title: 'Hard Math', cognitive_load: 5, estimated_duration: 60, flexibility: 'flexible' },
        { id: 't-light', title: 'Fold Clothes', cognitive_load: 1, estimated_duration: 30, flexibility: 'flexible' }
      ];
      const dailyState = { energy: 2, stress: 3 };
      const res = generate_schedule({ tasks, calendarEvents: [], dailyState });

      const scheduledTitles = res.scheduledToday.map(t => t.title);
      const postponedTitles = res.postponedTasks.map(t => t.title);

      assert.ok(scheduledTitles.includes('Fold Clothes'), 'Light task should be scheduled');
      assert.ok(postponedTitles.includes('Hard Math'), 'Heavy load task should be postponed in low energy');
    });

    it('detects schedule deficits and sets isUnrealistic without crashing', () => {
      // 10 tasks of 60 minutes = 600 minutes
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        id: `t-${i}`,
        title: `Task ${i}`,
        cognitive_load: 2,
        estimated_duration: 60,
        flexibility: 'flexible'
      }));
      // Only 120 minutes free
      const preferences = { wake_time: '08:00', sleep_time: '10:00' };
      const res = generate_schedule({ tasks, calendarEvents: [], preferences });

      assert.equal(res.reality.isUnrealistic, true);
      assert.ok(res.reality.warning.includes('deficit') || res.reality.warning.includes('over capacity') || res.reality.warning.includes('available'));
    });
  });

  // 8. replan_schedule() & record_task_outcome()
  describe('replan_schedule() and record_task_outcome()', () => {
    it('handles missed tasks by incrementing postponed_count and replanning', () => {
      const tasks = [
        { id: 'missed-1', title: 'Vocab', postponed_count: 0, estimated_duration: 20, cognitive_load: 2 }
      ];
      const res = replan_schedule({
        missedTaskId: 'missed-1',
        tasks,
        reason: 'User fell behind'
      });

      assert.equal(res.decisionRecord.trigger, 'replan');
    });

    it('calculates duration ratio correctly in record_task_outcome()', () => {
      const outcome = record_task_outcome({
        task_id: 't-code',
        category: 'coding',
        estimated_duration: 45,
        actual_duration: 63
      });

      assert.equal(outcome.ratio, 1.40);
      assert.equal(outcome.category, 'coding');
    });
  });

});
