const fs = require('fs');
let code = fs.readFileSync('src/pages/student/Competitions.tsx', 'utf8');

const waDialog = `
      {/* WA Dialog */}
      <Dialog open={waDialogOpen} onOpenChange={setWaDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Chat Koordinator Lomba</DialogTitle>
            <DialogDescription>
              Hubungi koordinator untuk konfirmasi kebutuhan lomba Anda.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Pilih Koordinator</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="koordinator" 
                    value="Putra" 
                    checked={waCoordinator === 'Putra'} 
                    onChange={() => setWaCoordinator('Putra')}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                  />
                  <span className="text-sm">Putra (Mr)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="koordinator" 
                    value="Putri" 
                    checked={waCoordinator === 'Putri'} 
                    onChange={() => setWaCoordinator('Putri')}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                  />
                  <span className="text-sm">Putri (Miss)</span>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Kebutuhan Lomba</label>
              <p className="text-xs text-muted-foreground mb-2">Pilih fasilitas yang Anda butuhkan (bisa lebih dari satu).</p>
              <div className="flex flex-col gap-2">
                {Object.keys(waNeeds).map((need) => (
                  <label key={need} className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={waNeeds[need]} 
                      onChange={(e) => setWaNeeds({...waNeeds, [need]: e.target.checked})}
                      className="h-4 w-4 rounded text-green-600 focus:ring-green-500 border-gray-300"
                    />
                    <span className="text-sm">{need}</span>
                  </label>
                ))}
              </div>
              {waNeeds['Lainnya'] && (
                <Input 
                  placeholder="Sebutkan kebutuhan lainnya..." 
                  value={waOtherNeed}
                  onChange={(e) => setWaOtherNeed(e.target.value)}
                  className="mt-2 text-sm"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWaDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSendWaNeeds} className="bg-[#25D366] hover:bg-[#1DA851] text-white gap-2">
              <MessageCircle className="h-4 w-4" /> Kirim WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
`;

code = code.replace(/    <\/div>\n  \);\n}\n\nfunction TrophyIcon/g, waDialog + '\nfunction TrophyIcon');

fs.writeFileSync('src/pages/student/Competitions.tsx', code);
