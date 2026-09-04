# Security Specifications for School Competition & Guidance App

## 1. Data Invariants

1.  **User Profiles (`users`)**:
    *   A user can only read and update their own profile unless they are an ADMIN/MANAGEMENT.
    *   No one can arbitrarily change their role to `ADMIN` or `MANAGEMENT`.
    *   Profile data creation must tie directly to the authenticated user's UID.
2.  **Students (`students`)**:
    *   Students can only read and modify their own student record, matching `userId` to `request.auth.uid`.
    *   Admins/Management can read and modify all student records.
3.  **Competitions (`competitions`)**:
    *   Any authenticated user can read competitions.
    *   Only Admins/Management can create, update, or delete competitions.
4.  **Registrations (`registrations`)**:
    *   Students can only create and read their own registrations.
    *   Only Admins/Management can update the `status` of a registration (approve/reject) or read all registrations.
5.  **Achievements (`achievements`)**:
    *   Students can read their own achievements.
    *   Only Admins/Management can create, update, or delete achievements.
6.  **Guidance Logs (`guidanceLogs`)**:
    *   Students can create and read their own guidance logs (`studentId == request.auth.uid`).
    *   Admins/Management can read all guidance logs.
    *   Guidance logs are append-only for students (they shouldn't normally edit/delete old feelings without admin intervention, but for now we might allow read/write restricted to their own ID).
7.  **OSN (`osn`)**:
    *   Assuming it contains general OSN data/announcements. Anyone authenticated can read. Admins can write.

## 2. The "Dirty Dozen" Payloads

1.  **Ghost Admin Profile (Create)**: Attempt to create a user profile with `role: 'ADMIN'` as a regular user. (Should fail).
2.  **Role Escalation (Update)**: Attempt to update own profile from `role: 'STUDENT'` to `role: 'ADMIN'`. (Should fail).
3.  **Cross-Student Profile Sniffing**: Attempt to `get()` another student's profile/student document. (Should fail).
4.  **Malicious Registration**: Attempt to register for a competition by setting `studentId` to someone else's ID. (Should fail).
5.  **Status Tampering**: Attempt to update a registration `status` from `PENDING` to `APPROVED` as a student. (Should fail).
6.  **Competition Tampering**: Attempt to update a competition's title as a student. (Should fail).
7.  **Achievement Forgery**: Attempt to create a GOLD medal achievement as a student. (Should fail).
8.  **Guidance Log Sniffing**: Attempt to `list` guidance logs where `studentId` is not the user's ID. (Should fail).
9.  **Denial of Wallet (ID Poisoning)**: Attempt to create a document with a 2MB ID string. (Should fail).
10. **Type Poisoning**: Attempt to set a `points` field in an achievement to a String instead of a Number. (Should fail).
11. **Phantom Update**: Update a document without providing the required timestamp update `updatedAt`. (Should fail).
12. **PII Sniffing**: Blanket query `students` collection without being an admin. (Should fail).
