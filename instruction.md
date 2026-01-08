Implement Feature 5: Integration of My Page and Account Settings (UI Major Revision).

1. Common Prerequisites

- Existing MyPage (`src/pages/account/MyPage.vue`).
- Existing Account Settings logic in `src/pages/debug/AuthDebugPage.vue`.
- Profile data in `profiles/{uid}`.

5. Integration of My Page and Account Settings
   Goal: Reduce page transitions and complete account settings on My Page.

Screen Transition Diagram:
My Page

- Tab 1: Overview (Current MyPage content + Invited Projects from Feature 2 if you can preserve it, but prioritize Feature 5 requirements. Feature 2 handled invites. Feature 5 says "Tab 1: Overview").
- Tab 2: Account Settings (Old /debug/auth functionality)

API Endpoint Definition:

- updateAccountAvatar(file)
- removeAccount()

Firestore Schema Details:
profiles/{uid}

- nickname, fullName, avatarUrl, email

Test Case Table:
ID Premise Operation Expected Result
M-01 Logged In My Page Display Settings tab displayed
M-02 Image Update Icon Change New image reflected
M-03 Delete Account Delete Delete completed & Logout

Tasks:

- Refactor `MyPage.vue` to use Tabs (Overview / Settings).
- In Settings Tab:
  - Form to update nickname/fullName (if not already there).
  - Avatar upload/update (mock or implement if storage exists. If no storage, input URL?). Design says `updateAccountAvatar(file)`, implies upload.
  - Delete Account button (with confirmation).
- Logic can be copied/adapted from `AuthDebugPage.vue`.
- Use `profileService.ts` or `auth.ts`.
