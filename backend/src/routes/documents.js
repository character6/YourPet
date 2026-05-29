import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authenticate, loadUser, canAccessPet } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла'));
    }
  },
});

const router = Router({ mergeParams: true });

router.use(authenticate, loadUser);

function formatDocument(row) {
  return {
    id: row.id,
    petId: row.pet_id,
    userId: row.user_id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: row.size,
    uploadedAt: row.uploaded_at,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM documents WHERE pet_id = $1 ORDER BY uploaded_at DESC',
      [req.params.petId]
    );

    res.json({ documents: rows.map(formatDocument) });
  } catch (err) {
    next(err);
  }
});

router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Питомец не найден' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const { rows } = await pool.query(
      `INSERT INTO documents (pet_id, user_id, filename, original_name, mime_type, size)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.params.petId,
        req.user.id,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
      ]
    );

    res.status(201).json({ document: formatDocument(rows[0]) });
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    next(err);
  }
});

router.get('/:docId/download', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM documents WHERE id = $1 AND pet_id = $2',
      [req.params.docId, req.params.petId]
    );

    const doc = rows[0];
    if (!doc) {
      return res.status(404).json({ error: 'Документ не найден' });
    }

    const filePath = path.join(uploadDir, doc.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл не найден на сервере' });
    }

    res.download(filePath, doc.original_name);
  } catch (err) {
    next(err);
  }
});

router.delete('/:docId', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM documents WHERE id = $1 AND pet_id = $2',
      [req.params.docId, req.params.petId]
    );

    const doc = rows[0];
    if (!doc) {
      return res.status(404).json({ error: 'Документ не найден' });
    }

    const filePath = path.join(uploadDir, doc.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM documents WHERE id = $1', [doc.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
