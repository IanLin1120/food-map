const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const bg=fs.readFileSync(__dirname+'/bg.svg','utf8'),fg=fs.readFileSync(__dirname+'/fg.svg','utf8');
 const shot=async(html,size,out,tr)=>{const p=await b.newPage({viewport:{width:size,height:size}});await p.setContent(`<style>html,body{margin:0;background:transparent}svg{position:absolute;left:0;top:0;width:${size}px;height:${size}px}</style>`+html);await p.screenshot({path:out,omitBackground:!!tr});await p.close()};
 await shot(bg,432,__dirname+'/bg432.png'); await shot(fg,432,__dirname+'/fg432.png',true);
 // legacy / store icon: crop the centre 72/108, rounded square
 const legacy=`<div style="position:absolute;inset:0;border-radius:22%;overflow:hidden"><div style="position:absolute;left:-25%;top:-25%;width:150%;height:150%">${bg.replace('<svg','<svg style="width:100%;height:100%"')}${fg.replace('<svg','<svg style="width:100%;height:100%"')}</div></div>`;
 await shot(legacy,512,__dirname+'/icon512.png',true);
 await b.close()})();
