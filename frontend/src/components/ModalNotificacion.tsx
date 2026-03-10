'use client';

import { useState } from 'react';
import { MessageCircle, Mail, Send, X, CheckCircle } from 'lucide-react';

interface Props {
  count: number;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ModalNotificacion({ count, onConfirm, onClose }: Props) {
  const [canales, setCanales] = useState<string[]>(['whatsapp', 'email']);
  const [enviado, setEnviado] = useState(false);

  const toggle = (canal: string) => {
    setCanales((prev) =>
      prev.includes(canal) ? prev.filter((c) => c !== canal) : [...prev, canal],
    );
  };

  const handleEnviar = () => {
    setEnviado(true);
    setTimeout(() => {
      onConfirm();
    }, 1500);
  };

  const canalLabel =
    canales.includes('whatsapp') && canales.includes('email')
      ? 'WhatsApp y correo'
      : canales.includes('whatsapp')
      ? 'WhatsApp'
      : 'correo electrónico';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {!enviado ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-black text-slate-800 text-base">¿Cómo les avisamos?</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {count} alumno{count !== 1 ? 's' : ''} seleccionado{count !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={16} />
              </button>
            </div>

            {/* Canales */}
            <div className="px-5 py-5 space-y-3">
              <label
                className="flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all"
                style={
                  canales.includes('whatsapp')
                    ? { borderColor: '#25d366', background: '#f0fdf4' }
                    : { borderColor: '#e2e8f0', background: '#f8fafc' }
                }
              >
                <input
                  type="checkbox"
                  checked={canales.includes('whatsapp')}
                  onChange={() => toggle('whatsapp')}
                  className="w-4 h-4 accent-[#25d366]"
                />
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: '#25d366' }}
                  >
                    <MessageCircle size={18} color="white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">WhatsApp</p>
                    <p className="text-xs text-slate-400">Mensaje directo al móvil</p>
                  </div>
                </div>
              </label>

              <label
                className="flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all"
                style={
                  canales.includes('email')
                    ? { borderColor: '#1e83ec', background: '#eff6ff' }
                    : { borderColor: '#e2e8f0', background: '#f8fafc' }
                }
              >
                <input
                  type="checkbox"
                  checked={canales.includes('email')}
                  onChange={() => toggle('email')}
                  className="w-4 h-4 accent-[#1e83ec]"
                />
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: '#1e83ec' }}
                  >
                    <Mail size={18} color="white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">Correo electrónico</p>
                    <p className="text-xs text-slate-400">Notificación por email</p>
                  </div>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={handleEnviar}
                disabled={canales.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white flex-1 justify-center disabled:opacity-40 transition-opacity"
                style={{ background: '#1e83ec' }}
              >
                <Send size={14} />
                Enviar notificación
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <div className="px-5 py-10 flex flex-col items-center justify-center gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: '#eff6ff' }}
            >
              <CheckCircle size={36} style={{ color: '#1e83ec' }} />
            </div>
            <p className="text-base font-black text-slate-800">¡Notificación enviada!</p>
            <p className="text-sm text-slate-400 text-center">
              {count} alumno{count !== 1 ? 's' : ''} notificado{count !== 1 ? 's' : ''} vía {canalLabel}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
