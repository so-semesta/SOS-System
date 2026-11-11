import { getAllCompetitions } from './competitionService';
import { Competition, CompetitionRound } from '../types';

export interface WeeklyAgendaItem {
  id: string;
  type: 'DEADLINE' | 'ROUND' | 'TARGET';
  title: string;
  competitionTitle?: string;
  date: number;
  formattedDate: string;
  badge: string;
  badgeColor: string;
  description?: string;
}

export interface WeeklyAgendaSummary {
  weekLabel: string;
  startDate: Date;
  endDate: Date;
  deadlines: WeeklyAgendaItem[];
  rounds: WeeklyAgendaItem[];
  allEvents: WeeklyAgendaItem[];
  emailText: string;
  waText: string;
}

const INDONESIAN_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const formatIndonesianDate = (timestamp: number | Date, includeDay: boolean = true): string => {
  const d = new Date(timestamp);
  const dayName = INDONESIAN_DAYS[d.getDay()];
  const dateNum = d.getDate();
  const monthName = INDONESIAN_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  if (includeDay) {
    return `${dayName}, ${dateNum} ${monthName} ${year}`;
  }
  return `${dateNum} ${monthName} ${year}`;
};

export const getWeeklyAgenda = async (): Promise<WeeklyAgendaSummary> => {
  const now = new Date();
  
  // Calculate start of current week (Monday) and end of week (Sunday)
  const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() + distanceToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // Also include events in the next 7 days from today as upcoming priority
  const next7DaysEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  next7DaysEnd.setHours(23, 59, 59, 999);

  const weekLabel = `${startOfWeek.getDate()} ${INDONESIAN_MONTHS[startOfWeek.getMonth()]} - ${endOfWeek.getDate()} ${INDONESIAN_MONTHS[endOfWeek.getMonth()]} ${endOfWeek.getFullYear()}`;

  let competitions: Competition[] = [];
  try {
    competitions = await getAllCompetitions();
  } catch (err) {
    console.error('Error fetching competitions for agenda:', err);
  }

  const deadlines: WeeklyAgendaItem[] = [];
  const rounds: WeeklyAgendaItem[] = [];

  competitions.forEach(comp => {
    // Check registration deadline
    if (comp.registrationDeadline) {
      const dl = comp.registrationDeadline;
      if (dl >= startOfWeek.getTime() && dl <= next7DaysEnd.getTime()) {
        deadlines.push({
          id: `dl_${comp.id}`,
          type: 'DEADLINE',
          title: `Batas Pendaftaran: ${comp.title}`,
          competitionTitle: comp.title,
          date: dl,
          formattedDate: formatIndonesianDate(dl),
          badge: 'Deadline Pendaftaran',
          badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
          description: comp.type ? `Jenis: ${comp.type} | Bidang: ${comp.field?.join(', ') || 'Semua'}` : undefined
        });
      }
    }

    // Check rounds scheduled this week
    if (Array.isArray(comp.rounds)) {
      comp.rounds.forEach((round: CompetitionRound, idx: number) => {
        if (round.date && round.date >= startOfWeek.getTime() && round.date <= next7DaysEnd.getTime()) {
          rounds.push({
            id: `rnd_${comp.id}_${idx}`,
            type: 'ROUND',
            title: `${round.name} - ${comp.title}`,
            competitionTitle: comp.title,
            date: round.date,
            formattedDate: formatIndonesianDate(round.date),
            badge: 'Babak Kompetisi',
            badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
            description: `Pelaksanaan babak ${round.name}`
          });
        }
      });
    }
  });

  // Sort chronologically
  deadlines.sort((a, b) => a.date - b.date);
  rounds.sort((a, b) => a.date - b.date);

  const allEvents = [...deadlines, ...rounds].sort((a, b) => a.date - b.date);

  // Build formatted text for Email
  let emailText = `AGENDA & PERLOMBAAN PEKAN INI (${weekLabel}):\n`;
  if (allEvents.length === 0) {
    emailText += `- Fokus Pembinaan Rutin & Pemantapan Materi OSN harian.\n- Tidak ada deadline pendaftaran mendesak pekan ini.\n`;
  } else {
    if (deadlines.length > 0) {
      emailText += `\n📌 Batas Pendaftaran Lomba:\n`;
      deadlines.forEach((item, i) => {
        emailText += `  ${i + 1}. ${item.competitionTitle} (${item.formattedDate})\n`;
      });
    }
    if (rounds.length > 0) {
      emailText += `\n🏆 Jadwal Pelaksanaan / Babak Lomba:\n`;
      rounds.forEach((item, i) => {
        emailText += `  ${i + 1}. ${item.title} (${item.formattedDate})\n`;
      });
    }
  }

  // Build formatted text for WhatsApp
  let waText = `*AGENDA & PERLOMBAAN PEKAN INI* (${weekLabel})\n`;
  if (allEvents.length === 0) {
    waText += `• Fokus Pembinaan Rutin & Pemantapan Materi OSN harian.\n`;
  } else {
    if (deadlines.length > 0) {
      waText += `\n*📌 Deadline Pendaftaran:*\n`;
      deadlines.forEach((item, i) => {
        waText += `${i + 1}. *${item.competitionTitle}* - ${item.formattedDate}\n`;
      });
    }
    if (rounds.length > 0) {
      waText += `\n*🏆 Jadwal Babak / Kompetisi:*\n`;
      rounds.forEach((item, i) => {
        waText += `${i + 1}. *${item.title}* - ${item.formattedDate}\n`;
      });
    }
  }

  return {
    weekLabel,
    startDate: startOfWeek,
    endDate: endOfWeek,
    deadlines,
    rounds,
    allEvents,
    emailText,
    waText
  };
};
