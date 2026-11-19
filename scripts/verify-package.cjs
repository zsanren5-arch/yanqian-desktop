'use strict';
const fs=require('node:fs/promises');const path=require('node:path');const crypto=require('node:crypto');
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
(async()=>{
 const root=path.resolve(__dirname,'..'),appDir=process.argv[2] ? path.resolve(process.argv[2]) : path.join(root,'releases/mac-arm64/眼前日程.app'),asarFile=path.join(appDir,'Contents/Resources/app.asar');
 const asar=await import('@electron/asar');const inventory=asar.listPackage(asarFile).map(x=>x.replace(/^\//,''));
 for(const entry of inventory)if(/(^|\/)(?:\.env(?:\.|$)|\.git|\.openai|releases|research|tmp|tests|userData)(?:\/|$)/i.test(entry))throw new Error(`Unexpected packaged file: ${entry}`);
 const exact=['index.html','src/app.js','src/model.js','src/browser-store.js','src/styles.css','assets/icon.png','vendor/marked.js','vendor/purify.js','vendor/THIRD-PARTY-NOTICES.txt','electron/main.cjs','electron/preload.cjs','electron/vault-store.cjs'];
 const files={};for(const name of exact){const packaged=asar.extractFile(asarFile,name),source=await fs.readFile(path.join(root,name));if(!packaged.equals(source))throw new Error(`Source/package mismatch: ${name}`);files[name]=digest(source);}
 const pkg=JSON.parse(asar.extractFile(asarFile,'package.json').toString('utf8'));if(pkg.devDependencies)throw new Error('Development dependency declarations leaked into app metadata');
 const report={appDir,version:pkg.version,platform:'darwin',arch:'arm64',verifiedAt:new Date().toISOString(),sourceFiles:files,packagedEntries:inventory.length,noResearchOrTestOrEnvironmentFiles:true,sourceHashesMatch:true,unsigned:true,notarized:false,windowsOrLinuxRuntimeVerified:false};
 await fs.mkdir(path.join(root,'tests/artifacts'),{recursive:true});await fs.writeFile(path.join(root,'tests/artifacts/package-integrity.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
