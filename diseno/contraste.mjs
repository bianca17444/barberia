// Verifica el contraste WCAG de la paleta de BELABARBERÍA. Uso: node diseno/contraste.mjs
const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
export const cr=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
export const P={
 oscuro:{bg:'#111111',surface:'#1B1B1B',surface2:'#262626',surface3:'#303030',
  primario:'#C5A880',sobrePrimario:'#111111',acento:'#D4BC98',
  text:'#F2EFEA',muted:'#B3AEA6',faint:'#9A958D',borderInput:'#7A756D',border:'#333333',
  ok:'#5FD08F',warning:'#F0B54A',danger:'#FF8A80',info:'#8CB8F0'},
 claro:{bg:'#F6F3EE',surface:'#FFFFFF',surface2:'#EDE8E0',surface3:'#E3DCD1',
  primario:'#C5A880',sobrePrimario:'#161412',acento:'#7A5A1F',
  text:'#161412',muted:'#55504A',faint:'#6B655D',borderInput:'#7D766C',border:'#DDD6CB',
  ok:'#1A6E3E',warning:'#8A5A00',danger:'#B3261E',info:'#1F5E99'}};
const reqs=[['text',4.5],['muted',4.5],['faint',4.5],['acento',4.5],['ok',4.5],['warning',4.5],['danger',4.5],['info',4.5],['borderInput',3]];
let fallas=0;
for(const [m,p] of Object.entries(P)){console.log('== '+m);
 for(const [k,min] of reqs){const r=['bg','surface','surface2'].map(b=>cr(p[k],p[b]));const ok=r.every(x=>x>=min);if(!ok)fallas++;
  console.log(`${k.padEnd(12)}${p[k]}  bg ${r[0].toFixed(2)} | surface ${r[1].toFixed(2)} | surface2 ${r[2].toFixed(2)}  (mín ${min}) ${ok?'OK':'FALLA'}`);}
 const r=cr(p.sobrePrimario,p.primario);console.log(`texto sobre botón ${p.sobrePrimario} / ${p.primario}: ${r.toFixed(2)} ${r>=4.5?'OK':'FALLA'}`);
 const rb=['bg','surface'].map(b=>cr(p.primario,p[b]));console.log(`botón primario vs fondo (1.4.11, mín 3 si no tiene otro borde): ${rb.map(x=>x.toFixed(2)).join(' / ')}`);
 console.log(`surface vs bg ${cr(p.surface,p.bg).toFixed(2)}, surface2 vs surface ${cr(p.surface2,p.surface).toFixed(2)}`);}
console.log('fallas:',fallas);
// Figma original
console.log('Figma: #999999 sobre #262626', cr('#999999','#262626').toFixed(2),' #262626 sobre #1A1A1A (horas no disponibles)', cr('#262626','#1A1A1A').toFixed(2), ' #F5F5F5/#0D0D0D', cr('#F5F5F5','#0D0D0D').toFixed(2), ' #48C784/#1A1A1A', cr('#48C784','#1A1A1A').toFixed(2));
