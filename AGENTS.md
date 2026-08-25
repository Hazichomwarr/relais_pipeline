<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent security rule: never mutate real credentials/roles/data for test access

Never modify authentication credentials, user roles, permissions, or production/production-adjacent user data solely to gain test access or facilitate verification, without the user's explicit approval. Restoring a value afterward does not make an unauthorized mutation acceptable — the mutation itself is the violation, not just leaving it unrestored.

This applies beyond credentials: without explicit approval, do not mutate real/shared data merely to facilitate testing, including password hashes, roles, permissions, account activation state, prospect ownership, financial records, or any other real user's data. Normal implementation work explicitly required by a ticket (e.g. a real migration) is different from a verification shortcut — this rule targets the shortcut, not legitimate change.

If a task needs an authenticated browser session and no authorized test credentials are available:

```text
Need to visually test authenticated page
        ↓
No authorized credentials available
        ↓
STOP
        ↓
report: "Authenticated browser verification could not be completed."
```

Do not query the database for a real account and overwrite its password hash, do not promote a test user to a different role, and do not hardcode real or fabricated credentials into the repository to work around this. If a dedicated test/development identity is needed, that must be provisioned deliberately through environment or seed infrastructure, as its own explicit task — not improvised mid-verification.
