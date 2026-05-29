import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import {
  authenticate,
  loadUser,
  isPremium,
  canAccessPet,
} from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const photoDir = path.join(__dirname, '../../uploads/pets');

if (!fs.existsSync(photoDir)) {
  fs.mkdirSync(photoDir, { recursive: true });
}

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2', '#4f46e5', '#c026d3'];

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, photoDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'image/heif',
      'image/bmp',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const extOk = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.bmp'].includes(ext);
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/') || extOk) {
      cb(null, true);
    } else {
      cb(new Error('Допустимы только изображения (JPG, PNG, WebP, HEIC и др.)'));
    }
  },
});

function uploadPhoto(req, res, next) {
  photoUpload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Ошибка загрузки файла' });
    }
    next();
  });
}

const router = Router();

router.use(authenticate, loadUser);

function formatPet(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    age: row.age,
    weight: row.weight ? parseFloat(row.weight) : null,
    avatarColor: row.avatar_color || '#2563eb',
    hasPhoto: Boolean(row.photo_filename),
    photoUrl: row.photo_filename ? `/api/pets/${row.id}/photo` : null,
    familyReferralToken: row.family_referral_token,
    role: row.role || 'owner',
    createdAt: row.created_at,
  };
}

async function recordWeight(petId, weight, note = null) {
  if (weight == null) return;
  await pool.query(
    `INSERT INTO weight_records (pet_id, weight, note) VALUES ($1, $2, $3)`,
    [petId, weight, note]
  );
}

function pickAvatarColor(requested) {
  if (requested && /^#[0-9a-fA-F]{6}$/.test(requested)) {
    return requested;
  }
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

async function getUserPetCount(userId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM pets WHERE owner_id = $1',
    [userId]
  );
  return rows[0].count;
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, COALESCE(pm.role, 'owner') AS role
       FROM pets p
       LEFT JOIN pet_members pm ON pm.pet_id = p.id AND pm.user_id = $1
       WHERE p.owner_id = $1 OR pm.user_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json({ pets: rows.map(formatPet) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/photo', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.id);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }
    if (!pet.photo_filename) {
      return res.status(404).json({ error: 'Фото не загружено' });
    }

    const filePath = path.join(photoDir, pet.photo_filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.id);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }
    res.json({ pet: formatPet(pet) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, species, breed, age, weight, avatarColor } = req.body;
    if (!name || !species) {
      return res.status(400).json({ error: 'Имя и вид питомца обязательны' });
    }

    const count = await getUserPetCount(req.user.id);
    if (!isPremium(req.currentUser) && count >= 1) {
      return res.status(403).json({
        error: 'Бесплатная версия позволяет добавить только одного питомца. Оформите Premium для мультипрофильности.',
        code: 'PET_LIMIT',
      });
    }

    const color = pickAvatarColor(avatarColor);
    const { rows } = await pool.query(
      `INSERT INTO pets (owner_id, name, species, breed, age, weight, avatar_color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.id, name.trim(), species.trim(), breed?.trim() || null, age || null, weight || null, color]
    );

    const pet = rows[0];
    await pool.query(
      'INSERT INTO pet_members (pet_id, user_id, role) VALUES ($1, $2, $3)',
      [pet.id, req.user.id, 'owner']
    );

    if (weight) {
      await recordWeight(pet.id, weight, 'Начальный вес');
    }

    res.status(201).json({ pet: formatPet({ ...pet, role: 'owner' }) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.id);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }
    if (pet.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Только владелец может редактировать профиль' });
    }

    const { name, species, breed, age, weight, avatarColor } = req.body;
    const { rows } = await pool.query(
      `UPDATE pets SET
         name = COALESCE($1, name),
         species = COALESCE($2, species),
         breed = COALESCE($3, breed),
         age = COALESCE($4, age),
         weight = COALESCE($5, weight),
         avatar_color = COALESCE($6, avatar_color)
       WHERE id = $7
       RETURNING *`,
      [
        name?.trim(),
        species?.trim(),
        breed?.trim(),
        age,
        weight,
        avatarColor,
        req.params.id,
      ]
    );

    if (weight != null && parseFloat(weight) !== parseFloat(pet.weight || 0)) {
      await recordWeight(req.params.id, weight, 'Обновление профиля');
    }

    res.json({ pet: formatPet({ ...rows[0], role: pet.role || 'owner' }) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/photo', uploadPhoto, async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.id);
    if (!pet) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Питомец не найден' });
    }
    if (pet.owner_id !== req.user.id) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Только владелец может менять фото' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    if (pet.photo_filename) {
      const oldPath = path.join(photoDir, pet.photo_filename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const { rows } = await pool.query(
      'UPDATE pets SET photo_filename = $1 WHERE id = $2 RETURNING *',
      [req.file.filename, req.params.id]
    );

    res.json({ pet: formatPet({ ...rows[0], role: pet.role || 'owner' }) });
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    next(err);
  }
});

router.delete('/:id/photo', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.id);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }
    if (pet.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Только владелец может удалить фото' });
    }

    if (pet.photo_filename) {
      const filePath = path.join(photoDir, pet.photo_filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    const { rows } = await pool.query(
      'UPDATE pets SET photo_filename = NULL WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    res.json({ pet: formatPet({ ...rows[0], role: pet.role || 'owner' }) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.id);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }
    if (pet.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Только владелец может удалить питомца' });
    }

    if (pet.photo_filename) {
      const filePath = path.join(photoDir, pet.photo_filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM pets WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
