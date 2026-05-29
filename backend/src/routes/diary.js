import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, loadUser, canAccessPet } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authenticate, loadUser);

function formatEntry(row) {
  return {
    id: row.id,
    petId: row.pet_id,
    userId: row.user_id,
    userName: row.user_name,
    entryType: row.entry_type,
    title: row.title,
    content: row.content,
    entryDate: row.entry_date,
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
      `SELECT d.*, u.name AS user_name
       FROM diary_entries d
       JOIN users u ON u.id = d.user_id
       WHERE d.pet_id = $1
       ORDER BY d.entry_date DESC, d.created_at DESC`,
      [req.params.petId]
    );

    res.json({ entries: rows.map(formatEntry) });
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

    const { entryType, title, content, entryDate } = req.body;
    if (!entryType || !title) {
      return res.status(400).json({ error: 'Тип и заголовок записи обязательны' });
    }
    if (!['symptom', 'visit', 'note'].includes(entryType)) {
      return res.status(400).json({ error: 'Недопустимый тип записи' });
    }

    const { rows } = await pool.query(
      `INSERT INTO diary_entries (pet_id, user_id, entry_type, title, content, entry_date)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE))
       RETURNING *`,
      [
        req.params.petId,
        req.user.id,
        entryType,
        title.trim(),
        content?.trim() || null,
        entryDate || null,
      ]
    );

    const entry = rows[0];
    res.status(201).json({
      entry: formatEntry({ ...entry, user_name: req.currentUser.name }),
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:entryId', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }

    const { rowCount } = await pool.query(
      'DELETE FROM diary_entries WHERE id = $1 AND pet_id = $2',
      [req.params.entryId, req.params.petId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
