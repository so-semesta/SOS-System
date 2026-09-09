const fs = require('fs');
let code = fs.readFileSync('src/pages/InternalHome.tsx', 'utf8');

code = code.replace(
  /<div className="bg-indigo-50\/50 p-6 rounded-xl border border-indigo-100">\n                <h3 className="font-bold text-xl text-indigo-900 mb-4">\{announcement\.title \|\| 'Informasi Silabus'\}<\/h3>\n                <div \n                  className="prose prose-sm max-w-none text-slate-700 prose-headings:text-indigo-900 prose-a:text-indigo-600"\n                  dangerouslySetInnerHTML=\{\{ __html: DOMPurify\.sanitize\(announcement\.content\) \}\}\n                \/>\n              <\/div>/,
  `{announcements.map((ann, idx) => (
                <div key={ann.id || idx} className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100 mb-4 last:mb-0">
                  <h3 className="font-bold text-xl text-indigo-900 mb-4">{ann.title || 'Informasi Silabus'}</h3>
                  <div 
                    className="prose prose-sm max-w-none text-slate-700 prose-headings:text-indigo-900 prose-a:text-indigo-600"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ann.content) }}
                  />
                </div>
              ))}`
);

fs.writeFileSync('src/pages/InternalHome.tsx', code);
