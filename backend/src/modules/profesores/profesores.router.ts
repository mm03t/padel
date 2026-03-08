import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /api/profesores
router.get('/', async (_req: Request, res: Response) => {
  try {
    const profesores = await prisma.profesor.findMany({
      where: { activo: true },
      include: { _count: { select: { clases: true } } },
      orderBy: { apellidos: 'asc' },
    });
    res.json(profesores);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener profesores' });
  }
});

// GET /api/profesores/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const profesor = await prisma.profesor.findUnique({
      where: { id: req.params.id },
      include: {
        clases: { include: { pista: true, _count: { select: { inscripciones: { where: { activo: true } } } } } },
      },
    });
    if (!profesor) return res.status(404).json({ error: 'Profesor no encontrado' });
    res.json(profesor);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener profesor' });
  }
});

// POST /api/profesores
router.post('/', async (req: Request, res: Response) => {
  try {
    const { nombre, apellidos, email, telefono } = req.body;
    const profesor = await prisma.profesor.create({ data: { nombre, apellidos, email, telefono } });
    res.status(201).json(profesor);
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Ya existe un profesor con ese email' });
    res.status(500).json({ error: 'Error al crear profesor' });
  }
});

// PUT /api/profesores/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const profesor = await prisma.profesor.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(profesor);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar profesor' });
  }
});

export default router;
