const fs = require('fs');
const path = require('path');
const os = require('os');

const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
const cred = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
const oauthToken = cred.claudeAiOauth?.accessToken;

// THE KEY: Claude Code uses a SEPARATE endpoint for usage data!
async function getUsage() {
  const resp = await fetch('https://api.anthropic.com/api/oauth/usage', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${oauthToken}`,
      'anthropic-beta': 'oauth-2025-04-20',
      'Content-Type': 'application/json',
      'User-Agent': 'claude-code',
    },
  });

  console.log('Status:', resp.status);
  if (resp.ok) {
    const data = await resp.json();
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.error('Error:', await resp.text());
  }
}

getUsage().catch(e => console.error('Fatal:', e.message));
