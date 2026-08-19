import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Competition } from '../../../types';
import { differenceInDays, format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { X, Maximize, Minimize } from 'lucide-react';
import { Button } from '../../ui/button';

interface Props {
  competitions: Competition[];
  onClose: () => void;
}

export function FullscreenCompetitionDisplay({ competitions, onClose }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const activeCompetitions = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    return competitions
      .filter(c => {
        const deadline = new Date(c.registrationDeadline);
        deadline.setHours(0,0,0,0);
        return c.isApproved !== false && c.status === 'OPEN' && deadline.getTime() >= today.getTime();
      })
      .sort((a, b) => new Date(a.registrationDeadline).getTime() - new Date(b.registrationDeadline).getTime());
  }, [competitions]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Auto scroll logic
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let animationFrameId: number;
    let scrollTop = 0;
    
    const scroll = () => {
      scrollTop += 0.5; // Adjust speed here
      
      // If we've scrolled past the first half (which is the original content)
      if (scrollTop >= scrollContainer.scrollHeight / 2) {
        scrollTop = 0; // Reset to top for seamless loop
      }
      
      scrollContainer.scrollTop = scrollTop;
      animationFrameId = requestAnimationFrame(scroll);
    };

    animationFrameId = requestAnimationFrame(scroll);

    return () => cancelAnimationFrame(animationFrameId);
  }, [activeCompetitions.length]);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-slate-100 flex flex-col overflow-hidden"
    >
      {/* Floating Controls */}
      <div className="absolute top-6 right-6 z-[100] flex gap-3">
        <Button variant="secondary" onClick={toggleFullscreen} className="bg-white/90 backdrop-blur shadow-md hover:bg-white text-slate-800 font-semibold">
          {isFullscreen ? (
            <><Minimize className="h-5 w-5 mr-2" /> Keluar Layar Penuh</>
          ) : (
            <><Maximize className="h-5 w-5 mr-2" /> Layar Penuh</>
          )}
        </Button>
        <Button variant="destructive" onClick={onClose} className="shadow-md font-semibold">
          <X className="h-5 w-5 mr-2" /> Kembali
        </Button>
      </div>

      <div className="bg-indigo-600 p-8 text-center shrink-0 shadow-md relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-2">INFO LOMBA TERKINI</h2>
        <p className="text-indigo-100 font-medium text-xl md:text-2xl">Olimpiade Sains Semesta (SOS)</p>
      </div>
      
      <div className="flex-1 overflow-hidden relative">
        <div 
          ref={scrollRef}
          className="h-full overflow-y-hidden"
        >
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Double the list for seamless scrolling */}
            {[...activeCompetitions, ...activeCompetitions].map((comp, idx) => {
              const realIdx = idx % activeCompetitions.length;
              const deadline = new Date(comp.registrationDeadline);
              deadline.setHours(0,0,0,0);
              const today = new Date();
              today.setHours(0,0,0,0);
              const daysLeft = differenceInDays(deadline, today);
              const formattedDate = format(deadline, 'dd MMM yyyy', { locale: localeId });
              
              return (
                <div key={`${comp.id}-${idx}`} className="flex gap-6 items-start p-6 bg-white rounded-2xl border border-slate-200 shadow-sm transition-transform hover:scale-[1.01]">
                  <div className="flex-shrink-0 w-16 h-16 bg-indigo-100 text-indigo-700 font-bold text-3xl rounded-full flex items-center justify-center mt-1">
                    {realIdx + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 text-2xl mb-2 leading-snug">{comp.title}</h3>
                    {comp.location && <p className="text-slate-600 text-lg mb-4 font-medium">Penyelenggara: {comp.location}</p>}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="bg-slate-100 text-slate-700 text-base px-4 py-2 rounded-lg font-semibold whitespace-nowrap">
                        Batas: {formattedDate}
                      </span>
                      <span className={`text-base px-4 py-2 rounded-lg font-bold whitespace-nowrap ${daysLeft <= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {daysLeft === 0 ? 'Hari ini terakhir!' : `${daysLeft} Hari lagi`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Gradient overlays for smooth fading */}
        <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-slate-100 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-100 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
