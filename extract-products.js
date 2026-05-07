import { execFileSync } from 'node:child_process';

execFileSync('npm', ['run', 'products:export', '-w', '@broady/api'], {
  stdio: 'inherit',
});
