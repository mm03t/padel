import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /api/solicitudes-espera[?estado=PENDIENTE]
router.get('/', async (req: Request, res: Response) => {
  try {
    const { estado } = req.query;
    const solicitudes = await prisma.solicitudEspera.findMany({
      where: estado ? { estado: estado as any } : undefined,
      orderBy: { createdAt: 'asc' },
    });
    res.json(solicitudes);
  } catch {
    res.status(500).json({ error: 'Error al obtener solicitudes de espera' });
  }
});

// POST /api/solicitudes-espera
router.post('/', async (req: Request, res: Response) => {
  try {
    const { nombre, apellidos, email, telefono, nivel, notas } = req.body;
    if (!nombre || !apellidos || !email) {
      return res.status(400).json({ error: 'nombre, apellidos y email son obligatorios' });
    }

    // Evitar duplicado por email
    const existente = await prisma.solicitudEspera.findFirst({ where: { email } });
    if (existente) {
      return res.status(409).json({ error: 'Ya existe una solicitud con ese email' });
    }

    const solicitud = await prisma.solicitudEspera.create({
      data: { nombre, apellidos, email, telefono, nivel: nivel ? parseFloat(nivel) : null, notas },
    });
    res.status(201).json(solicitud);
  } catch {
    res.status(500).json({ error: 'Error al crear solicitud' });
  }
});

// PUT /api/solicitudes-espera/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { nombre, apellidos, email, telefono, nivel, notas, estado } = req.body;
    const solicitud = await prisma.solicitudEspera.update({
      where: { id: req.params.id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(apellidos !== undefined && { apellidos }),
        ...(email !== undefined && { email }),
        ...(telefono !== undefined && { telefono }),
        ...(nivel !== undefined && { nivel: nivel ? parseFloat(nivel) : null }),
        ...(notas !== undefined && { notas }),
        ...(estado !== undefined && { estado }),
      },
    });
    res.json(solicitud);
  } catch {
    res.status(500).json({ error: 'Error al actualizar solicitud' });
  }
});

// DELETE /api/solicitudes-espera/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.solicitudEspera.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error al eliminar solicitud' });
  }
});

export default router;
