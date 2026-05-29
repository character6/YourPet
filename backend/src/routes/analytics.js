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

router.get('/', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }

    const { rows: weightRows } = await pool.query(
      `SELECT id, weight, recorded_at, note, created_at
       FROM weight_records
       WHERE pet_id = $1
       ORDER BY recorded_at ASC, created_at ASC`,
      [req.params.petId]
    );

    const { rows: activityRows } = await pool.query(
      `SELECT
         TO_CHAR(DATE_TRUNC('week', completed_at), 'YYYY-MM-DD') AS week_start,
         task_type,
         COUNT(*)::int AS count
       FROM calendar_tasks
       WHERE pet_id = $1 AND completed_at IS NOT NULL
         AND completed_at >= NOW() - INTERVAL '12 weeks'
       GROUP BY DATE_TRUNC('week', completed_at), task_type
       ORDER BY week_start ASC`,
      [req.params.petId]
    );

    const weeksMap = new Map();
    for (const row of activityRows) {
      if (!weeksMap.has(row.week_start)) {
        weeksMap.set(row.week_start, {
          weekStart: row.week_start,
          walks: 0,
          feedings: 0,
          medicine: 0,
          other: 0,
          total: 0,
        });
      }
      const week = weeksMap.get(row.week_start);
      const count = row.count;
      if (row.task_type === 'walk') week.walks = count;
      else if (row.task_type === 'feeding') week.feedings = count;
      else if (row.task_type === 'medicine') week.medicine = count;
      else week.other += count;
      week.total += count;
    }

    res.json({
      petName: pet.name,
      currentWeight: pet.weight ? parseFloat(pet.weight) : null,
      weightHistory: weightRows.map((r) => ({
        id: r.id,
        weight: parseFloat(r.weight),
        recordedAt: r.recorded_at,
        note: r.note,
      })),
      activityByWeek: Array.from(weeksMap.values()),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/weight', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }

    const { weight, recordedAt, note } = req.body;
    if (!weight || weight <= 0) {
      return res.status(400).json({ error: 'Укажите корректный вес' });
    }

    const { rows } = await pool.query(
      `INSERT INTO weight_records (pet_id, weight, recorded_at, note)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4)
       RETURNING *`,
      [req.params.petId, weight, recordedAt || null, note?.trim() || null]
    );

    await pool.query('UPDATE pets SET weight = $1 WHERE id = $2', [weight, req.params.petId]);

    res.status(201).json({
      record: {
        id: rows[0].id,
        weight: parseFloat(rows[0].weight),
        recordedAt: rows[0].recorded_at,
        note: rows[0].note,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
