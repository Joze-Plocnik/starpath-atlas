const ConstellationGame = (() => {
 const DEFAULT_MAGNITUDE_LIMIT = 4.00;
 const DEFAULT_STARTING_MAGNITUDE = 4.00;
 const $ = id => document.getElementById(id), svg = $('constellation-sky'), NS = 'http://www.w3.org/2000/svg';
 const regions = SkyGeometry.atlas;
 const normalizeName = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
 const names = new Map([...regions.values()].map(region => [normalizeName(region.name), region.id]));
 const groupedStars = new Map([...regions.keys()].map(id => [id, []]));
 for (const star of brightStars) {
  const owner = SkyGeometry.constellationAt(star);
  if (owner) groupedStars.get(owner).push(star);
 }
 const brightestMagnitude = new Map([...groupedStars].map(([id,stars])=>[id,Math.min(...stars.map(star=>star.mag))]));
 const state = {mode:'classic',current:null,phase:'identify',limit:DEFAULT_MAGNITUDE_LIMIT,startingLimit:DEFAULT_STARTING_MAGNITUDE,foundNeighbors:new Map(),claimed:new Map(),focus:null,pending:null,
  correctNames:0,correctNeighbors:0,roundsCompleted:0,roundNumber:0,visited:new Set(),
  center:null,view:null,defaultView:null,cursor:[500,350],aim:false};
 let drag = null, nextTimer = null;
 const point = pair => ({ra:pair[0],dec:pair[1]});
 const shownRegions = () => state.phase==='identify'?[state.current]:state.mode==='conquer'?[...state.claimed.keys()]:[state.current,...state.foundNeighbors.keys()];
 const visibleStars = () => shownRegions().flatMap(id=>groupedStars.get(id)).filter(star => star.mag <= state.limit);
 const starRegions = new Map([...groupedStars].flatMap(([id,stars])=>stars.map(star=>[star.hygId,id])));
 function frontier() {
  if(state.phase==='identify')return [];
  if(state.mode==='classic')return regions.get(state.current).neighbors.filter(id=>!state.foundNeighbors.has(id));
  const available=new Set();for(const id of state.claimed.keys())for(const neighbor of regions.get(id).neighbors)if(!state.claimed.has(neighbor))available.add(neighbor);
  return [...available];
 }
 const canStart = (id,displayLimit=state.limit,startingLimit=state.startingLimit) => regions.has(id)&&brightestMagnitude.get(id)<=displayLimit&&brightestMagnitude.get(id)<=startingLimit;
 const eligible = () => [...regions.keys()].filter(id => canStart(id));
 function element(tag,attributes={},parent=svg) {
  const node=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);parent.appendChild(node);return node;
 }
 function chartPoint(position) {const projected=SkyGeometry.project(position,state.center);return projected?{x:500+projected[0]*600,y:350+projected[1]*600}:null;}
 function skyPosition(x,y) {return SkyGeometry.unproject((x-500)/600,(y-350)/600,state.center);}
 function screenUnit() {const matrix=svg.getScreenCTM();return matrix?1/Math.hypot(matrix.a,matrix.b):state.view.w/1000;}
 function fitView(id) {
  const samples=SkyGeometry.boundarySamples(id).flat();
  samples.push(...Object.values(regions.get(id).anchors).map(point));
  const projected=samples.map(chartPoint).filter(Boolean),xs=projected.map(p=>p.x),ys=projected.map(p=>p.y);
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  const w=Math.max(420,(right-left)*1.4+100,(bottom-top)/.7*1.4+100),h=w*.7;
  return {x:(left+right-w)/2,y:(top+bottom-h)/2,w,h};
 }
 function message(text,error=false) {$('feedback').textContent=text;$('feedback').classList.toggle('error',error);}
 function cancelAdvance() {if(nextTimer!==null){clearTimeout(nextTimer);nextTimer=null;}}
 function startRound(id) {
  if(state.mode==='conquer'&&state.claimed.size)return false;
  if(!canStart(id))return false;
  cancelAdvance();state.current=id;state.phase='identify';state.foundNeighbors=new Map();state.pending=null;
  state.focus=id;state.center=point(regions.get(id).center);state.defaultView=fitView(id);state.view={...state.defaultView};
  state.cursor=[state.view.x+state.view.w/2,state.view.y+state.view.h/2];state.aim=false;state.roundNumber++;
  drag=null;$('answer').value='';message('');update();return true;
 }
 function nextRound() {
  if(state.mode==='conquer'&&state.claimed.size)return false;
  cancelAdvance();if(state.current)state.visited.add(state.current);
  let choices=eligible().filter(id=>!state.visited.has(id));
  if(!choices.length){state.visited.clear();choices=eligible().filter(id=>id!==state.current);if(!choices.length)choices=eligible();}
  startRound(choices[Math.floor(Math.random()*choices.length)]);
 }
 function newGame() {
  cancelAdvance();state.correctNames=0;state.correctNeighbors=0;state.roundsCompleted=0;state.roundNumber=0;
  state.visited.clear();state.claimed.clear();state.current=null;state.phase='identify';nextRound();
 }
 function setMode(mode) {
  if(!['classic','conquer'].includes(mode))return false;
  state.mode=mode;$('game-mode').value=mode;newGame();return true;
 }
 function focusOn(id) {
  if(state.mode!=='conquer'||!state.claimed.has(id))return false;
  state.focus=id;state.center=point(regions.get(id).center);state.defaultView=fitView(id);state.view={...state.defaultView};
  state.cursor=[state.view.x+state.view.w/2,state.view.y+state.view.h/2];state.aim=false;drag=null;
  update();return true;
 }
 function revealName(earned) {
  if(state.phase!=='identify')return;
  if(state.mode==='conquer'&&!earned)return;
  if(earned)state.correctNames++;
  if(state.mode==='conquer')state.claimed.set(state.current,point(regions.get(state.current).label));
  state.phase='neighbors';state.pending=null;$('answer').value='';
  message((earned?'Correct — ':'Revealed — ')+regions.get(state.current).name+(state.mode==='conquer'?'. Your first claim! Expand from any claimed constellation.':'. Now name and place its neighbors.'));update();$('answer').focus();
 }
 function submitAnswer(value) {
  if(state.phase==='complete')return;
  state.pending=null;const id=names.get(normalizeName(value));
  if(!id){message('Enter the full Latin constellation name. Abbreviations and English translations do not count.',true);update();return;}
  if(state.phase==='identify'){
   if(id===state.current)revealName(true);
   else {message('That is not this constellation. Look at the star pattern and try again.',true);update();}
   return;
  }
  const current=regions.get(state.current);
  if(state.mode==='conquer'){
   if(state.claimed.has(id)){message(regions.get(id).name+' is already claimed. Choose an unclaimed neighbor.');update();return;}
   if(!frontier().includes(id)){message(regions.get(id).name+' does not border any claimed constellation yet.',true);update();return;}
  }else{
   if(id===state.current){message('That is the constellation you already identified. Name one of its neighbors.',true);update();return;}
   if(!current.neighbors.includes(id)){message(regions.get(id).name+' does not share a border with '+current.name+'. Try another name.',true);update();return;}
   if(state.foundNeighbors.has(id)){message('You have already named and placed '+regions.get(id).name+'.');update();return;}
  }
  state.pending=id;state.aim=false;message('Name accepted. Now click inside '+regions.get(id).name+' to earn the point.');
  update();svg.focus();
 }
 function placeNeighbor(x,y) {
  if(state.phase!=='neighbors'||!state.pending)return false;
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const position=skyPosition(x,y),id=state.pending;
  if(!frontier().includes(id))return false;
  if(SkyGeometry.constellationAt(position)!==id){message('That point is outside '+regions.get(id).name+'. Pan or zoom'+(state.mode==='conquer'?', or use View around':'')+', then try again.',true);return false;}
  if(state.mode==='conquer')state.claimed.set(id,position);else state.foundNeighbors.set(id,position);
  state.correctNeighbors++;state.pending=null;state.aim=false;$('answer').value='';
  if(state.mode==='conquer'&&state.claimed.size===regions.size){
   state.phase='complete';message('Sky conquered! All '+regions.size+' constellations claimed. Start a new game to play again.');
  }else if(state.mode==='classic'&&state.foundNeighbors.size===regions.get(state.current).neighbors.length){
   state.phase='complete';state.roundsCompleted++;
   message('All neighbors found! Next star-only constellation in a moment.');
   nextTimer=setTimeout(nextRound,2200);
  }else message('Correct — '+regions.get(id).name+' named and placed.');
  update();if(state.phase==='neighbors')$('answer').focus();return true;
 }
 function drawBoundary(id,neighbor=false) {
  for(const ring of SkyGeometry.boundarySamples(id)){
   let segment=[];
   const flush=()=>{if(segment.length>1)element('polyline',{points:segment.map(p=>p.x.toFixed(3)+','+p.y.toFixed(3)).join(' '),class:'border'+(neighbor?' neighbor-border':''),'data-boundary':id,'aria-hidden':'true'});segment=[];};
   for(const position of ring){const p=chartPoint(position);if(!p||(segment.length&&Math.hypot(p.x-segment.at(-1).x,p.y-segment.at(-1).y)>500)){flush();if(p)segment.push(p);}else segment.push(p);}flush();
  }
 }
 function drawLabel(id,position,neighbor=false) {
  const p=chartPoint(position),unit=screenUnit();if(!p)return;
  const label=element('text',{x:p.x+10*unit,y:p.y-10*unit,class:'region-label'+(neighbor?' neighbor-label':''),style:`font-size:${12*unit}px;stroke-width:${4*unit}px`,'data-region-label':id});
  label.textContent=regions.get(id).name;
 }
 function renderMap() {
  if(!state.current)return;
  svg.setAttribute('viewBox',`${state.view.x} ${state.view.y} ${state.view.w} ${state.view.h}`);svg.replaceChildren();
  const unit=screenUnit();
  if(state.phase!=='identify'){
   const displayed=state.mode==='conquer'?state.claimed:new Map([[state.current,point(regions.get(state.current).label)],...state.foundNeighbors]);
   for(const [id,position] of displayed){drawBoundary(id,id!==state.current);drawLabel(id,position,id!==state.current);if(id!==state.current){const p=chartPoint(position);if(p)element('circle',{cx:p.x,cy:p.y,r:5*unit,class:'click-marker','aria-hidden':'true'});}}
  }
  const defs=element('defs'),filter=element('filter',{id:'star-glow',x:'-100%',y:'-100%',width:'300%',height:'300%'},defs);element('feGaussianBlur',{stdDeviation:1.8*unit},filter);
  for(const star of visibleStars()){
   const p=chartPoint(star);if(!p)continue;
   const radius=Math.max(2.1,4.9-star.mag*.65)*unit,color={white:'#e8f2ff',blue:'#b6d5ff',orange:'#ffd0a0',gold:'#f0dfb5'}[star.color];
   element('circle',{cx:p.x,cy:p.y,r:radius*2,fill:color,opacity:.15,filter:'url(#star-glow)','aria-hidden':'true'});
   element('circle',{cx:p.x,cy:p.y,r:radius,fill:color,'data-game-star':star.hygId,'data-constellation':starRegions.get(star.hygId),'data-magnitude':star.mag,'aria-hidden':'true'});
  }
  if(state.aim&&state.pending){const [x,y]=state.cursor; element('path',{d:`M${x-9*unit} ${y}H${x+9*unit}M${x} ${y-9*unit}V${y+9*unit}`,stroke:'#b8efda','stroke-width':unit,fill:'none','aria-hidden':'true','data-aim':'true'});}
  $('zoom-level').textContent=Math.round(state.defaultView.w/state.view.w*100)+'%';
  svg.classList.toggle('placing',!!state.pending);
  svg.setAttribute('aria-label',state.phase==='identify'?'Unknown constellation: '+visibleStars().length+' stars. Enter its Latin name in the answer field.':state.pending?'Place '+regions.get(state.pending).name+'. Aim with arrow keys and press Enter.':state.mode==='conquer'?'Claimed constellations, centered on '+regions.get(state.focus).name+'.':regions.get(state.current).name+' and the neighbors you have found.');
 }
 function update() {
  const region=regions.get(state.current),identifying=state.phase==='identify',complete=state.phase==='complete';
  const conquering=state.mode==='conquer';
  $('score').textContent=state.correctNames+state.correctNeighbors;$('named-count').textContent=state.correctNames;$('neighbor-count').textContent=state.correctNeighbors;
  $('round-stat-label').textContent=conquering?'CLAIMED':'ROUND';$('completed-stat-label').textContent=conquering?'REMAINING':'COMPLETED';
  $('round-number').textContent=conquering?state.claimed.size:state.roundNumber;$('completed-count').textContent=conquering?regions.size-state.claimed.size:state.roundsCompleted;
  $('map-title').textContent=identifying?'UNNAMED CONSTELLATION':conquering?'YOUR TERRITORY · '+state.claimed.size+' / '+regions.size:region.name.toUpperCase();
  $('star-count').textContent=visibleStars().length+(identifying?' stars':' revealed stars')+' · mag ≤ '+state.limit.toFixed(2);
  const matchingCount=eligible().length;
  $('starting-count').textContent=matchingCount+' starting constellation'+(matchingCount===1?' matches':'s match')+' both limits. Neighbor discoveries stay unrestricted.';
  $('step-name').classList.toggle('active',identifying);$('step-neighbors').classList.toggle('active',!identifying);
  $('step-neighbors').textContent=conquering?'02  Conquer the sky':'02  Find its neighbors';
  $('phase-label').textContent=identifying?'THE STAR PATTERN':complete?(conquering?'CONQUEST COMPLETE':'ROUND COMPLETE'):(conquering?'EXPAND YOUR TERRITORY':'THE BORDERING CONSTELLATIONS');
  $('challenge-title').textContent=identifying?'What constellation is this?':conquering?(complete?'Sky conquered!':'Claim the whole sky.'):region.name;
  $('challenge-description').textContent=identifying?'Only its stars are visible. Enter the full Latin name to reveal its border.':conquering?(complete?'All 88 constellations are yours. Your final score stays on screen.':'Name and place any unclaimed constellation bordering any of your claims. Use View around to travel across the sky.'):(complete?'Every neighbor is named and placed. Your score carries into the next round.':'Its border is now visible. Name each neighbor, then click inside that constellation’s region.');
  $('answer-label').textContent=identifying?'LATIN CONSTELLATION NAME':'LATIN NAME OF A NEIGHBOR';
  $('check-answer').innerHTML=(identifying?'Check name':'Place neighbor')+' <span aria-hidden="true">→</span>';
  $('answer-form').hidden=complete;$('answer-note').hidden=complete;
  $('reveal-name').hidden=conquering||!identifying;$('skip-round').hidden=conquering||identifying||complete;$('next-round').hidden=conquering||!complete;
  $('neighbor-section').hidden=identifying;$('region-progress-label').textContent=conquering?'CLAIMED CONSTELLATIONS':'NEIGHBORS FOUND';
  $('neighbor-progress').textContent=conquering?state.claimed.size+' / '+regions.size:state.foundNeighbors.size+' / '+region.neighbors.length;
  $('found-neighbors').replaceChildren();for(const id of (conquering?state.claimed:state.foundNeighbors).keys()){const li=document.createElement('li');li.textContent='✓ '+regions.get(id).name;$('found-neighbors').appendChild(li);}
  $('travel-controls').hidden=!conquering||identifying;
  $('view-around').replaceChildren();if(conquering)for(const id of state.claimed.keys()){const option=document.createElement('option');option.value=id;option.textContent=regions.get(id).name;$('view-around').appendChild(option);}$('view-around').value=state.focus;
  $('pending-placement').hidden=!state.pending;$('pending-placement').textContent=state.pending?'Place '+regions.get(state.pending).name+' on the map. Escape cancels.':'';
  $('map-instructions').textContent=state.pending?'Click inside '+regions.get(state.pending).name+' · Drag to pan · Arrow keys + Enter to aim':'Drag to pan · Scroll or +/− to zoom';
  renderMap();
 }
 function zoomAt(factor,p={x:state.view.x+state.view.w/2,y:state.view.y+state.view.h/2}) {
  const w=Math.max(state.defaultView.w*.15,Math.min(state.defaultView.w*5,state.view.w*factor)),ratio=w/state.view.w;
  state.view={x:p.x+(state.view.x-p.x)*ratio,y:p.y+(state.view.y-p.y)*ratio,w,h:w*.7};renderMap();
 }
 function setMagnitude(value) {
  if(!Number.isFinite(value)||value<0||value>5){$('magnitude').value=state.limit.toFixed(2);message('Choose a magnitude limit from 0.00 to 5.00.',true);return false;}
  state.limit=value;$('magnitude').value=value.toFixed(2);
  if(state.phase==='identify'&&!canStart(state.current)){nextRound();message('The previous pattern has no stars at this limit. Here is another constellation.');}
  else update();return true;
 }
 function setStartingMagnitude(value) {
  if(!Number.isFinite(value)||value<-2||value>5){$('starting-magnitude').value=state.startingLimit.toFixed(2);message('Choose a starting brightest-star limit from -2.00 to 5.00.',true);return false;}
  if(![...regions.keys()].some(id=>canStart(id,state.limit,value))){$('starting-magnitude').value=state.startingLimit.toFixed(2);message('No starting constellations match both limits. Raise the brightest-star limit.',true);return false;}
  state.startingLimit=value;$('starting-magnitude').value=value.toFixed(2);
  if(state.phase==='identify'&&!canStart(state.current)){nextRound();message('The previous pattern does not meet the brightest-star limit. Here is a matching constellation.');}
  else update();return true;
 }
 function eventPoint(event) {const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const matrix=svg.getScreenCTM();return matrix?p.matrixTransform(matrix.inverse()):null;}
 svg.onpointerdown=event=>{if(event.button!==0||drag)return;const p=eventPoint(event);if(!p)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:p,moved:false};svg.setPointerCapture(event.pointerId);};
 svg.onpointermove=event=>{if(!drag||event.pointerId!==drag.id)return;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5)drag.moved=true;if(drag.moved){const p=eventPoint(event);if(!p)return;state.view.x+=drag.start.x-p.x;state.view.y+=drag.start.y-p.y;renderMap();svg.style.cursor='grabbing';}};
 svg.onpointerup=event=>{if(!drag||event.pointerId!==drag.id)return;const moved=drag.moved||Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5;drag=null;svg.style.cursor='';if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);if(!moved){const p=eventPoint(event);if(p){state.aim=false;placeNeighbor(p.x,p.y);}}};
 svg.onpointercancel=()=>{drag=null;svg.style.cursor='';};
 svg.onwheel=event=>{event.preventDefault();const p=eventPoint(event);if(p)zoomAt(Math.exp(Math.max(-1,Math.min(1,event.deltaY*.0015))),p);};
 svg.onkeydown=event=>{
  if(event.key==='Escape'){state.pending=null;state.aim=false;message('Placement canceled. Enter another neighbor name.');update();$('answer').focus();return;}
  const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(dirs[event.key]){
   event.preventDefault();const delta=dirs[event.key],step=(event.shiftKey?2:10)*screenUnit();
   if(state.pending){if(!state.aim)state.cursor=[state.view.x+state.view.w/2,state.view.y+state.view.h/2];state.aim=true;state.cursor=[Math.max(state.view.x,Math.min(state.view.x+state.view.w,state.cursor[0]+delta[0]*step)),Math.max(state.view.y,Math.min(state.view.y+state.view.h,state.cursor[1]+delta[1]*step))];}
   else {state.view.x+=delta[0]*step;state.view.y+=delta[1]*step;}renderMap();
  }else if((event.key==='Enter'||event.key===' ')&&state.pending){event.preventDefault();if(!state.aim)state.cursor=[state.view.x+state.view.w/2,state.view.y+state.view.h/2];placeNeighbor(...state.cursor);}
 };
 $('answer-form').onsubmit=event=>{event.preventDefault();submitAnswer($('answer').value);};
 $('answer').oninput=()=>{if(state.pending){state.pending=null;state.aim=false;update();}};
 $('reveal-name').onclick=()=>revealName(false);$('skip-round').onclick=nextRound;$('next-round').onclick=nextRound;$('new-game').onclick=newGame;
 $('zoom-in').onclick=()=>zoomAt(.8);$('zoom-out').onclick=()=>zoomAt(1.25);$('reset-view').onclick=()=>{state.view={...state.defaultView};state.aim=false;renderMap();};
 $('magnitude').onchange=()=>setMagnitude(Number($('magnitude').value));
 $('starting-magnitude').onchange=()=>setStartingMagnitude($('starting-magnitude').value.trim()===''?NaN:Number($('starting-magnitude').value));
 $('game-mode').onchange=()=>setMode($('game-mode').value);
 $('view-around').onchange=()=>focusOn($('view-around').value);
 window.addEventListener('resize',renderMap);
 $('game-mode').value=state.mode;$('magnitude').value=DEFAULT_MAGNITUDE_LIMIT.toFixed(2);$('starting-magnitude').value=DEFAULT_STARTING_MAGNITUDE.toFixed(2);newGame();
 return {state,visibleStars,shownRegions,frontier,eligible,canStart,brightestMagnitude,startRound,nextRound,newGame,setMode,focusOn,submitAnswer,placeNeighbor,chartPoint,skyPosition,zoomAt,setMagnitude,setStartingMagnitude,renderMap};
})();
