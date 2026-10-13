// Boundary coordinates are B1875; star and map positions are J2000.
const SkyGeometry = (() => {
 const radians = Math.PI / 180;
 const atlas = new Map(constellationAtlas.constellations.map(region => [region.id, region]));
 const matrix = constellationAtlas.toJ2000;
 const vector = point => {const a=point.ra*15*radians,d=point.dec*radians;return [Math.cos(d)*Math.cos(a),Math.cos(d)*Math.sin(a),Math.sin(d)];};
 const position = v => ({ra:((Math.atan2(v[1],v[0])/radians/15)%24+24)%24,dec:Math.atan2(v[2],Math.hypot(v[0],v[1]))/radians});
 const rotate = (point, inverse=false) => {const v=vector(point);return position([0,1,2].map(i=>v.reduce((sum,value,j)=>sum+value*(inverse?matrix[j][i]:matrix[i][j]),0)));};
 const toJ2000 = point => rotate(point);
 const toB1875 = point => rotate(point,true);
 const prepared = new Map();
 for (const region of atlas.values()) prepared.set(region.id,region.rings.map(ring=>{
  const points=ring.map(point=>[...point]);
  if(Math.abs(points.at(-1)[0]-points[0][0])>12){const pole=points.reduce((sum,p)=>sum+p[1],0)>0?90:-90;points.push([points.at(-1)[0],pole],[points[0][0],pole],points[0]);}
  return {points,low:Math.min(...points.map(p=>p[0])),high:Math.max(...points.map(p=>p[0]))};
 }));
 function contains1875(id, point) {
  const ra=((point.ra%24)+24)%24,dec=point.dec;
  if(!Number.isFinite(ra)||!Number.isFinite(dec)||dec<-90||dec>90)return false;
  // A pole is interior to its enclosing constellation, regardless of RA.
  if(dec===90)return id==='UMi';if(dec===-90)return id==='Oct';
  return prepared.get(id).some(({points,low,high})=>{
   let result=false;
   for(let cycle=Math.floor((low-ra)/24);cycle<=Math.ceil((high-ra)/24);cycle++){
    const x=ra+cycle*24;if(x<low||x>high)continue;let inside=false;
    for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if((a[1]>dec)!==(b[1]>dec)&&x<a[0]+(b[0]-a[0])*(dec-a[1])/(b[1]-a[1]))inside=!inside;}
    if(inside)result=!result;
   }
   return result;
  });
 }
 function constellationAt(point) {const original=toB1875(point);for(const id of atlas.keys())if(contains1875(id,original))return id;return null;}
 function project(point, center) {
  const a=(point.ra-center.ra)*15*radians,d=point.dec*radians,d0=center.dec*radians;
  const denominator=1+Math.sin(d0)*Math.sin(d)+Math.cos(d0)*Math.cos(d)*Math.cos(a);
  if(denominator<.025)return null;
  const k=2/denominator;
  return [-k*Math.cos(d)*Math.sin(a),-k*(Math.cos(d0)*Math.sin(d)-Math.sin(d0)*Math.cos(d)*Math.cos(a))];
 }
 function unproject(x,y,center) {
  const X=-x,Y=-y,rho=Math.hypot(X,Y),c=2*Math.atan(rho/2),a0=center.ra*15*radians,d0=center.dec*radians;
  if(rho<1e-12)return {...center};
  return {ra:((a0+Math.atan2(X*Math.sin(c),rho*Math.cos(d0)*Math.cos(c)-Y*Math.sin(d0)*Math.sin(c)))/radians/15%24+24)%24,
   dec:Math.asin(Math.max(-1,Math.min(1,Math.cos(c)*Math.sin(d0)+Y*Math.sin(c)*Math.cos(d0)/rho)))/radians};
 }
 function separation(a,b){const v=vector(a),w=vector(b),cross=[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]];return Math.atan2(Math.hypot(...cross),v.reduce((sum,value,i)=>sum+value*w[i],0))/radians;}
 const sampleCache=new Map();
 function boundarySamples(id) {
  if(!sampleCache.has(id))sampleCache.set(id,atlas.get(id).rings.map(ring=>{
   const samples=[];
   for(let i=1;i<ring.length;i++){
    const a=ring[i-1],b=ring[i],length=Math.hypot((b[0]-a[0])*15*Math.cos((a[1]+b[1])/2*radians),b[1]-a[1]),steps=Math.max(1,Math.ceil(length/.5));
    for(let j=0;j<steps;j++)samples.push(toJ2000({ra:a[0]+(b[0]-a[0])*j/steps,dec:a[1]+(b[1]-a[1])*j/steps}));
   }
   samples.push({...samples[0]});return samples;
  }));
  return sampleCache.get(id);
 }
 return {atlas,vector,position,toJ2000,toB1875,contains1875,constellationAt,project,unproject,separation,boundarySamples};
})();
