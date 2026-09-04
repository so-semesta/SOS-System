const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/GuidanceMonitor.tsx', 'utf8');

if (!code.includes('showAllLogs')) {
  // 1. Add state
  code = code.replace(
    "const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('ALL');",
    "const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('ALL');\n  const [showAllLogs, setShowAllLogs] = useState(false);\n  const [isLoadingMore, setIsLoadingMore] = useState(false);"
  );

  // 2. Update fetchData
  code = code.replace(
    /const fetchData = async \(\) => \{\n    try \{\n      const logsData = await getAllGuidanceLogs\(\);/,
    "const fetchData = async (fetchAll: boolean = false) => {\n    try {\n      const logsData = await getAllGuidanceLogs(fetchAll ? undefined : 300);"
  );

  // 3. Update useEffect
  code = code.replace(
    /useEffect\(\(\) => \{\n    fetchData\(\);\n  \}, \[\]\);/,
    "useEffect(() => {\n    fetchData(showAllLogs);\n  }, [showAllLogs]);"
  );
  
  // 4. Add load all button
  const loadAllButtonHtml = `
      <div className="flex justify-center mt-4">
        {!showAllLogs && (
          <Button 
            variant="outline" 
            onClick={() => {
              setIsLoadingMore(true);
              setShowAllLogs(true);
            }}
            disabled={isLoadingMore || loading}
          >
            {isLoadingMore ? 'Memuat Semua Data...' : 'Muat Semua Riwayat'}
          </Button>
        )}
      </div>
  `;
  
  // Put it before closing CardContent
  code = code.replace(
    /<\/Table>\n            <\/div>\n          <\/CardContent>/,
    "<\/Table>\n            <\/div>\n" + loadAllButtonHtml + "\n          <\/CardContent>"
  );
  
  fs.writeFileSync('src/pages/admin/GuidanceMonitor.tsx', code);
}
