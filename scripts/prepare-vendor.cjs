'use strict';
const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'vendor');await fs.mkdir(out,{recursive:true});
 const files=[['marked/lib/marked.esm.js','marked.js'],['dompurify/dist/purify.es.mjs','purify.js']];
 for(const [source,target]of files)await fs.copyFile(path.join(root,'node_modules',source),path.join(out,target));
 const licenses=[];for(const name of ['marked','dompurify']){const pkg=JSON.parse(await fs.readFile(path.join(root,'node_modules',name,'package.json'),'utf8'));const names=await fs.readdir(path.join(root,'node_modules',name));const license=names.find(x=>/^LICENSE(?:\.|$)/i.test(x));licenses.push(`${name} ${pkg.version}\n${pkg.homepage||pkg.repository?.url||''}\n\n${await fs.readFile(path.join(root,'node_modules',name,license),'utf8')}`);}
 await fs.writeFile(path.join(out,'THIRD-PARTY-NOTICES.txt'),licenses.join('\n\n============================================================\n\n'));
 console.log('Prepared pinned offline Markdown and sanitizer modules with licenses.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
