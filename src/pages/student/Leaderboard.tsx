import React, { useEffect, useState } from 'react';
import { getAllStudents } from '../../services/studentService';
import { getAllCompetitions, getAllRegistrations } from '../../services/competitionService';
import { calculateAchievementPoints } from '../../services/achievementService';
import { Student, Competition, Registration, MedalType } from '../../types';
import { Trophy, Medal, Award, Crown } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

interface LeaderboardEntry {
  student: Student;
  totalPoints: number;
  medals: {
    gold: number;
    silver: number;
    bronze: number;
    hm: number;
    participation: number;
  };
}

export function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [students, competitions, registrations] = await Promise.all([
          getAllStudents(),
          getAllCompetitions(),
          getAllRegistrations(),
        ]);

        const pointsMap: Record<string, number> = {};
        const medalsMap: Record<string, { gold: number; silver: number; bronze: number; hm: number; participation: number }> = {};
        
        registrations.forEach(reg => {
          if (!pointsMap[reg.studentId]) pointsMap[reg.studentId] = 0;
          if (!medalsMap[reg.studentId]) medalsMap[reg.studentId] = { gold: 0, silver: 0, bronze: 0, hm: 0, participation: 0 };
          
          if (reg.finalResult) {
             const comp = competitions.find(c => c.id === reg.competitionId);
             if (comp) {
               pointsMap[reg.studentId] += calculateAchievementPoints(comp.curationColor, reg.finalResult);
             }

             if (reg.finalResult === MedalType.GOLD) medalsMap[reg.studentId].gold += 1;
             else if (reg.finalResult === MedalType.SILVER) medalsMap[reg.studentId].silver += 1;
             else if (reg.finalResult === MedalType.BRONZE) medalsMap[reg.studentId].bronze += 1;
             else if (reg.finalResult === MedalType.FINALS) medalsMap[reg.studentId].hm += 1;
             else if (reg.finalResult === MedalType.PARTICIPANT) medalsMap[reg.studentId].participation += 1;
          }
        });

        const leaderboardData: LeaderboardEntry[] = students
          .map(student => ({
            student,
            totalPoints: pointsMap[student.userId] || 0,
            medals: medalsMap[student.userId] || { gold: 0, silver: 0, bronze: 0, hm: 0, participation: 0 },
          }))
          .filter(entry => entry.totalPoints > 0);

        // Sort descending
        leaderboardData.sort((a, b) => b.totalPoints - a.totalPoints);

        setLeaderboard(leaderboardData);
      } catch (error) {
        console.error("Failed to load leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="py-12 flex justify-center text-muted-foreground">Memuat Leaderboard...</div>;
  }

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="space-y-12">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Leaderboard Prestasi</h1>
        <p className="text-muted-foreground text-lg">Peringkat peringkat siswa berdasarkan perolehan kejuaraan tahun ini.</p>
      </div>

      {leaderboard.length > 0 ? (
        <>
          {/* Podium for Top 3 */}
          <div className="flex flex-col md:flex-row items-end justify-center gap-6 pt-10">
            {/* Rank 2 */}
            {top3[1] && (
              <div className="flex flex-col items-center flex-1 max-w-[200px]">
                <div className="bg-slate-100 rounded-full w-20 h-20 flex items-center justify-center mb-4 shadow-sm border-2 border-slate-200 z-10">
                  <Medal className="w-10 h-10 text-slate-400" />
                </div>
                <div className="text-center mb-2">
                  <p className="font-bold line-clamp-1">{top3[1].student.fullName}</p>
                  <p className="text-sm font-semibold text-muted-foreground">{top3[1].totalPoints} Pts</p>
                </div>
                <div className="w-full bg-slate-200 h-32 rounded-t-lg flex justify-center">
                  <span className="text-slate-400 font-bold text-4xl mt-4">2</span>
                </div>
              </div>
            )}

            {/* Rank 1 */}
            {top3[0] && (
              <div className="flex flex-col items-center flex-1 max-w-[200px]">
                <div className="relative">
                  <Crown className="w-10 h-10 text-yellow-500 absolute -top-8 left-1/2 -translate-x-1/2 -rotate-12" />
                  <div className="bg-yellow-50 rounded-full w-24 h-24 flex items-center justify-center mb-4 shadow-md border-2 border-yellow-300 z-10">
                    <Trophy className="w-12 h-12 text-yellow-500" />
                  </div>
                </div>
                <div className="text-center mb-2">
                  <p className="font-bold text-lg line-clamp-1">{top3[0].student.fullName}</p>
                  <p className="text-sm font-bold text-yellow-600">{top3[0].totalPoints} Pts</p>
                </div>
                <div className="w-full bg-yellow-100 h-40 rounded-t-lg flex justify-center border-t-4 border-yellow-300">
                  <span className="text-yellow-600 font-bold text-5xl mt-4">1</span>
                </div>
              </div>
            )}

            {/* Rank 3 */}
            {top3[2] && (
              <div className="flex flex-col items-center flex-1 max-w-[200px]">
                <div className="bg-orange-50 rounded-full w-20 h-20 flex items-center justify-center mb-4 shadow-sm border-2 border-orange-200 z-10">
                  <Award className="w-10 h-10 text-orange-400" />
                </div>
                <div className="text-center mb-2">
                  <p className="font-bold line-clamp-1">{top3[2].student.fullName}</p>
                  <p className="text-sm font-semibold text-muted-foreground">{top3[2].totalPoints} Pts</p>
                </div>
                <div className="w-full bg-orange-100 h-24 rounded-t-lg flex justify-center">
                  <span className="text-orange-400 font-bold text-4xl mt-4">3</span>
                </div>
              </div>
            )}
          </div>

          {/* Table for All Leaderboard Entries */}
          {leaderboard.length > 0 && (
            <Card className="max-w-6xl mx-auto mt-12">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-20 text-center">Peringkat</TableHead>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead className="text-center">Emas</TableHead>
                      <TableHead className="text-center">Perak</TableHead>
                      <TableHead className="text-center">Perunggu</TableHead>
                      <TableHead className="text-center">Honorable Mention</TableHead>
                      <TableHead className="text-center">Partisipasi Lomba</TableHead>
                      <TableHead className="text-right">Total Poin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((entry, index) => (
                      <TableRow key={entry.student.id}>
                        <TableCell className="text-center font-semibold text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium">{entry.student.fullName}</TableCell>
                        <TableCell className="text-center font-semibold text-yellow-600">{entry.medals.gold}</TableCell>
                        <TableCell className="text-center font-semibold text-slate-400">{entry.medals.silver}</TableCell>
                        <TableCell className="text-center font-semibold text-orange-600">{entry.medals.bronze}</TableCell>
                        <TableCell className="text-center font-semibold text-blue-600">{entry.medals.hm}</TableCell>
                        <TableCell className="text-center font-semibold text-green-600">{entry.medals.participation}</TableCell>
                        <TableCell className="text-right font-bold text-lg">{entry.totalPoints}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          Belum ada data prestasi.
        </div>
      )}
    </div>
  );
}
