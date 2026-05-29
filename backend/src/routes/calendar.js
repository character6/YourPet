import { Router } from 'express';
import pool from '../config/db.js';
import {
  authenticate,
  loadUser,
  requirePremium,
  canAccessPet,
} from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authenticate, loadUser, requirePremium);

const RECURRENCE_LABELS = {
  once: 'Один раз',
  daily: 'Каждый день',
  weekly: 'Раз в неделю',
  monthly: 'Раз в месяц',
  every_4h: 'Каждые 4 часа',
  every_6h: 'Каждые 6 часов',
  every_12h: 'Каждые 12 часов',
};

const VALID_RECURRENCE = Object.keys(RECURRENCE_LABELS);

function formatTask(row) {
  return {
    id: row.id,
    petId: row.pet_id,
    createdBy: row.created_by,
    creatorName: row.creator_name,
    title: row.title,
    taskType: row.task_type,
    scheduledAt: row.scheduled_at,
    recurrence: row.recurrence || 'once',
    recurrenceLabel: RECURRENCE_LABELS[row.recurrence] || RECURRENCE_LABELS.once,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    completedByName: row.completed_by_name,
    createdAt: row.created_at,
  };
}

function getNextScheduledAt(current, recurrence) {
  const date = new Date(current);
  switch (recurrence) {
    case 'every_4h':
      date.setHours(date.getHours() + 4);
      break;
    case 'every_6h':
      date.setHours(date.getHours() + 6);
      break;
    case 'every_12h':
      date.setHours(date.getHours() + 12);
      break;
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    default:
      return null;
  }
  return date.toISOString();
}

router.get('/', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }

    const { rows } = await pool.query(
      `SELECT ct.*,
              cu.name AS creator_name,
              cbu.name AS completed_by_name
       FROM calendar_tasks ct
       JOIN users cu ON cu.id = ct.created_by
       LEFT JOIN users cbu ON cbu.id = ct.completed_by
       WHERE ct.pet_id = $1
       ORDER BY ct.scheduled_at DESC`,
      [req.params.petId]
    );

    res.json({ tasks: rows.map(formatTask) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }

    const { title, taskType, scheduledAt, recurrence = 'once' } = req.body;
    if (!title || !taskType || !scheduledAt) {
      return res.status(400).json({ error: 'Заголовок, тип и время обязательны' });
    }
    if (!VALID_RECURRENCE.includes(recurrence)) {
      return res.status(400).json({ error: 'Недопустимая периодичность' });
    }

    const { rows } = await pool.query(
      `INSERT INTO calendar_tasks (pet_id, created_by, title, task_type, scheduled_at, recurrence)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.params.petId, req.user.id, title.trim(), taskType, scheduledAt, recurrence]
    );

    res.status(201).json({
      task: formatTask({ ...rows[0], creator_name: req.currentUser.name }),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:taskId/complete', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }

    const { rows } = await pool.query(
      `UPDATE calendar_tasks
       SET completed_at = NOW(), completed_by = $1
       WHERE id = $2 AND pet_id = $3 AND completed_at IS NULL
       RETURNING *`,
      [req.user.id, req.params.taskId, req.params.petId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Задача не найдена или уже выполнена' });
    }

    const task = rows[0];

    if (task.recurrence && task.recurrence !== 'once') {
      const nextAt = getNextScheduledAt(task.scheduled_at, task.recurrence);
      if (nextAt) {
        await pool.query(
          `INSERT INTO calendar_tasks (pet_id, created_by, title, task_type, scheduled_at, recurrence)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [task.pet_id, task.created_by, task.title, task.task_type, nextAt, task.recurrence]
        );
      }
    }

    res.json({
      task: formatTask({
        ...task,
        completed_by_name: req.currentUser.name,
      }),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
