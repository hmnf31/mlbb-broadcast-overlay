// Cek cepat bahwa markup dan CSS tetap sinkron setelah restyle: id harus unik, setiap
// getElementById di app.js harus ada di HTML, dan setiap class yang dipakai harus punya
// aturan CSS. Dipakai sebagai pagar, bukan sebagai pengganti test overlay.
const fs = require('fs');

for (const page of ['draft', 'result']) {
  const base = `frontend/overlay/${page}`;
  const html = fs.readFileSync(`${base}/index.html`, 'utf8');
  const app = fs.readFileSync(`${base}/app.js`, 'utf8');
  const css = fs.readFileSync(`${base}/styles.css`, 'utf8');
  // Class bersama (misalnya `apex-diamond`) atrium di apex.css, jadi keduanya ikut searched.
  const shared = fs.readFileSync('frontend/shared/apex.css', 'utf8');

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  const want = [...app.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);
  const missing = [...new Set(want)].filter((id) => !ids.includes(id));

  const classes = new Set(
    [...html.matchAll(/\sclass="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)),
  );
  const jsClasses = new Set(
    [...app.matchAll(/\.className = '([^']+)'/g)].flatMap((m) => m[1].split(/\s+/)),
  );
  const noStyle = [...classes, ...jsClasses]
    .filter((c) => c && !css.includes(`.${c}`) && !shared.includes(`.${c}`));

  console.log(`${page}: ids=${ids.length} dup=${JSON.stringify(dup)} `
    + `missingGetById=${JSON.stringify(missing)} noStyle=${JSON.stringify(noStyle)}`);
  if (dup.length || missing.length || noStyle.length) process.exitCode = 1;
}