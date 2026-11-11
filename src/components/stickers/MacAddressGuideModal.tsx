import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Laptop,
  Smartphone,
  Tablet,
  Copy,
  Check,
  HelpCircle,
  AlertTriangle,
  Info,
  Terminal,
  Settings,
  Wifi,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

interface MacAddressGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type OsType = 'windows' | 'macos' | 'ios' | 'android' | 'chromebook' | 'faq';

export function MacAddressGuideModal({ open, onOpenChange }: MacAddressGuideModalProps) {
  const [activeTab, setActiveTab] = useState<OsType>('windows');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    toast.success(`Perintah "${text}" disalin ke clipboard!`);
    setTimeout(() => {
      setCopiedCmd(null);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-5 sm:p-6 rounded-t-2xl">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-400 text-amber-950 flex items-center gap-1">
              <HelpCircle className="w-3 h-3" />
              Tutorial Resmi SOS
            </span>
            <span className="text-xs text-indigo-200">Panduan Identitas Perangkat</span>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Cara Mengetahui MAC Address / ID Unik Device
          </DialogTitle>
          <p className="text-xs sm:text-sm text-indigo-200 mt-1 max-w-xl leading-relaxed">
            MAC Address (Physical Address) adalah 12 karakter alfanumerik unik (contoh: <code className="bg-white/20 px-1 py-0.5 rounded font-mono text-amber-300">00:1A:2B:3C:4D:5E</code>) yang membedakan laptop/tablet Anda dari perangkat siswa lain.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-3 bg-slate-100 dark:bg-slate-900 border-b overflow-x-auto text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('windows')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              activeTab === 'windows'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Windows (10/11)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('macos')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              activeTab === 'macos'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>MacBook (macOS)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ios')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              activeTab === 'ios'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>iPad / iPhone</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('android')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              activeTab === 'android'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android Tablet/HP</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chromebook')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              activeTab === 'chromebook'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Chromebook</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('faq')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              activeTab === 'faq'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Tips Wi-Fi Acak / Serial No</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 sm:p-6 space-y-4 text-xs">
          {/* WINDOWS TAB */}
          {activeTab === 'windows' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      Laptop Windows 10 & Windows 11
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Berlaku untuk merk Asus, Lenovo, HP, Acer, Dell, MSI, dll.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  OS: Windows
                </Badge>
              </div>

              {/* Metode 1 (Settings) */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border space-y-2">
                <div className="flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-400">
                  <Settings className="w-4 h-4" />
                  <span>Cara 1: Lewat Menu Pengaturan (Settings)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground leading-relaxed pl-1">
                  <li>
                    Tekan tombol <strong className="text-foreground">Windows + I</strong> di keyboard untuk membuka <strong className="text-foreground">Settings</strong>.
                  </li>
                  <li>
                    Pilih menu <strong className="text-foreground">Network & internet</strong> di panel sebelah kiri.
                  </li>
                  <li>
                    Klik menu <strong className="text-foreground">Wi-Fi</strong>, lalu klik pada nama jaringan Wi-Fi yang sedang terhubung atau klik <strong className="text-foreground">Hardware properties</strong>.
                  </li>
                  <li>
                    Gulir ke bagian bawah, cari baris bertuliskan <strong className="text-emerald-700 dark:text-emerald-400">Physical address (MAC)</strong>.
                  </li>
                  <li>
                    Salin 12 karakter tersebut, contoh: <code className="bg-muted px-1.5 py-0.5 rounded font-mono font-bold text-foreground">3C-52-82-A4-10-FE</code>.
                  </li>
                </ol>
              </div>

              {/* Metode 2 (CMD Cepat) */}
              <div className="p-4 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <Terminal className="w-4 h-4" />
                    <span>Cara 2: Paling Cepat via Command Prompt (CMD)</span>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px] border-emerald-500/40">
                    Rekomendasi Cepat
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Tekan <strong className="text-white">Win + R</strong>, ketik <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300 font-mono">cmd</code> lalu Enter. Ketik perintah berikut:
                </p>
                <div className="flex items-center justify-between p-2.5 bg-black/50 rounded-lg border border-slate-800 font-mono text-emerald-300">
                  <span>getmac</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard('getmac', 'getmac')}
                    className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
                  >
                    {copiedCmd === 'getmac' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="ml-1">{copiedCmd === 'getmac' ? 'Tersalin' : 'Salin'}</span>
                  </Button>
                </div>
                <p className="text-[10.5px] text-slate-400">
                  Atau jalankan <code className="text-amber-300">ipconfig /all</code> dan lihat baris <em>Physical Address</em> di bawah adapter <em>Wireless LAN Wi-Fi</em>.
                </p>
              </div>
            </div>
          )}

          {/* MACOS TAB */}
          {activeTab === 'macos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-center font-bold">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      Apple MacBook (macOS)
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      MacBook Air, MacBook Pro (macOS Sonoma, Ventura, Monterey).
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Apple macOS
                </Badge>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border space-y-2">
                <div className="flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-400">
                  <Settings className="w-4 h-4" />
                  <span>Langkah Cek di System Settings (macOS):</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-relaxed pl-1">
                  <li>
                    Klik logo <strong className="text-foreground">Apple ()</strong> di pojok kiri paling atas layar.
                  </li>
                  <li>
                    Pilih <strong className="text-foreground">System Settings</strong> (atau <em>System Preferences</em> di macOS lama).
                  </li>
                  <li>
                    Di bilah samping, klik <strong className="text-foreground">Network</strong> (Jaringan).
                  </li>
                  <li>
                    Pilih <strong className="text-foreground">Wi-Fi</strong>, lalu klik tombol <strong className="text-foreground">Details...</strong> (atau <em>Advanced</em>).
                  </li>
                  <li>
                    Pilih tab <strong className="text-foreground">Hardware</strong> di sebelah kiri/atas jendela.
                  </li>
                  <li>
                    Anda akan melihat baris <strong className="text-emerald-700 dark:text-emerald-400">MAC Address</strong> (format: <code className="bg-muted px-1.5 py-0.5 rounded font-mono font-bold text-foreground">a4:c3:f0:89:12:de</code>).
                  </li>
                </ol>
              </div>

              {/* Terminal Mac */}
              <div className="p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 flex items-center justify-between font-mono text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">Perintah Cepat via Terminal Mac:</span>
                  <span className="text-emerald-300">networksetup -getmacaddress en0</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard('networksetup -getmacaddress en0', 'terminal mac')}
                  className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  Salin
                </Button>
              </div>
            </div>
          )}

          {/* IOS / IPAD TAB */}
          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Tablet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      Apple iPad & iPhone (iPadOS / iOS)
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Digunakan oleh siswa dengan tablet belajar iPad.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  iPadOS / iOS
                </Badge>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border space-y-2">
                <div className="flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-400">
                  <Settings className="w-4 h-4" />
                  <span>Cara Melihat Wi-Fi Address (MAC) di iPad:</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-relaxed pl-1">
                  <li>
                    Buka aplikasi <strong className="text-foreground">Settings (Pengaturan)</strong> di iPad Anda.
                  </li>
                  <li>
                    Pilih menu <strong className="text-foreground">General (Umum)</strong>.
                  </li>
                  <li>
                    Ketuk <strong className="text-foreground">About (Mengenai)</strong> di bagian paling atas.
                  </li>
                  <li>
                    Gulir ke bawah dan cari baris <strong className="text-emerald-700 dark:text-emerald-400">Wi-Fi Address (Alamat Wi-Fi)</strong>.
                  </li>
                  <li>
                    Itulah MAC Address asli perangkat iPad Anda.
                  </li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-1">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>PENTING untuk iPad: Fitur "Private Wi-Fi Address"</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Apple secara default mengacak MAC Address saat terhubung ke Wi-Fi. Agar Wi-Fi sekolah mengenali iPad Anda:
                  Buka <strong>Settings &gt; Wi-Fi</strong> &gt; ketuk ikon biru <strong>(i)</strong> di sebelah nama Wi-Fi Semesta &gt; matikan pilihan <strong>Private Wi-Fi Address</strong> (Alamat Wi-Fi Pribadi).
                </p>
              </div>
            </div>
          )}

          {/* ANDROID TAB */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      Tablet & HP Android
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Samsung Galaxy Tab, Xiaomi Pad, Lenovo Tab, Oppo, Realme, dll.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Android OS
                </Badge>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border space-y-2">
                <div className="flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-400">
                  <Settings className="w-4 h-4" />
                  <span>Cara Mengetahui MAC Address di Android:</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-relaxed pl-1">
                  <li>
                    Buka menu <strong className="text-foreground">Pengaturan (Settings)</strong> perangkat.
                  </li>
                  <li>
                    Gulir ke paling bawah dan pilih <strong className="text-foreground">Tentang Tablet / Tentang Ponsel (About Tablet/Phone)</strong>.
                  </li>
                  <li>
                    Ketuk <strong className="text-foreground">Informasi Status (Status Information)</strong>.
                  </li>
                  <li>
                    Cari baris <strong className="text-emerald-700 dark:text-emerald-400">Alamat MAC Wi-Fi Ponsel (Phone Wi-Fi MAC Address)</strong>.
                  </li>
                  <li>
                    Salin 12 karakter MAC Address tersebut ke sistem/catatan guru.
                  </li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 space-y-1">
                <div className="flex items-center gap-2 font-bold text-blue-900">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span>Tips Tambahan di Wi-Fi Android:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-blue-800">
                  Buka Pengaturan &gt; Koneksi &gt; Wi-Fi &gt; ketuk roda gigi di samping Wi-Fi sekolah &gt; pilih <em>Tipe Alamat MAC</em> &gt; ubah dari <em>Acak (Randomized)</em> menjadi <strong>MAC Perangkat (Phone/Tablet MAC)</strong>.
                </p>
              </div>
            </div>
          )}

          {/* CHROMEBOOK TAB */}
          {activeTab === 'chromebook' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      Google Chromebook (ChromeOS)
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Laptop Chromebook sekolah / bantuan dinas.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  ChromeOS
                </Badge>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border space-y-2">
                <div className="flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-400">
                  <Settings className="w-4 h-4" />
                  <span>Langkah Cek di Chromebook:</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-relaxed pl-1">
                  <li>
                    Klik area <strong className="text-foreground">Jam / Tray Baterai</strong> di pojok kanan bawah layar.
                  </li>
                  <li>
                    Klik nama jaringan <strong className="text-foreground">Wi-Fi</strong> yang sedang aktif.
                  </li>
                  <li>
                    Klik ikon informasi <strong className="text-foreground">(i)</strong> di sebelah jaringan Wi-Fi tersebut.
                  </li>
                  <li>
                    Atau buka <strong className="text-foreground">Settings &gt; Network &gt; Wi-Fi</strong> lalu lihat pada tab <strong className="text-emerald-700 dark:text-emerald-400">Network / Hardware</strong>.
                  </li>
                  <li>
                    Salin baris <strong className="text-foreground">MAC Address</strong>.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* FAQ & ALTERNATIVE (SERIAL NUMBER) TAB */}
          {activeTab === 'faq' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      Alternatif: Gunakan Nomor Seri (Serial Number) Jika Sulit
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Solusi praktis jika siswa bingung atau fitur acak MAC aktif.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Alternatif Sah
                </Badge>
              </div>

              <div className="p-4 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 text-purple-950 dark:text-purple-200 space-y-2">
                <strong className="block text-xs font-bold text-purple-900 dark:text-purple-300">
                  💡 Apakah Boleh Menggunakan Serial Number atau ID Lain?
                </strong>
                <p className="text-[11.5px] leading-relaxed">
                  <strong>Boleh dan Sah!</strong> Kolom identitas ini bertujuan untuk memastikan bahwa stiker perizinan menempel pada perangkat fisik yang benar. Guru/Management dapat menginput salah satu dari identitas berikut:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border font-medium">
                    <span className="text-[10px] text-muted-foreground block uppercase font-bold">Opsi 1</span>
                    <strong className="text-indigo-600">MAC Address Fisik</strong>
                    <p className="text-[10.5px] text-muted-foreground mt-0.5">Contoh: <code className="font-mono">3C:52:82:A4:10:FE</code></p>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border font-medium">
                    <span className="text-[10px] text-muted-foreground block uppercase font-bold">Opsi 2</span>
                    <strong className="text-emerald-600">Nomor Seri Laptop (S/N)</strong>
                    <p className="text-[10.5px] text-muted-foreground mt-0.5">Ada di stiker bawah laptop / kardus</p>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border font-medium">
                    <span className="text-[10px] text-muted-foreground block uppercase font-bold">Opsi 3</span>
                    <strong className="text-amber-600">Dikosongi Terlebih Dahulu</strong>
                    <p className="text-[10.5px] text-muted-foreground mt-0.5">Stiker tetap sah bertuliskan nama &amp; no. registrasi</p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-xl border text-[11.5px] space-y-1">
                <strong className="font-semibold text-foreground block">Catatan untuk Guru &amp; Pembina:</strong>
                <p className="text-muted-foreground leading-relaxed">
                  Jika siswa belum mengetahui MAC Address perangkat saat stiker dicetak, kolom ini boleh dikosongkan (default menampilkan tanda strip <code className="font-mono">-</code>). Stiker A7 tetap sah digunakan selama nomor registrasi dan nama siswa sesuai dengan daftar resmi koordinator SOS.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            <span>Semesta Bilingual Boarding School • Olympiad Squad (SOS)</span>
          </span>
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4"
          >
            Mengerti &amp; Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
