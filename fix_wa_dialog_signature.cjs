const fs = require('fs');
let code = fs.readFileSync('src/pages/student/Competitions.tsx', 'utf8');

code = code.replace(
  /const \[waDialogData, setWaDialogData\] = useState<\{ roundName: string, roundDate: string, compTitle: string \} | null>\(null\);/g,
  `const [waDialogData, setWaDialogData] = useState<{ roundName: string, roundDate: string | number, compTitle: string } | null>(null);`
);

code = code.replace(
  /const handleOpenWaDialog = \(roundName: string, roundDate: string, compTitle: string\) => \{/g,
  `const handleOpenWaDialog = (roundName: string, roundDate: string | number, compTitle: string) => {`
);

fs.writeFileSync('src/pages/student/Competitions.tsx', code);
