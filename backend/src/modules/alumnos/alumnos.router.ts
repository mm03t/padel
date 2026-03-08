import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /api/alumnos
router.get('/', async (req: Request, res: Response) => {
  try {
    const { nivel, disponibilidad, activo, search } = req.query;

    const alumnos = await prisma.alumno.findMany({
      where: {
        ...(activo !== undefined ? { activo: activo === 'true' } : {}),
        ...(disponibilidad ? { disponibilidad: disponibilidad as any } : {}),
        ...(nivel ? { nivel: parseFloat(nivel as string) } : {}),
        ...(search
          ? {
              OR: [
                { nombre: { contains: search as string, mode: 'insensitive' } },
                { apellidos: { contains: search as string, mode: 'insensitive' } },
                { email: { contains: search as string, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        inscripciones: {
          where: { activo: true },
          include: { clase: { include: { profesor: true, pista: true } } },
        },
        _count: {
          select: {
            recuperaciones: { where: { estado: 'PENDIENTE' } },
          },
        },
      },
      orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
    });

    res.json(alumnos);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener alumnos' });
  }
});

// GET /api/alumnos/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const alumno = await prisma.alumno.findUnique({
      where: { id: req.params.id },
      include: {
        inscripciones: {
          include: { clase: { include: { profesor: true, pista: true } } },
        },
        recuperaciones: {
          include: {
            sesionOrigen: { include: { clase: true } },
            sesionRecuperacion: { include: { clase: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
    res.json(alumno);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener alumno' });
  }
});

// POST /api/alumnos
router.post('/', async (req: Request, res: Response) => {
  try {
    const { nombre, apellidos, email, telefono, nivel, disponibilidad, notas } = req.body;

    if (!nombre || !apellidos || !email || !telefono || nivel === undefined) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const alumno = await prisma.alumno.create({
      data: { nombre, apellidos, email, telefono, nivel: parseFloat(nivel), disponibilidad, notas },
    });

    res.status(201).json(alumno);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un alumno con ese email' });
    }
    res.status(500).json({ error: 'Error al crear alumno' });
  }
});

// PUT /api/alumnos/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { nombre, apellidos, email, telefono, nivel, disponibilidad, activo, notas } = req.body;

    const alumno = await prisma.alumno.update({
      where: { id: req.params.id },
      data: {
        ...(nombre !== undefined ? { nombre } : {}),
        ...(apellidos !== undefined ? { apellidos } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(telefono !== undefined ? { telefono } : {}),
        ...(nivel !== undefined ? { nivel: parseFloat(nivel) } : {}),
        ...(disponibilidad !== undefined ? { disponibilidad } : {}),
        ...(activo !== undefined ? { activo } : {}),
        ...(notas !== undefined ? { notas } : {}),
      },
    });

    res.json(alumno);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al actualizar alumno' });
  }
});

// DELETE /api/alumnos/:id  (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.alumno.update({
      where: { id: req.params.id },
      data: { activo: false },
    });
    res.json({ ok: true, mensaje: 'Alumno desactivado' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al eliminar alumno' });
  }
});

export default router;
