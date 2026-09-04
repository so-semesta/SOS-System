const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/GuidanceMonitor.tsx', 'utf8');

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

code = code.replace(
  /<\/div>\n      <ConfirmDeleteDialog/,
  "<\/div>\n" + loadAllButtonHtml + "\n      <ConfirmDeleteDialog"
);

fs.writeFileSync('src/pages/admin/GuidanceMonitor.tsx', code);
