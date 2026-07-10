import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Clock, Play, Pause, RotateCcw, X, Timer } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth';
import { useLocation } from 'react-router-dom';

export function TimerWidget() {
  const { userRole } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  // Stopwatch State
  const [swTime, setSwTime] = useState(0);
  const [swIsRunning, setSwIsRunning] = useState(false);
  
  // Pomodoro State
  const [pmTime, setPmTime] = useState(25 * 60);
  const [pmCustomMinutes, setPmCustomMinutes] = useState('25');
  const [pmIsRunning, setPmIsRunning] = useState(false);
  
  useEffect(() => {
    let interval: any;
    if (swIsRunning) {
      interval = setInterval(() => setSwTime(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [swIsRunning]);

  useEffect(() => {
    let interval: any;
    if (pmIsRunning && pmTime > 0) {
      interval = setInterval(() => setPmTime(t => t - 1), 1000);
    } else if (pmTime === 0) {
      setPmIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [pmIsRunning, pmTime]);

  if (userRole !== UserRole.STUDENT) {
    return null;
  }

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handlePmStart = () => {
    if (!pmIsRunning && pmTime === 0) {
      setPmTime(parseInt(pmCustomMinutes) * 60 || 25 * 60);
    }
    setPmIsRunning(true);
  };

  const handlePmReset = () => {
    setPmIsRunning(false);
    setPmTime(parseInt(pmCustomMinutes) * 60 || 25 * 60);
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex flex-col items-end ${location.pathname === '/guidance' ? '' : 'hidden'}`}>
      {isOpen && (
        <Card className="mb-4 w-80 shadow-xl border-primary/20 animate-in slide-in-from-bottom-5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-slate-50/50 rounded-t-xl">
            <CardTitle className="text-sm font-medium flex items-center">
              <Timer className="mr-2 h-4 w-4 text-primary" />
              Alat Fokus Siswa
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            <Tabs defaultValue="stopwatch" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="stopwatch">Stopwatch</TabsTrigger>
                <TabsTrigger value="pomodoro">Pomodoro</TabsTrigger>
              </TabsList>
              
              <TabsContent value="stopwatch" className="space-y-4">
                <div className="text-5xl font-mono text-center font-bold tracking-tight text-slate-800 py-6">
                  {formatTime(swTime)}
                </div>
                <div className="flex justify-center space-x-2">
                  <Button variant={swIsRunning ? "outline" : "default"} onClick={() => setSwIsRunning(!swIsRunning)}>
                    {swIsRunning ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {swIsRunning ? 'Pause' : 'Start'}
                  </Button>
                  <Button variant="secondary" onClick={() => { setSwIsRunning(false); setSwTime(0); }}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="pomodoro" className="space-y-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Input 
                    type="number" 
                    value={pmCustomMinutes} 
                    onChange={(e) => {
                      setPmCustomMinutes(e.target.value);
                      if (!pmIsRunning) setPmTime((parseInt(e.target.value) || 0) * 60);
                    }}
                    className="w-20 h-8"
                    min="1"
                    disabled={pmIsRunning}
                  />
                  <span className="text-sm text-slate-500">Menit</span>
                </div>
                <div className={`text-5xl font-mono text-center font-bold tracking-tight py-4 ${pmTime === 0 ? 'text-red-500 animate-pulse' : 'text-slate-800'}`}>
                  {formatTime(pmTime)}
                </div>
                <div className="flex justify-center space-x-2">
                  <Button variant={pmIsRunning ? "outline" : "default"} onClick={() => pmIsRunning ? setPmIsRunning(false) : handlePmStart()}>
                    {pmIsRunning ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {pmIsRunning ? 'Pause' : 'Start'}
                  </Button>
                  <Button variant="secondary" onClick={handlePmReset}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
      
      <Button 
        size="icon" 
        className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Clock className="h-6 w-6" />
      </Button>
    </div>
  );
}
