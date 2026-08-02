const fs = require('fs');

let content = fs.readFileSync('src/components/layout/TimerWidget.tsx', 'utf8');

// Add Maximize icon
if (!content.includes('Maximize')) {
    content = content.replace("from 'lucide-react';", "Maximize, Minimize } from 'lucide-react';");
}

// Add state
const stateCode = `  const [isFullscreen, setIsFullscreen] = useState(false);\n  const [targetBelajar, setTargetBelajar] = useState('');`;
if (!content.includes('isFullscreen')) {
    content = content.replace("const [isOpen, setIsOpen] = useState(false);", "const [isOpen, setIsOpen] = useState(false);\n" + stateCode);
}

// Fullscreen toggle logic
const renderCode = `
  if (userRole !== UserRole.STUDENT) {
    return null;
  }
`;

const updatedReturn = `
  return (
    <div className={\`\${isFullscreen ? 'fixed inset-0 z-[100] bg-slate-900 flex items-center justify-center p-4' : \`fixed bottom-6 right-6 z-50 flex flex-col items-end \${location.pathname === '/guidance' ? '' : 'hidden'}\`}\`}>
      {isOpen && !isFullscreen && (
        <Card className="mb-4 w-80 shadow-xl border-primary/20 animate-in slide-in-from-bottom-5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-slate-50/50 rounded-t-xl">
            <CardTitle className="text-sm font-medium flex items-center">
              <Timer className="mr-2 h-4 w-4 text-primary" />
              Alat Fokus Siswa
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsFullscreen(true)}>
                <Maximize className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="mb-4">
              <Input placeholder="Target belajar saat ini..." value={targetBelajar} onChange={(e) => setTargetBelajar(e.target.value)} className="text-sm h-8" />
            </div>
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
                <div className={\`text-5xl font-mono text-center font-bold tracking-tight py-4 \${pmTime === 0 ? 'text-red-500 animate-pulse' : 'text-slate-800'}\`}>
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

      {isFullscreen && (
        <div className="w-full max-w-4xl bg-slate-900 rounded-3xl p-8 sm:p-16 flex flex-col items-center justify-center relative shadow-2xl border border-slate-700 animate-in zoom-in-95">
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 h-12 w-12 text-slate-400 hover:text-white hover:bg-slate-800" onClick={() => setIsFullscreen(false)}>
            <Minimize className="h-6 w-6" />
          </Button>
          
          <div className="w-full max-w-2xl mb-12">
             <Input 
               placeholder="Target belajar saat ini (klik untuk edit)..." 
               value={targetBelajar} 
               onChange={(e) => setTargetBelajar(e.target.value)} 
               className="text-center text-xl sm:text-2xl h-16 bg-transparent border-none text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b focus-visible:border-slate-500 rounded-none shadow-none" 
             />
          </div>

          <Tabs defaultValue="stopwatch" className="w-full max-w-lg">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-slate-800 text-slate-400 h-14 rounded-xl">
              <TabsTrigger value="stopwatch" className="text-lg data-[state=active]:bg-slate-700 data-[state=active]:text-white rounded-lg">Stopwatch</TabsTrigger>
              <TabsTrigger value="pomodoro" className="text-lg data-[state=active]:bg-slate-700 data-[state=active]:text-white rounded-lg">Pomodoro</TabsTrigger>
            </TabsList>
            
            <TabsContent value="stopwatch" className="space-y-12">
              <div className="text-[6rem] sm:text-[8rem] leading-none font-mono text-center font-bold tracking-tighter text-white py-6">
                {formatTime(swTime)}
              </div>
              <div className="flex justify-center space-x-6">
                <Button size="lg" className="h-16 px-8 text-xl rounded-2xl" variant={swIsRunning ? "outline" : "default"} onClick={() => setSwIsRunning(!swIsRunning)}>
                  {swIsRunning ? <Pause className="h-6 w-6 mr-3" /> : <Play className="h-6 w-6 mr-3" />}
                  {swIsRunning ? 'Pause' : 'Mulai Fokus'}
                </Button>
                <Button size="lg" className="h-16 px-8 text-xl rounded-2xl bg-slate-800 text-white hover:bg-slate-700" variant="secondary" onClick={() => { setSwIsRunning(false); setSwTime(0); }}>
                  <RotateCcw className="h-6 w-6 mr-3" />
                  Reset
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="pomodoro" className="space-y-8 flex flex-col items-center w-full">
              <div className="flex items-center space-x-3 mb-2 justify-center w-full">
                <Input 
                   type="number" 
                   value={pmCustomMinutes} 
                   onChange={(e) => {
                    setPmCustomMinutes(e.target.value);
                    if (!pmIsRunning) setPmTime((parseInt(e.target.value) || 0) * 60);
                  }}
                  className="w-24 h-12 text-center text-xl bg-slate-800 border-slate-700 text-white"
                  min="1"
                  disabled={pmIsRunning}
                />
                <span className="text-xl text-slate-400">Menit</span>
              </div>
              <div className={\`text-[6rem] sm:text-[8rem] leading-none font-mono text-center font-bold tracking-tighter py-6 \${pmTime === 0 ? 'text-red-500 animate-pulse' : 'text-white'}\`}>
                {formatTime(pmTime)}
              </div>
              <div className="flex justify-center space-x-6 w-full">
                <Button size="lg" className="h-16 px-8 text-xl rounded-2xl flex-1 max-w-[200px]" variant={pmIsRunning ? "outline" : "default"} onClick={() => pmIsRunning ? setPmIsRunning(false) : handlePmStart()}>
                  {pmIsRunning ? <Pause className="h-6 w-6 mr-3" /> : <Play className="h-6 w-6 mr-3" />}
                  {pmIsRunning ? 'Pause' : 'Mulai Fokus'}
                </Button>
                <Button size="lg" className="h-16 px-8 text-xl rounded-2xl bg-slate-800 text-white hover:bg-slate-700 flex-1 max-w-[200px]" variant="secondary" onClick={handlePmReset}>
                  <RotateCcw className="h-6 w-6 mr-3" />
                  Reset
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
      
      {!isFullscreen && (
        <Button 
          size="icon" 
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Clock className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
`;

const startIndex = content.indexOf('  return (');
if (startIndex !== -1) {
    content = content.substring(0, startIndex) + updatedReturn;
    fs.writeFileSync('src/components/layout/TimerWidget.tsx', content);
}
