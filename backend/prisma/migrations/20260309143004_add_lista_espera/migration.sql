-- CreateTable
CREATE TABLE "lista_espera" (
    "id" TEXT NOT NULL,
    "alumno_id" TEXT NOT NULL,
    "clase_id" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lista_espera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lista_espera_alumno_id_clase_id_key" ON "lista_espera"("alumno_id", "clase_id");

-- AddForeignKey
ALTER TABLE "lista_espera" ADD CONSTRAINT "lista_espera_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "alumnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_espera" ADD CONSTRAINT "lista_espera_clase_id_fkey" FOREIGN KEY ("clase_id") REFERENCES "clases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
