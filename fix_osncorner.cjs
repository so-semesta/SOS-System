const fs = require('fs');
let code = fs.readFileSync('src/pages/OSNCorner.tsx', 'utf8');

// Replace imports
code = code.replace(
  /getOsnAnnouncement, updateOsnAnnouncement/,
  'getOsnAnnouncements, addOsnAnnouncement, updateOsnAnnouncement, deleteOsnAnnouncement'
);

// Replace state
code = code.replace(
  /const \[announcement, setAnnouncement\] = useState<OsnAnnouncement \| null>\(null\);/,
  'const [announcements, setAnnouncements] = useState<OsnAnnouncement[]>([]);'
);
code = code.replace(
  /const \[infoForm, setInfoForm\] = useState\(\{ title: '', content: '' \}\);/,
  'const [infoForm, setInfoForm] = useState<Partial<OsnAnnouncement>>({ title: \'\', content: \'\' });\n  const [editingInfoId, setEditingInfoId] = useState<string | null>(null);\n  const [deletingInfoId, setDeletingInfoId] = useState<string | null>(null);'
);

// Fetch data
code = code.replace(
  /const ann = await getOsnAnnouncement\(\);\n      if \(ann\) setAnnouncement\(ann\);/,
  'const anns = await getOsnAnnouncements();\n      setAnnouncements(anns);'
);

// Handlers
code = code.replace(
  /const handleOpenEditInfo = \(\) => \{\n    setInfoForm\(\{\n      title: announcement\?\.title \|\| 'Informasi Silabus',\n      content: announcement\?\.content \|\| ''\n    \}\);\n    setIsEditInfoOpen\(true\);\n  \};/,
  `const handleOpenAddInfo = () => {
    setEditingInfoId(null);
    setInfoForm({ title: '', content: '' });
    setIsEditInfoOpen(true);
  };
  
  const handleOpenEditInfo = (ann: OsnAnnouncement) => {
    setEditingInfoId(ann.id!);
    setInfoForm({ title: ann.title, content: ann.content });
    setIsEditInfoOpen(true);
  };`
);

code = code.replace(
  /const handleSaveInfo = async \(\) => \{\n    try \{\n      await updateOsnAnnouncement\(infoForm\);\n      setAnnouncement\(\{ \.\.\.announcement, \.\.\.infoForm \} as OsnAnnouncement\);\n      setIsEditInfoOpen\(false\);\n      toast\.success\('Informasi berhasil diperbarui'\);\n    \} catch \(error\) \{\n      toast\.error\('Gagal memperbarui informasi'\);\n    \}\n  \};/,
  `const handleSaveInfo = async () => {
    try {
      if (editingInfoId) {
        await updateOsnAnnouncement(editingInfoId, infoForm);
        setAnnouncements(prev => prev.map(a => a.id === editingInfoId ? { ...a, ...infoForm } as OsnAnnouncement : a));
        toast.success('Informasi berhasil diperbarui');
      } else {
        await addOsnAnnouncement(infoForm as Omit<OsnAnnouncement, 'id'>);
        const anns = await getOsnAnnouncements();
        setAnnouncements(anns);
        toast.success('Informasi berhasil ditambahkan');
      }
      setIsEditInfoOpen(false);
    } catch (error) {
      toast.error('Gagal menyimpan informasi');
    }
  };
  
  const confirmDeleteInfo = async () => {
    if (!deletingInfoId) return;
    setIsDeleting(true);
    try {
      await deleteOsnAnnouncement(deletingInfoId);
      setAnnouncements(prev => prev.filter(a => a.id !== deletingInfoId));
      toast.success('Informasi berhasil dihapus');
    } catch (error) {
      toast.error('Gagal menghapus informasi');
    } finally {
      setIsDeleting(false);
      setDeletingInfoId(null);
    }
  };`
);

// Update UI
code = code.replace(
  /<Card>\n            <CardHeader className="flex flex-row items-center justify-between space-y-0">\n              <div>\n                <CardTitle>\{announcement\?\.title \|\| 'Informasi Silabus'\}<\/CardTitle>\n                <CardDescription>Informasi penting dan panduan silabus OSN\.<\/CardDescription>\n              <\/div>\n              \{isManagement && \(\n                <Button variant="outline" size="sm" onClick=\{handleOpenEditInfo\}>\n                  <Pencil className="w-4 h-4 mr-2" \/>\n                  Edit Informasi\n                <\/Button>\n              \)\}\n            <\/CardHeader>\n            <CardContent>\n              <div \n                className="prose prose-sm max-w-none prose-slate"\n                dangerouslySetInnerHTML=\{\{ __html: announcement\?\.content \? DOMPurify\.sanitize\(announcement\.content\) : 'Belum ada informasi yang ditambahkan\.' \}\}\n              \/>\n            <\/CardContent>\n          <\/Card>/,
  `<div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Informasi Silabus</h2>
                <p className="text-muted-foreground text-sm">Informasi penting dan panduan silabus OSN.</p>
              </div>
              {isManagement && (
                <Button onClick={handleOpenAddInfo} size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Tambah Informasi
                </Button>
              )}
            </div>
            
            {announcements.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Belum ada informasi yang ditambahkan.
                </CardContent>
              </Card>
            ) : (
              announcements.map((ann) => (
                <Card key={ann.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg">{ann.title || 'Informasi'}</CardTitle>
                    {isManagement && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenEditInfo(ann)}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setDeletingInfoId(ann.id!)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="prose prose-sm max-w-none prose-slate mt-2"
                      dangerouslySetInnerHTML={{ __html: ann.content ? DOMPurify.sanitize(ann.content) : '' }}
                    />
                  </CardContent>
                </Card>
              ))
            )}
          </div>`
);

code = code.replace(
  /<DialogTitle>Edit Informasi OSN<\/DialogTitle>/,
  '<DialogTitle>{editingInfoId ? \'Edit Informasi OSN\' : \'Tambah Informasi OSN\'}</DialogTitle>'
);

code = code.replace(
  /value=\{infoForm\.title\} onChange=\{e => setInfoForm\(\{\.\.\.infoForm, title: e\.target\.value\}\)\}/,
  'value={infoForm.title || \'\'} onChange={e => setInfoForm({...infoForm, title: e.target.value})}'
);

code = code.replace(
  /value=\{infoForm\.content\} \n                  onChange=\{content => setInfoForm\(\{\.\.\.infoForm, content\}\)\}/,
  'value={infoForm.content || \'\'} \n                  onChange={content => setInfoForm({...infoForm, content})}'
);

code = code.replace(
  /<\/div>\n  \);/,
  `
      <ConfirmDeleteDialog
        isOpen={!!deletingInfoId}
        onClose={() => setDeletingInfoId(null)}
        onConfirm={confirmDeleteInfo}
        isLoading={isDeleting}
      />
    </div>
  );`
);


fs.writeFileSync('src/pages/OSNCorner.tsx', code);
