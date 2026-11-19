'use strict';
const fs=require('node:fs/promises');const path=require('node:path');const {execFileSync}=require('node:child_process');
(async()=>{
 const root=path.resolve(__dirname,'..'),source=path.join(root,'assets/icon.png');await fs.access(source);
 if(process.platform!=='darwin'){console.log('Keep assets/icon.png; generate .icns on macOS and .ico in the platform packaging job.');return;}
 const dir=path.join(root,'assets/icon.iconset');await fs.mkdir(dir,{recursive:true});
 for(const size of [16,32,128,256,512])for(const scale of [1,2]){const pixels=size*scale,name=`icon_${size}x${size}${scale===2?'@2x':''}.png`;execFileSync('/usr/bin/sips',['-s','format','png','-z',String(pixels),String(pixels),source,'--out',path.join(dir,name)],{stdio:'ignore'});}
 execFileSync('/usr/bin/iconutil',['-c','icns',dir,'-o',path.join(root,'assets/icon.icns')],{stdio:'inherit'});
 // ICO is a packaging conversion of the chosen artwork, not a new illustration.
 const icoPng=path.join(dir,'icon_128x128@2x.png'),png=await fs.readFile(icoPng),header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=0;header[7]=0;header[8]=0;header[9]=0;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);await fs.writeFile(path.join(root,'assets/icon.ico'),Buffer.concat([header,png]));
 await fs.rm(dir,{recursive:true,force:true});console.log('Generated .icns and .ico from the original icon.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
