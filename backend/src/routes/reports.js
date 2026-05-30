import { Router } from 'express';
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import {
  authenticate,
  loadUser,
  requirePetPremiumFeatures,
  canAccessPet,
} from '../middleware/auth.js';
import { safeDownloadName } from '../utils/filename.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_REGULAR = path.join(__dirname, '../../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
const FONT_BOLD = path.join(__dirname, '../../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');

const router = Router({ mergeParams: true });

router.use(authenticate, loadUser, requirePetPremiumFeatures);

const ENTRY_LABELS = {
  symptom: 'Симптом',
  visit: 'Визит к врачу',
  note: 'Заметка',
};

const REMINDER_LABELS = {
  vaccination: 'Прививка',
  parasite: 'Обработка',
  other: 'Другое',
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

function buildPdfBuffer(pet, diary, reminders, weights, tasks) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font(FONT_BOLD).fontSize(20).text('YourPet — отчёт по уходу');
    doc.moveDown(0.5);
    doc.font(FONT_BOLD).fontSize(14).text(`Питомец: ${pet.name}`);
    doc.font(FONT_REGULAR).fontSize(11).fillColor('#334155');
    doc.text(
      [
        pet.species,
        pet.breed ? ` · ${pet.breed}` : '',
        pet.age != null ? ` · ${pet.age} лет` : '',
        pet.weight != null ? ` · ${pet.weight} кг` : '',
      ].join('')
    );
    doc.text(`Дата формирования: ${formatDate(new Date())}`);
    doc.moveDown();

    doc.fillColor('#0f172a').font(FONT_BOLD).fontSize(13).text('Динамика веса');
    doc.moveDown(0.3);
    doc.font(FONT_REGULAR).fontSize(10);
    if (weights.length === 0) {
      doc.fillColor('#64748b').text('Нет записей о весе');
    } else {
      for (const w of weights) {
        doc.fillColor('#0f172a').text(
          `${formatDate(w.recorded_at)} — ${parseFloat(w.weight)} кг${w.note ? ` (${w.note})` : ''}`
        );
      }
    }
    doc.moveDown();

    doc.fillColor('#0f172a').font(FONT_BOLD).fontSize(13).text('Дневник здоровья');
    doc.moveDown(0.3);
    if (diary.length === 0) {
      doc.font(FONT_REGULAR).fillColor('#64748b').fontSize(10).text('Записей нет');
    } else {
      for (const e of diary.slice(0, 25)) {
        doc.font(FONT_BOLD).fillColor('#0f172a').fontSize(10).text(
          `${formatDate(e.entry_date)} · ${ENTRY_LABELS[e.entry_type] || e.entry_type} · ${e.title}`
        );
        doc.font(FONT_REGULAR).fillColor('#64748b').text(e.content || '(без описания)', { indent: 10 });
        doc.text(`Автор: ${e.user_name}`, { indent: 10 });
        doc.moveDown(0.3);
      }
    }
    doc.moveDown();

    doc.fillColor('#0f172a').font(FONT_BOLD).fontSize(13).text('Напоминания');
    doc.moveDown(0.3);
    doc.font(FONT_REGULAR).fontSize(10);
    if (reminders.length === 0) {
      doc.fillColor('#64748b').text('Нет напоминаний');
    } else {
      for (const r of reminders) {
        doc.fillColor('#0f172a').text(
          `${formatDate(r.due_date)} · ${r.title} · ${REMINDER_LABELS[r.reminder_type] || r.reminder_type} · ${r.is_done ? 'Выполнено' : 'Ожидает'}`
        );
      }
    }
    doc.moveDown();

    doc.fillColor('#0f172a').font(FONT_BOLD).fontSize(13).text('Выполненные задачи (календарь)');
    doc.moveDown(0.3);
    doc.font(FONT_REGULAR).fontSize(10);
    if (tasks.length === 0) {
      doc.fillColor('#64748b').text('Нет выполненных задач');
    } else {
      for (const t of tasks.slice(0, 20)) {
        doc.fillColor('#0f172a').text(`${formatDate(t.completed_at)} · ${t.title} (${t.task_type})`);
      }
    }

    doc.end();
  });
}

router.get('/care-history', async (req, res, next) => {
  try {
    const pet = await canAccessPet(req.user.id, req.params.petId);
    if (!pet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }

    const [diary, reminders, weights, tasks] = await Promise.all([
      pool.query(
        `SELECT d.entry_type, d.title, d.content, d.entry_date, u.name AS user_name
         FROM diary_entries d JOIN users u ON u.id = d.user_id
         WHERE d.pet_id = $1 ORDER BY d.entry_date DESC LIMIT 50`,
        [req.params.petId]
      ),
      pool.query(
        'SELECT title, reminder_type, due_date, is_done FROM reminders WHERE pet_id = $1 ORDER BY due_date ASC',
        [req.params.petId]
      ),
      pool.query(
        'SELECT weight, recorded_at, note FROM weight_records WHERE pet_id = $1 ORDER BY recorded_at ASC',
        [req.params.petId]
      ),
      pool.query(
        `SELECT title, task_type, scheduled_at, completed_at
         FROM calendar_tasks WHERE pet_id = $1 AND completed_at IS NOT NULL
         ORDER BY completed_at DESC LIMIT 30`,
        [req.params.petId]
      ),
    ]);

    const buffer = await buildPdfBuffer(
      pet,
      diary.rows,
      reminders.rows,
      weights.rows,
      tasks.rows
    );

    const filename = safeDownloadName(`yourpet-${pet.name.replace(/\s+/g, '-')}-report.pdf`, 'report.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.end(buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
