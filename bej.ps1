param([ValidateSet('demo','check','test','start','register','live-test','office','supabase-check','supabase-sync-check','brand-discord','cloud-import','cloud-check','close-reviews')][string]$Action = 'demo')
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    switch ($Action) {
        'demo' { & node node_modules/tsx/dist/cli.mjs src/demo.ts }
        'check' { & node node_modules/typescript/bin/tsc --noEmit }
        'test' { & node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts }
        'start' { & node node_modules/tsx/dist/cli.mjs --env-file=.env src/bot.ts }
        'register' { & node node_modules/tsx/dist/cli.mjs --env-file=.env src/register.ts }
        'live-test' { & node node_modules/tsx/dist/cli.mjs --env-file=.env src/live-test.ts }
        'office' { & node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000 }
        'supabase-check' { & node node_modules/tsx/dist/cli.mjs --env-file=.env src/supabase-check.ts }
        'supabase-sync-check' { & node node_modules/tsx/dist/cli.mjs --env-file=.env src/supabase-sync-check.ts }
        'brand-discord' { & node node_modules/tsx/dist/cli.mjs --env-file=.env src/brand-discord.ts }
        'cloud-import' { & node node_modules/tsx/dist/cli.mjs --env-file=.env src/cloud-import.ts }
        'cloud-check' { & node node_modules/tsx/dist/cli.mjs --env-file=.env src/cloud-check.ts }
        'close-reviews' { & node node_modules/tsx/dist/cli.mjs --env-file=.env src/close-reviews.ts }
    }
    if ($LASTEXITCODE -ne 0) { throw "Bej Hub command failed (exit $LASTEXITCODE)." }
} finally { Pop-Location }
