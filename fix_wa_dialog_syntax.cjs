const fs = require('fs');
let code = fs.readFileSync('src/pages/student/Competitions.tsx', 'utf8');

code = code.replace(
  /const \[selectedComp, setSelectedComp\] = useState<Competition \|const \[waDialogData, setWaDialogData\] = useState<\{ roundName: string, roundDate: string \| number, compTitle: string \} \| null>\(null\);/g,
  `const [selectedComp, setSelectedComp] = useState<Competition | null>(null);`
);

code = code.replace(
  /const \[conflictCompTitle, setConflictCompTitle\] = useState<string \|const \[waDialogData, setWaDialogData\] = useState<\{ roundName: string, roundDate: string \| number, compTitle: string \} \| null>\(null\);/g,
  `const [conflictCompTitle, setConflictCompTitle] = useState<string | null>(null);`
);

code = code.replace(
  /const \[studentData, setStudentData\] = useState<Student \|const \[waDialogData, setWaDialogData\] = useState<\{ roundName: string, roundDate: string \| number, compTitle: string \} \| null>\(null\);/g,
  `const [studentData, setStudentData] = useState<Student | null>(null);`
);

code = code.replace(
  /const \[selectedMyReg, setSelectedMyReg\] = useState<Registration \|const \[waDialogData, setWaDialogData\] = useState<\{ roundName: string, roundDate: string \| number, compTitle: string \} \| null>\(null\);/g,
  `const [selectedMyReg, setSelectedMyReg] = useState<Registration | null>(null);`
);

code = code.replace(
  /const \[waDialogData, setWaDialogData\] = useState<\{ roundName: string, roundDate: string \| number, compTitle: string \} \| null>\(null\);\|const \[waDialogData, setWaDialogData\] = useState<\{ roundName: string, roundDate: string \| number, compTitle: string \} \| null>\(null\);/g,
  `const [waDialogData, setWaDialogData] = useState<{ roundName: string, roundDate: string | number, compTitle: string } | null>(null);`
);


fs.writeFileSync('src/pages/student/Competitions.tsx', code);
