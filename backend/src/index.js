import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import authRoutes from './routes/auth.js';
import petsRoutes from './routes/pets.js';
import diaryRoutes from './routes/diary.js';
import remindersRoutes from './routes/reminders.js';
import documentsRoutes from './routes/documents.js';
import familyRoutes, { invitesRouter } from './routes/family.js';
import calendarRoutes from './routes/calendar.js';
import analyticsRoutes from './routes/analytics.js';
import reportsRoutes from './routes/reports.js';
import subscriptionRoutes from './routes/subscription.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

function isLocalNetworkOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin);
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const configured = process.env.FRONTEND_URL;
    if (configured && origin === configured) return callback(null, true);
    if (isLocalNetworkOrigin(origin)) return callback(null, true);
    if (!configured && origin.startsWith('http://localhost:')) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'YourPet API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/pets', petsRoutes);
app.use('/api/pets/:petId/diary', diaryRoutes);
app.use('/api/pets/:petId/reminders', remindersRoutes);
app.use('/api/pets/:petId/documents', documentsRoutes);
app.use('/api/pets/:petId/family', familyRoutes);
app.use('/api/pets/:petId/calendar', calendarRoutes);
app.use('/api/pets/:petId/analytics', analyticsRoutes);
app.use('/api/pets/:petId/reports', reportsRoutes);
app.use('/api/invites', invitesRouter);
app.use('/api/subscription', subscriptionRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Файл слишком большой (макс. 5 МБ)' });
  }
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS: доступ с этого адреса запрещён' });
  }
  res.status(err.status || 500).json({
    error: err.message || 'Внутренняя ошибка сервера',
  });
});

function getLocalIp() {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface || []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return null;
}

const server = app.listen(PORT, HOST, () => {
  console.log(`YourPet API running on http://localhost:${PORT}`);
  const ip = getLocalIp();
  if (ip) {
    console.log(`  В локальной сети: http://${ip}:${PORT}`);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use. Run: npm run predev`);
    process.exit(1);
  }
  throw err;
});
