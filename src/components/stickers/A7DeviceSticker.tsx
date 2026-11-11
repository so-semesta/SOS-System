import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DevicePermitStudent, getVerificationUrl } from '../../services/devicePermitService';
import { LOGO_BASE64 } from '../../lib/constants';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  Download,
  Printer,
  AlertTriangle,
  XCircle,
  Wifi,
  Laptop,
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';

interface A7DeviceStickerProps {
  permit: DevicePermitStudent;
  showActions?: boolean;
}

export function A7DeviceSticker({
  permit,
  showActions = true,
}: A7DeviceStickerProps) {
  const stickerRef = useRef<HTMLDivElement>(null);
  const verifyUrl = getVerificationUrl(permit);

  const handleDownloadPNG = async () => {
    if (!stickerRef.current) return;
    try {
      toast.loading('Menyiapkan stiker A7 kualitas cetak...', { id: 'dl-sticker' });
      const dataUrl = await toPng(stickerRef.current, {
        pixelRatio: 3, // 300 DPI high-definition print quality
        cacheBust: true,
      });

      const link = document.createElement('a');
      link.download = `Stiker_A7_${permit.regNumber}_${permit.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Stiker A7 berhasil diunduh!', { id: 'dl-sticker' });
    } catch (err) {
      console.error('Error downloading sticker:', err);
      toast.error('Gagal mengunduh stiker. Silakan gunakan tombol cetak.', { id: 'dl-sticker' });
    }
  };

  const handlePrintSingle = () => {
    window.print();
  };

  const isSMP = permit.unit === 'SMP';
  const status = permit.status || 'APPROVED';

  // Status-based color scheme
  let statusBadgeBg = '#059669'; // Emerald for APPROVED
  let statusBadgeText = 'AUTHORIZED DEVICE';
  let statusIcon = <ShieldCheck className="w-2.5 h-2.5" />;

  if (status === 'REJECTED') {
    statusBadgeBg = '#b91c1c'; // Deep Red for REJECTED / Belum Ada Izin
    statusBadgeText = 'BELUM ADA IZIN / TIDAK BERIZIN';
    statusIcon = <XCircle className="w-2.5 h-2.5" />;
  } else if (status === 'DUE') {
    statusBadgeBg = '#d97706'; // Amber/Orange for DUE
    statusBadgeText = 'MASA IZIN HABIS (DUE)';
    statusIcon = <AlertTriangle className="w-2.5 h-2.5" />;
  }

  const themePrimary = isSMP ? '#312e81' : '#064e3b';
  const themeBorder = status === 'REJECTED' ? '#ef4444' : isSMP ? '#4f46e5' : '#059669';
  const themeLightBg = isSMP ? '#eef2ff' : '#ecfdf5';

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Actual A7 Sticker Element (105mm x 74mm in landscape) */}
      <div
        ref={stickerRef}
        className="sticker-card bg-white text-slate-900 rounded-xl overflow-hidden relative shadow-md border-2 border-slate-300 font-sans print:shadow-none print:border-slate-800"
        style={{
          width: '105mm',
          height: '74mm',
          minWidth: '105mm',
          minHeight: '74mm',
          boxSizing: 'border-box',
          padding: '2mm',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#ffffff',
          color: '#0f172a',
        }}
      >
        {/* Inner Security Border Frame */}
        <div
          className="w-full h-full rounded-lg p-2 flex flex-col justify-between relative overflow-hidden"
          style={{
            border: `1.5px solid ${themeBorder}`,
            backgroundColor: '#ffffff',
          }}
        >
          {/* Subtle Watermark in Background */}
          <div
            className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none select-none"
            style={{ transform: 'rotate(-15deg)' }}
          >
            <span className="text-4xl font-extrabold uppercase tracking-widest text-slate-900">
              SEMESTA SOS PERMIT
            </span>
          </div>

          {/* Top Header */}
          <div className="flex items-center justify-between pb-1 border-b border-slate-200">
            <div className="flex items-center gap-1.5">
              <img
                src={LOGO_BASE64}
                alt="Logo Semesta"
                className="w-6 h-6 object-contain shrink-0"
              />
              <div className="leading-tight">
                <div className="text-[7px] font-extrabold tracking-widest uppercase text-slate-500">
                  SEMESTA BILINGUAL BOARDING SCHOOL
                </div>
                <div className="text-[9.5px] font-black tracking-tight" style={{ color: themePrimary }}>
                  SEMESTA OLYMPIAD SQUAD (SOS)
                </div>
              </div>
            </div>

            {/* Official Badge Tag */}
            <div
              className="px-1.5 py-0.5 rounded text-[7.5px] font-extrabold uppercase tracking-wider text-white flex items-center gap-0.5 shrink-0 shadow-2xs"
              style={{ backgroundColor: statusBadgeBg }}
            >
              {statusIcon}
              <span>{statusBadgeText}</span>
            </div>
          </div>

          {/* Center Body: Student Name, Class, and Reg Number */}
          <div className="flex items-center justify-between gap-1.5 my-0.5">
            <div className="flex-1 min-w-0">
              <div className="text-[6.5px] font-bold text-slate-400 uppercase tracking-wider">
                Pemilik Perangkat Sah:
              </div>
              <div
                className="text-[11.5px] font-black uppercase tracking-tight truncate leading-tight text-slate-900"
                title={permit.name}
              >
                {permit.name}
              </div>

              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className="px-1 py-0.2 rounded text-[7.5px] font-bold"
                  style={{ backgroundColor: themeLightBg, color: themePrimary }}
                >
                  {permit.unit} Semesta
                </span>
                <span className="text-[7.5px] font-bold text-slate-700">
                  Kelas {permit.grade}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-[7.5px] font-bold text-slate-700">
                  OSN {permit.osnField}
                </span>
              </div>
            </div>

            {/* Registration Number with TA Code */}
            <div className="text-right shrink-0">
              <span className="text-[6px] text-slate-400 uppercase font-mono block">NO. REGISTRASI</span>
              <span className="text-[8.5px] font-mono font-black text-slate-900 bg-slate-100 px-1 py-0.5 rounded border border-slate-300">
                {permit.regNumber || permit.id}
              </span>
            </div>
          </div>

          {/* Device & IP Details Row */}
          <div className="flex items-center justify-between px-1.5 py-0.5 bg-slate-100/90 rounded border border-slate-200 text-[6.8px] font-semibold text-slate-800">
            <div className="flex items-center gap-1 truncate max-w-[65%]">
              <Laptop className="w-2.5 h-2.5 text-slate-600 shrink-0" />
              <span className="truncate">Device: <strong>{permit.deviceName || (status === 'APPROVED' ? 'Laptop / Tablet' : 'Belum Didaftarkan')}</strong></span>
            </div>
            <div className="flex items-center gap-1 shrink-0 font-mono text-slate-700">
              <Wifi className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
              <span>MAC/ID: <strong>{permit.deviceMac || permit.deviceIp || '-'}</strong></span>
            </div>
          </div>

          {/* Rules & Durasi Izin Grid + QR Code */}
          <div className="grid grid-cols-12 gap-1 items-center bg-slate-50/90 rounded-md p-1 border border-slate-200 my-0.5">
            {/* Left 8 cols: Allowed Hours & Apps */}
            <div className="col-span-8 space-y-0.2 text-[6.5px] leading-tight text-slate-700">
              <div className="flex items-center gap-1 text-[7px] font-bold text-slate-900">
                <Clock className="w-2 h-2 text-indigo-600 shrink-0" />
                <span>WAKTU PENGGUNAAN DIIZINKAN:</span>
              </div>
              <div className="grid grid-cols-1 gap-0.2 pl-2">
                <div>• EduOS: <strong>07.00 - 16.00</strong> | Sore: <strong>14.35 - 17.00</strong></div>
                <div>• Sesi Belajar Malam: <strong>19.30 - 21.30 WIB</strong></div>
              </div>
              <div className="text-[6.2px] text-slate-600 pt-0.5 border-t border-slate-200">
                <strong>Izin Akses:</strong> Google AI Studio, WA Web, Laptop/Tablet
              </div>
            </div>

            {/* Right 4 cols: QR Code & Verification Label */}
            <div className="col-span-4 flex flex-col items-center justify-center border-l border-slate-200 pl-1">
              <div className="p-0.5 bg-white rounded border border-slate-300 shadow-2xs">
                <QRCodeSVG
                  value={verifyUrl}
                  size={42}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <span className="text-[5px] font-bold text-slate-600 uppercase tracking-tighter mt-0.5 text-center leading-none">
                Scan Verifikasi
              </span>
            </div>
          </div>

          {/* CRITICAL WARNING NOTE: Report to SOS Coordinator if abused */}
          <div
            className="rounded px-1 py-0.5 text-[6px] font-bold leading-tight flex items-center gap-1 border"
            style={{
              backgroundColor: status === 'REJECTED' ? '#fee2e2' : status === 'DUE' ? '#fef3c7' : '#fef3c7',
              borderColor: status === 'REJECTED' ? '#fca5a5' : '#fcd34d',
              color: status === 'REJECTED' ? '#991b1b' : '#78350f',
            }}
          >
            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
            <span>
              {status === 'REJECTED'
                ? 'PERINGATAN: Siswa ini BELUM MEMILIKI izin resmi device. Laporkan ke Koordinator SOS jika ditemukan menggunakan device.'
                : status === 'DUE'
                ? 'PERINGATAN: Masa izin penggunaan device telah habis (DUE). Hubungi Koordinator SOS.'
                : 'Jika siswa ini menyalahgunakan izin, lapor ke Koordinator SOS / School Culture.'}
            </span>
          </div>

          {/* Bottom Security Footer */}
          <div className="flex items-center justify-between text-[6px] text-slate-500 font-medium pt-0.5">
            <div className="flex items-center gap-0.5">
              <CheckCircle2 className="w-2 h-2 text-emerald-600" />
              <span>Masa Berlaku: <strong>{permit.rules.validityPeriod}</strong></span>
            </div>
            <div className="text-right">
              Disetujui: Kepala Sekolah & Koordinator
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons (Download PNG, Print) */}
      {showActions && (
        <div className="flex items-center gap-2 print:hidden">
          <Button
            size="sm"
            onClick={handleDownloadPNG}
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Stiker A7 (PNG)</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handlePrintSingle}
            className="h-8 text-xs border-slate-300 hover:bg-slate-100 flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-slate-700" />
            <span>Cetak A7</span>
          </Button>
        </div>
      )}
    </div>
  );
}
