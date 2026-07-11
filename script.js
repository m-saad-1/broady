const fs=require('fs');
let c=fs.readFileSync('D:/WEB DEVELOPMENT/broady/apps/web/src/lib/taxonomy.ts','utf8');
c = c.replace(/if \(normalized === "juniors" \|\| normalized === "kids"\) return "Juniors";/g, 'if (normalized === "juniors" || normalized === "kids") return "Juniors";\n  if (normalized === "boys") return "Junior Boys";\n  if (normalized === "girls") return "Junior Girls";');
fs.writeFileSync('D:/WEB DEVELOPMENT/broady/apps/web/src/lib/taxonomy.ts',c);
