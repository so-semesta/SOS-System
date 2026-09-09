const fs = require('fs');
let code = fs.readFileSync('src/pages/student/Competitions.tsx', 'utf8');

const oldApply = `      await applyForCompetition(newRegId, {
        studentId: currentUser.uid,
        studentName: userProfile?.name || 'Siswa',
        competitionId: selectedComp.id,
        competitionTitle: selectedComp.title,
        status: RegistrationStatus.PENDING,
        isRegisteredDirectly,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });`;

const newApply = `      const newRegistration = {
        studentId: currentUser.uid,
        studentName: userProfile?.name || 'Siswa',
        competitionId: selectedComp.id,
        competitionTitle: selectedComp.title,
        status: RegistrationStatus.PENDING,
        isRegisteredDirectly,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      console.log('Sending payload:', newRegId, newRegistration);
      await applyForCompetition(newRegId, newRegistration as any);`;

code = code.replace(oldApply, newApply);

fs.writeFileSync('src/pages/student/Competitions.tsx', code);
