const fs = require('fs');
let code = fs.readFileSync('src/pages/student/Competitions.tsx', 'utf8');

const stateHook = `  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const [waDialogOpen, setWaDialogOpen] = useState(false);
  const [waDialogData, setWaDialogData] = useState<{ roundName: string, roundDate: string, compTitle: string } | null>(null);
  const [waCoordinator, setWaCoordinator] = useState<'Putra' | 'Putri'>('Putra');
  const [waNeeds, setWaNeeds] = useState<Record<string, boolean>>({
    'Ruangan Lomba': false,
    'Webcam': false,
    'Tripod': false,
  });
  const [waOtherNeed, setWaOtherNeed] = useState('');`;

code = code.replace(/  const \[isAddDialogOpen, setIsAddDialogOpen\] = useState\(false\);/, stateHook);

const functionDef = `  const handleContactCoordinator = (e: React.MouseEvent, gender: 'Putra' | 'Putri', compName: string) => {`;

const newFunction = `  const handleOpenWaDialog = (roundName: string, roundDate: string, compTitle: string) => {
    setWaDialogData({ roundName, roundDate, compTitle });
    setWaDialogOpen(true);
    setWaNeeds({
      'Ruangan Lomba': false,
      'Webcam': false,
      'Tripod': false,
    });
    setWaOtherNeed('');
  };

  const handleSendWaNeeds = () => {
    if (!waDialogData) return;
    
    const phone = waCoordinator === 'Putra' ? '6285729660235' : '6281336869545';
    const title = waCoordinator === 'Putra' ? 'Mr' : 'Miss';
    const greeting = getGreeting();
    
    let introduction = "";
    if (studentData) {
      const fieldOrGrade = studentData.osnField || studentData.grade || '';
      introduction = \`\\nSaya \${studentData.fullName || userProfile?.name || ''}\${fieldOrGrade ? \` dari bidang/kelas \${fieldOrGrade}\` : ''}\`;
    } else if (userProfile?.name) {
      introduction = \`\\nSaya \${userProfile.name}\`;
    }

    const dateStr = waDialogData.roundDate && !isNaN(new Date(waDialogData.roundDate).getTime()) 
      ? safeFormatDate(waDialogData.roundDate, { day: 'numeric', month: 'long', year: 'numeric' })
      : waDialogData.roundDate;

    let message = \`Halo \${title}, \${greeting}.\${introduction} ingin mengonfirmasi bahwa pada tanggal \${dateStr} akan ada pelaksanaan \${waDialogData.roundName} untuk lomba \${waDialogData.compTitle}.\\n\\nUntuk kelancaran lomba, saya membutuhkan:\`;
    
    let hasNeeds = false;
    Object.entries(waNeeds).forEach(([need, isChecked]) => {
      if (isChecked) {
        message += \`\\n- \${need}\`;
        hasNeeds = true;
      }
    });
    
    if (waOtherNeed.trim()) {
      message += \`\\n- \${waOtherNeed.trim()}\`;
      hasNeeds = true;
    }
    
    if (!hasNeeds) {
      message += \`\\n- (Tidak ada kebutuhan alat/ruangan khusus)\`;
    }
    
    message += \`\\n\\nMohon bantuannya \${title}. Terima kasih!\`;
    
    window.open(\`https://wa.me/\${phone}?text=\${encodeURIComponent(message)}\`, '_blank');
    setWaDialogOpen(false);
  };

  const handleContactCoordinator = (e: React.MouseEvent, gender: 'Putra' | 'Putri', compName: string) => {`;

code = code.replace(functionDef, newFunction);

fs.writeFileSync('src/pages/student/Competitions.tsx', code);
