import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /api/pagos?mes=3&año=2026
router.get('/', async (req: Request, res: Response) => {
  try {
    const { mes, año, alumnoId, estado } = req.query;

    const pagos = await prisma.pago.findMany({
      where: {
        ...(mes ? { mes: parseInt(mes as string) } : {}),
        ...(año ? { año: parseInt(año as string) } : {}),
        ...(alumnoId ? { alumnoId: alumnoId as string } : {}),
        ...(estado ? { estado: estado as any } : {}),
      },
      include: { alumno: true },
      orderBy: [{ año: 'desc' }, { mes: 'desc' }, { alumno: { apellidos: 'asc' } }],
    });

    res.json(pagos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
});

// POST /api/pagos/generar-mes — crea registros PENDIENTE para todos los alumnos activos sin pago ese mes
router.post('/generar-mes', async (req: Request, res: Response) => {
  try {
    const { mes, año } = req.body;

    if (!mes || !año) {
      return res.status(400).json({ error: 'Se requiere mes y año' });
    }

    const alumnos = await prisma.alumno.findMany({
      where: { activo: true },
      select: { id: true, tarifaMensual: true },
    });

    const existentes = await prisma.pago.findMany({
      where: { mes: parseInt(mes), año: parseInt(año) },
      select: { alumnoId: true },
    });

    const yaExisten = new Set(existentes.map((p) => p.alumnoId));
    const nuevos = alumnos.filter((a) => !yaExisten.has(a.id));

    if (nuevos.length === 0) {
      return res.json({ ok: true, creados: 0, mensaje: 'Todos los alumnos ya tienen pago para este mes' });
    }

    await prisma.pago.createMany({
      data: nuevos.map((a) => ({
        alumnoId: a.id,
        mes: parseInt(mes),
        año: parseInt(año),
        importe: a.tarifaMensual ?? 50,
        estado: 'PENDIENTE' as const,
      })),
    });

    res.json({ ok: true, creados: nuevos.length });
  } catch (error) {
    res.status(500).json({ error: 'Error al generar pagos del mes' });
  }
});

// POST /api/pagos
router.post('/', async (req: Request, res: Response) => {
  try {
    const { alumnoId, mes, año, importe, estado, notas } = req.body;

    if (!alumnoId || !mes || !año || importe == null) {
      return res.status(400).json({ error: 'Se requiere alumnoId, mes, año e importe' });
    }

    const pago = await prisma.pago.create({
      data: {
        alumnoId,
        mes: parseInt(mes),
        año: parseInt(año),
        importe: parseFloat(importe),
        estado: estado ?? 'PENDIENTE',
        notas,
      },
      include: { alumno: true },
    });

    res.status(201).json(pago);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un pago para este alumno en ese mes/año' });
    }
    res.status(500).json({ error: 'Error al crear pago' });
  }
});

// PUT /api/pagos/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { estado, importe, notas } = req.body;

    const pago = await prisma.pago.update({
      where: { id: req.params.id },
      data: {
        ...(estado ? { estado } : {}),
        ...(importe != null ? { importe: parseFloat(importe) } : {}),
        ...(notas !== undefined ? { notas } : {}),
      },
      include: { alumno: true },
    });

    res.json(pago);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar pago' });
  }
});

// DELETE /api/pagos/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.pago.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar pago' });
  }
});

export default router;
