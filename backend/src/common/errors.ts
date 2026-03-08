import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
};

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error(`[ERROR] ${err.message}`);

  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos únicos.' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Registro no encontrado.' });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Error interno del servidor',
  });
};
