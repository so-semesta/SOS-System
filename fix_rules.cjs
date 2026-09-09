const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

// The issue might be missing fields in isValidRegistration that Firestore requires matching exactly (Wait, we're not checking exact fields, just that those 3 exist and are typed). Let's see. 
// Ah! Wait... `(incoming().studentId == request.auth.uid && incoming().status == 'PENDING')`
// But we are passing `RegistrationStatus.PENDING` from typescript, which is literally 'PENDING'.
// Let's modify the create rule to ensure it's not failing because of some other property, or if `request.auth.uid` doesn't match? No, it should.
// Let's check `isAdmin()`. Admin requires querying `/users/uid`. This query might fail if they don't have a document in the users collection.
// BUT for a student, they evaluate the first part of the OR `incoming().studentId == request.auth.uid && incoming().status == 'PENDING'`.
// In Firestore rules, if `isAdmin()` fails because the user doc doesn't exist, does it short circuit or crash?
// Let's modify the create rule to swap the order so it doesn't crash: `isAdmin() || (incoming().studentId == request.auth.uid && incoming().status == 'PENDING')` and test.

code = code.replace(
  /allow create: if isSignedIn\(\) && isValidId\(registrationId\) && \n                       isValidRegistration\(incoming\(\)\) && \n                       \(\(incoming\(\)\.studentId == request\.auth\.uid && incoming\(\)\.status == 'PENDING'\) \|\| isAdmin\(\)\);/g,
  `allow create: if isSignedIn() && isValidId(registrationId) && 
                       isValidRegistration(incoming()) && 
                       (isAdmin() || (incoming().studentId == request.auth.uid && incoming().status == 'PENDING'));`
);

fs.writeFileSync('firestore.rules', code);
