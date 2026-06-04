import fs from "fs/promises";
import path from "path";
import { PROJECT_ROOT } from "@/lib/runtime/runtime-config";

const SKILL_DIR = path.join(PROJECT_ROOT, ".agents", "skills", "gmail");
const SKILL_MD = path.join(SKILL_DIR, "SKILL.md");

const SKILL_CONTENT = `---
name: Gmail
description: Read, search, and send emails via Gmail. Use the Bash tool to call the Cabinet Gmail API for searching and reading, and propose SEND_EMAIL actions for sending (human approval required).
---

# Gmail Skill

Use this skill to interact with the user's Gmail inbox via the Cabinet Gmail integration (IMAP/SMTP, connected via App Password).

## Reading emails

Use the Bash tool to call the Cabinet API:

\`\`\`bash
# Search emails (all params optional)
curl -s "http://localhost:3000/api/gmail/search?from=alice@example.com&subject=budget&since=2024-01-01&unseen=true" | jq .

# Get unread emails (newest first)
curl -s "http://localhost:3000/api/gmail/search?unseen=true" | jq .

# Read a full thread by message ID
curl -s "http://localhost:3000/api/gmail/thread/MESSAGE_ID_HERE" | jq .
\`\`\`

Search params:
- \`from\` — filter by sender email
- \`subject\` — filter by subject keyword
- \`since\` — ISO date (e.g. \`2024-01-15\`)
- \`before\` — ISO date
- \`unseen\` — \`true\` for unread only

## Sending emails

Propose a \`SEND_EMAIL\` action — the human must approve before anything is sent. You do NOT call an API to send — you emit the action and Cabinet handles the rest.

**CRITICAL FORMAT RULE:** \`SEND_EMAIL:\` must be followed by the content ON THE SAME LINE separated by \`|\`. Never put the content on a new line.

✅ Correct — everything on one line:
\`\`\`cabinet
SEND_EMAIL: recipient@example.com | Subject line | Body text here
\`\`\`

❌ Wrong — content on new line (will not be parsed):
\`\`\`
SEND_EMAIL
recipient@example.com | Subject | Body
\`\`\`

For multi-line bodies, use a \`\`\`cabinet-actions JSON block instead:
\`\`\`cabinet-actions
[{
  "type": "SEND_EMAIL",
  "to": ["recipient@example.com"],
  "cc": ["optional@example.com"],
  "subject": "Subject line",
  "body": "Full email body.\\n\\nCan span multiple lines.",
  "replyToMessageId": "optional-message-id-if-replying"
}]
\`\`\`

## Rules

- Always summarize what you found before proposing any send action
- Never send without a SEND_EMAIL proposal — the human must click Approve
- Do not guess email addresses — confirm with the user if unsure
- Connection check: \`curl -s http://localhost:3000/api/gmail/status | jq .\`
`;

/** Create the Gmail skill in the cabinet-root skills directory. Called after successful connect. */
export async function installGmailSkill(): Promise<void> {
  await fs.mkdir(SKILL_DIR, { recursive: true });
  await fs.writeFile(SKILL_MD, SKILL_CONTENT, "utf-8");
}

/** Remove the Gmail skill from the skills directory. Called on disconnect. */
export async function uninstallGmailSkill(): Promise<void> {
  try {
    await fs.rm(SKILL_DIR, { recursive: true, force: true });
  } catch {
    // ignore — skill may not exist
  }
}
