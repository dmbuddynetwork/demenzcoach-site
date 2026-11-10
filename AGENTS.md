# Development instructions

This is a static HTML/CSS/JavaScript website. Read README.md and relevant docs
before editing. Use the existing checkout; create no worktree unless requested.

Keep the 33 language homepages and their shared design consistent. Read the
localization workflow before regenerating pages. Preserve legal text and external
destinations unless the task calls for changing them. Do not send support messages.

Before completing changes run:
- `node scripts/validate-seo.mjs .`
- `node scripts/validate-contact-form.cjs`
- `node scripts/validate-situation-guides.mjs .`
- For layout changes, run the existing mobile/layout browser validators.

In this cloud environment Playwright's Node module is at
`/workspace/cloud-tools/node-tools/node_modules/playwright`; set PLAYWRIGHT_MODULE
to that path and PLAYWRIGHT_BROWSERS_PATH to `/workspace/cloud-tools/browsers`.
For HTTP-based layout checks, start a loopback-only static server and set SITE_URL.

Report tests executed, failures and limitations. Never conceal an existing failure.
GitHub Pages already deploys from main. Pushing to main publishes the website;
prepare a branch or pull request for review unless publication is requested.
Keep credentials out of files, logs and commits.
