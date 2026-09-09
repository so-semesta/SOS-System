const fs = require('fs');
let code = fs.readFileSync('src/pages/InternalHome.tsx', 'utf8');

code = code.replace(/getOsnAnnouncement/g, 'getOsnAnnouncements');
code = code.replace(
  /const \[announcement, setAnnouncement\] = useState<OsnAnnouncement \| null>\(null\);/,
  'const [announcements, setAnnouncements] = useState<OsnAnnouncement[]>([]);'
);
code = code.replace(
  /setAnnouncement\(ann\);/,
  'setAnnouncements(ann);'
);
code = code.replace(
  /\} else if \(!announcement\) \{/,
  '} else if (announcements.length === 0) {'
);
code = code.replace(
  /\) : announcement \? \(/,
  ') : announcements.length > 0 ? ('
);
code = code.replace(
  /<h3 className="font-bold text-xl text-indigo-900 mb-4">\{announcement.title \|\| 'Informasi Silabus'\}<\/h3>\n                <div \n                  className="prose prose-sm max-w-none prose-slate"\n                  dangerouslySetInnerHTML=\{\{ __html: DOMPurify.sanitize\(announcement.content\) \}\}\n                \/>/,
  `{announcements.map((ann, idx) => (
                  <div key={ann.id || idx} className="mb-6 last:mb-0">
                    <h3 className="font-bold text-xl text-indigo-900 mb-2">{ann.title || 'Informasi Silabus'}</h3>
                    <div 
                      className="prose prose-sm max-w-none prose-slate"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ann.content) }}
                    />
                  </div>
                ))}`
);

fs.writeFileSync('src/pages/InternalHome.tsx', code);
