import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, loadUser, canAccessPet } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authenticate, loadUser);

function formatReminder(row) {
  return {
    id: row.id,
    petId: row.pet_id,
    title: row.title,
    reminderType: row.reminder_type,
    dueDate: row.due_date,
    isDone: row.is_done,
    createdAt: row.created_at,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM reminders WHERE pet_id = $1 ORDER BY due_date ASC',
      [req.params.petId]
    );

    res.json({ reminders: rows.map(formatReminder) });
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

    const { title, reminderType, dueDate } = req.body;
    if (!title || !reminderType || !dueDate) {
      return res.status(400).json({ error: 'Заголовок, тип и дата обязательны' });
    }

    const { rows } = await pool.query(
      `INSERT INTO reminders (pet_id, title, reminder_type, due_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.petId, title.trim(), reminderType, dueDate]
    );

    res.status(201).json({ reminder: formatReminder(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:reminderId', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }

    const { isDone } = req.body;
    const { rows } = await pool.query(
      `UPDATE reminders SET is_done = COALESCE($1, is_done)
       WHERE id = $2 AND pet_id = $3
       RETURNING *`,
      [isDone, req.params.reminderId, req.params.petId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Напоминание не найдено' });
    }

    res.json({ reminder: formatReminder(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:reminderId', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }

    await pool.query(
      'DELETE FROM reminders WHERE id = $1 AND pet_id = $2',
      [req.params.reminderId, req.params.petId]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
