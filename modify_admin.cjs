const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/CompetitionsAdmin.tsx', 'utf8');

// 1. Update imports
code = code.replace(
  "import { getAllCompetitions, deleteCompetition, archiveOldCompetitions } from '../../services/competitionService';",
  "import { getAllCompetitions, deleteCompetition, archiveCompetition, unarchiveCompetition, getAllArchivedCompetitions } from '../../services/competitionService';"
);
code = code.replace(
  "import { Pencil, Trash2, AlertTriangle, Download, Archive } from 'lucide-react';",
  "import { Pencil, Trash2, AlertTriangle, Download, Archive, ArchiveRestore } from 'lucide-react';"
);
if (!code.includes('import { Tabs, TabsList, TabsTrigger, TabsContent } from')) {
    code = code.replace(
      "import { ConfirmDeleteDialog } from '../../components/ui/ConfirmDeleteDialog';",
      "import { ConfirmDeleteDialog } from '../../components/ui/ConfirmDeleteDialog';\nimport { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';"
    );
}

// 2. Add activeTab and archivedCompetitions state
code = code.replace(
  "const [clashFilter, setClashFilter] = useState<string>('all');",
  "const [clashFilter, setClashFilter] = useState<string>('all');\n  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');\n  const [archivedCompetitions, setArchivedCompetitions] = useState<Competition[]>([]);"
);

// 3. Update loadData
code = code.replace(
  /const loadData = async \(\) => \{\n    try \{\n      setLoading\(true\);\n      const data = await getAllCompetitions\(\);\n      setCompetitions\(data\);\n    \} catch \(error\) \{\n      toast.error\('Gagal memuat daftar perlombaan'\);\n    \} finally \{\n      setLoading\(false\);\n    \}\n  \};/g,
  `const loadData = async () => {
    try {
      setLoading(true);
      const data = await getAllCompetitions();
      const archivedData = await getAllArchivedCompetitions();
      setCompetitions(data);
      setArchivedCompetitions(archivedData);
    } catch (error) {
      toast.error('Gagal memuat daftar perlombaan');
    } finally {
      setLoading(false);
    }
  };`
);

// 4. Update handleArchive -> handleArchiveRow and add handleUnarchiveRow
code = code.replace(
  /const handleArchive = async \(\) => \{\n    if \(\!window.confirm\('Yakin ingin mengarsipkan lomba yang sudah lewat 3 bulan \(kecuali GOLD\)\?'\)\) return;\n    setIsArchiving\(true\);\n    try \{\n      const count = await archiveOldCompetitions\(\);\n      toast.success\(`\$\{count\} lomba berhasil diarsipkan`\);\n      if \(count > 0\) loadData\(\);\n    \} catch \(err: any\) \{\n      toast.error\(`Gagal mengarsipkan: \$\{err.message\}`\);\n    \} finally \{\n      setIsArchiving\(false\);\n    \}\n  \};/g,
  `const handleArchiveRow = async (id: string) => {
    if (!window.confirm('Yakin ingin mengarsipkan lomba ini?')) return;
    try {
      await archiveCompetition(id);
      toast.success('Lomba berhasil diarsipkan');
      loadData();
    } catch (err: any) {
      toast.error('Gagal mengarsipkan: ' + err.message);
    }
  };

  const handleUnarchiveRow = async (id: string) => {
    if (!window.confirm('Yakin ingin mengembalikan lomba ini dari arsip?')) return;
    try {
      await unarchiveCompetition(id);
      toast.success('Lomba berhasil dikembalikan');
      loadData();
    } catch (err: any) {
      toast.error('Gagal mengembalikan: ' + err.message);
    }
  };`
);

// 5. Replace batch archive button with nothing (removed)
code = code.replace(
  /<Button variant="outline" size="sm" onClick=\{handleArchive\} disabled=\{isArchiving\} className="text-orange-600 border-orange-200 hover:bg-orange-50">\n              <Archive className="w-4 h-4 mr-2" \/> \{isArchiving \? 'Mengarsipkan\.\.\.' : 'Arsipkan Lomba Lama'\}\n            <\/Button>/g,
  ""
);

// 6. Wrap table with Tabs
const tableStartIdx = code.indexOf('<div className="rounded-md border bg-card">');
const tableEndIdx = code.indexOf('</div>\n      </div>', tableStartIdx) + 6; // +6 for </div>

let tableHtml = code.substring(tableStartIdx, tableEndIdx);
const rowRegex = /<TableRow key=\{c\.id\}>([\s\S]*?)<\/TableRow>/g;
let originalRowTemplate = rowRegex.exec(tableHtml)[0];

const newTableHtml = `
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
          <TabsList className="mb-4">
            <TabsTrigger value="active">Lomba Aktif</TabsTrigger>
            <TabsTrigger value="archived">Arsip Lomba</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active">
            ${tableHtml.replace(
              /<Button variant="ghost" size="icon" onClick=\{\(\) => setEditingComp\(c\)\}>\n                          <Pencil className="w-4 h-4 text-blue-500" \/>\n                        <\/Button>\n                        <Button variant="ghost" size="icon" onClick=\{\(\) => triggerDelete\(c\.id\)\}>\n                          <Trash2 className="w-4 h-4 text-red-500" \/>\n                        <\/Button>/g,
              `<Button title="Arsipkan" variant="ghost" size="icon" onClick={() => handleArchiveRow(c.id)}>
                          <Archive className="w-4 h-4 text-orange-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditingComp(c)}>
                          <Pencil className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => triggerDelete(c.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>`
            )}
          </TabsContent>
          
          <TabsContent value="archived">
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Lomba</TableHead>
                    <TableHead>Bidang</TableHead>
                    <TableHead>Tingkat</TableHead>
                    <TableHead>Deadline Pendaftaran</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center h-24">Memuat...</TableCell></TableRow>
                  ) : archivedCompetitions.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center h-24">Belum ada lomba diarsipkan</TableCell></TableRow>
                  ) : (
                    archivedCompetitions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.title}</TableCell>
                        <TableCell>{Array.isArray(c.field) ? c.field.join(', ') : c.field}</TableCell>
                        <TableCell>{c.type}</TableCell>
                        <TableCell>{new Date(c.registrationDeadline).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell>
                          <Badge variant={c.status === CompetitionStatus.OPEN ? 'default' : 'secondary'}>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {c.isApproved !== false ? (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Approved</Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button title="Kembalikan Lomba" variant="ghost" size="icon" onClick={() => handleUnarchiveRow(c.id)}>
                              <ArchiveRestore className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => triggerDelete(c.id)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
`;

code = code.substring(0, tableStartIdx) + newTableHtml + code.substring(tableEndIdx);

fs.writeFileSync('src/pages/admin/CompetitionsAdmin.tsx', code);
