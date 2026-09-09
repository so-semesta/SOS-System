const fs = require('fs');
let code = fs.readFileSync('src/pages/student/Competitions.tsx', 'utf8');

code = code.replace(
  /'Ruangan Lomba': false,\n      'Webcam': false,\n      'Tripod': false,\n    \}\);/g,
  `'Ruangan Lomba': false,
      'Webcam': false,
      'Tripod': false,
      'Lainnya': false,
    });`
);

fs.writeFileSync('src/pages/student/Competitions.tsx', code);
