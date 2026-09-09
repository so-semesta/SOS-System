const fs = require('fs');
let code = fs.readFileSync('src/pages/student/Competitions.tsx', 'utf8');

const targetStr = `                            <div>
                              <span className="font-medium block">{rc.roundName}</span>
                              {roundDate && !isNaN(new Date(roundDate).getTime()) && <span className="text-xs text-muted-foreground">{safeFormatDate(roundDate, { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
                            </div>
                            <Badge variant={rc.passed ? 'default' : 'secondary'}>
                              {rc.passed ? 'Lolos' : 'Belum Lolos'}
                            </Badge>`;

const newStr = `                            <div>
                              <span className="font-medium block">{rc.roundName}</span>
                              {roundDate && !isNaN(new Date(roundDate).getTime()) && <span className="text-xs text-muted-foreground">{safeFormatDate(roundDate, { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 w-7 p-0 rounded-full border-green-200 bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 hover:border-green-300" 
                                title="Chat Koordinator"
                                onClick={(e) => { e.stopPropagation(); handleOpenWaDialog(rc.roundName, roundDate || '', selectedMyReg.competitionTitle); }}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                              <Badge variant={rc.passed ? 'default' : 'secondary'}>
                                {rc.passed ? 'Lolos' : 'Belum Lolos'}
                              </Badge>
                            </div>`;

code = code.replace(targetStr, newStr);

// I should also ensure that 'Lainnya' is added to the initial state
fs.writeFileSync('src/pages/student/Competitions.tsx', code);
