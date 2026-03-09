import express from 'express';
import cors from 'cors';
import { errorHandler, notFound } from './common/errors';
import authRouter from './modules/auth/auth.router';
import alumnosRouter from './modules/alumnos/alumnos.router';
import profesoresRouter from './modules/profesores/profesores.router';
import clasesRouter from './modules/clases/clases.router';
import sesionesRouter from './modules/sesiones/sesiones.router';
import recuperacionesRouter from './modules/recuperaciones/recuperaciones.router';
import notificacionesRouter from './modules/notificaciones/notificaciones.router';
import dashboardRouter from './modules/dashboard/dashboard.router';
import pagosRouter from './modules/pagos/pagos.router';
import listaEsperaRouter from './modules/lista-espera/lista-espera.router';
import solicitudesEsperaRouter from './modules/solicitudes-espera/solicitudes-espera.router';

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Rutas de la API
app.use('/api/auth', authRouter);
app.use('/api/alumnos', alumnosRouter);
app.use('/api/profesores', profesoresRouter);
app.use('/api/clases', clasesRouter);
app.use('/api/sesiones', sesionesRouter);
app.use('/api/recuperaciones', recuperacionesRouter);
app.use('/api/notificaciones', notificacionesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/pagos', pagosRouter);
app.use('/api/lista-espera', listaEsperaRouter);
app.use('/api/solicitudes-espera', solicitudesEsperaRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'Academia Pádel API', ts: new Date().toISOString() });
});

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🎾 Academia Pádel API → http://localhost:${PORT}`);
});

export default app;
