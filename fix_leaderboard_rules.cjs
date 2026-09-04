const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(
  /match \/students\/\{studentId\} \{\n      allow get: if isSignedIn\(\) && isValidId\(studentId\) && \(existing\(\).userId == request.auth.uid \|\| isAdmin\(\) \|\| isTeacher\(\)\);\n      \/\/ For list queries, the rule must explicitly filter by userId for non-admins\n      allow list: if isSignedIn\(\) && \(isAdmin\(\) \|\| isTeacher\(\) \|\| resource.data.userId == request.auth.uid\);/,
  `match /students/{studentId} {
      allow get: if isSignedIn() && isValidId(studentId);
      // RELAXED FOR LEADERBOARD: All logged-in users can list students.
      allow list: if isSignedIn();`
);

code = code.replace(
  /match \/registrations\/\{registrationId\} \{\n      allow get: if isSignedIn\(\) && isValidId\(registrationId\) && \(existing\(\).studentId == request.auth.uid \|\| isAdmin\(\) \|\| isTeacher\(\)\);\n      allow list: if isSignedIn\(\) && \(isAdmin\(\) \|\| isTeacher\(\) \|\| resource.data.studentId == request.auth.uid\);/,
  `match /registrations/{registrationId} {
      allow get: if isSignedIn() && isValidId(registrationId);
      // RELAXED FOR LEADERBOARD: All logged-in users can list registrations.
      allow list: if isSignedIn();`
);

fs.writeFileSync('firestore.rules', code);
