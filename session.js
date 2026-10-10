// Versioned, data-only session files. Chart titles and catalog names stay independent of array order.
const SESSION_FILE_LIMIT = 5 * 1024 * 1024;
let importingSession = false;

function sessionSnapshot() {
 const target = missions[region].targets[index][0];
 const savedAttempts = {...attempts, [target]: {hinted, mistakes}};
 const savedViews = {...chartViews, [region]: {...view}};
 return {
  format: 'starpath-session', version: 1, savedAt: new Date().toISOString(),
  score, found: [...found], chart: missions[region].title, target,
  mode: $('mode').value, library: $('target-library').value,
  view: {...view},
  chartViews: Object.entries(savedViews).map(([i, chartView]) => ({chart: missions[i].title, view: {...chartView}})),
  attempts: Object.entries(savedAttempts).map(([name, state]) => ({name, hinted: state.hinted, mistakes: state.mistakes})),
  display: {names: showNames, guides: showLines},
  connections: [...lineOverrides].map(([key, enabled]) => ({stars: JSON.parse(key), enabled})),
  rememberedTargets: {...rememberedTarget, [stars[target].kind || 'star']: target},
  picker: {query: $('star-query').value, page: targetPage}
 };
}

function validateSession(data) {
 const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
 const check = (valid, message) => {if (!valid) throw new Error(message);};
 check(object(data) && data.format === 'starpath-session', 'This is not a Starpath session file.');
 check(data.version === 1, 'This session version is not supported.');
 const names = new Set(missions[0].targets.map(target => target[0]));
 const charts = new Map(missions.map((mission, i) => [mission.title, i]));
 const validName = name => typeof name === 'string' && names.has(name);
 const copyView = value => ({x: value.x, y: value.y, w: value.w, h: value.h});
 const validView = value => object(value) && ['x','y','w','h'].every(key => Number.isFinite(value[key])) &&
  Math.abs(value.x) <= 1e9 && Math.abs(value.y) <= 1e9 && value.w >= 220 && value.w <= 2500 && Math.abs(value.h - value.w * .7) < 1e-6;
 check(data.mode === 'guided' || data.mode === 'expert', 'Invalid session difficulty.');
 check(data.library === 'star' || data.library === 'messier', 'Invalid object library.');
 check(charts.has(data.chart), 'The saved reference chart is not available.');
 check(validName(data.target) && (stars[data.target].kind || 'star') === data.library, 'The saved target is not available in this library.');
 check(Array.isArray(data.found) && data.found.every(validName) && new Set(data.found).size === data.found.length, 'Invalid or unavailable discovered objects.');
 check(Number.isSafeInteger(data.score) && data.score >= 0 && data.score <= data.found.length * 200, 'Invalid session score.');
 check(validView(data.view), 'Invalid saved map view.');
 check(Array.isArray(data.chartViews), 'Invalid saved chart views.');
 const views = new Map();
 for (const entry of data.chartViews) {
  check(object(entry) && charts.has(entry.chart) && validView(entry.view) && !views.has(entry.chart), 'Invalid or duplicate saved chart view.');
  views.set(entry.chart, copyView(entry.view));
 }
 check(views.has(data.chart) && ['x','y','w','h'].every(key => views.get(data.chart)[key] === data.view[key]), 'The current chart view does not match its saved view.');
 check(Array.isArray(data.attempts), 'Invalid saved attempts.');
 const savedAttempts = new Map();
 for (const entry of data.attempts) {
  check(object(entry) && validName(entry.name) && !savedAttempts.has(entry.name) && typeof entry.hinted === 'boolean' && Number.isSafeInteger(entry.mistakes) && entry.mistakes >= 0, 'Invalid or duplicate hint and guess history.');
  savedAttempts.set(entry.name, {hinted: entry.hinted, mistakes: entry.mistakes});
 }
 check(savedAttempts.has(data.target), 'The saved target is missing its hint and guess history.');
 check(object(data.display) && typeof data.display.names === 'boolean' && typeof data.display.guides === 'boolean', 'Invalid map display settings.');
 check(Array.isArray(data.connections), 'Invalid saved connections.');
 const knownStars = new Set([...data.found, ...missions.flatMap(mission => mission.reference)].filter(name => (stars[name].kind || 'star') === 'star'));
 const connections = new Map();
 for (const entry of data.connections) {
  check(object(entry) && Array.isArray(entry.stars) && entry.stars.length === 2 && entry.stars.every(name => typeof name === 'string' && knownStars.has(name)) && entry.stars[0] !== entry.stars[1] && typeof entry.enabled === 'boolean', 'Invalid star connection.');
  const key = connectionKey(...entry.stars);
  check(!connections.has(key), 'Duplicate saved star connection.');
  connections.set(key, entry.enabled);
 }
 check(object(data.rememberedTargets) && ['star','messier'].every(kind => validName(data.rememberedTargets[kind]) && (stars[data.rememberedTargets[kind]].kind || 'star') === kind) && data.rememberedTargets[data.library] === data.target, 'Invalid remembered targets.');
 check(object(data.picker) && typeof data.picker.query === 'string' && Number.isSafeInteger(data.picker.page) && data.picker.page >= 0 && data.picker.page < Math.ceil(names.size / 30), 'Invalid saved target picker.');
 // Return only validated fields; never copy arbitrary file properties into application state.
 return {
  region: charts.get(data.chart), target: data.target, score: data.score, found: [...data.found],
  mode: data.mode, library: data.library, view: copyView(data.view),
  chartViews: Object.fromEntries([...views].map(([chart, value]) => [charts.get(chart), value])),
  attempts: Object.fromEntries(savedAttempts), connections,
  display: {names: data.display.names, guides: data.display.guides},
  rememberedTargets: {star: data.rememberedTargets.star, messier: data.rememberedTargets.messier},
  picker: {query: data.picker.query, page: data.picker.page}
 };
}

function restoreSession(session) {
 // Validation completes before any existing progress or preferences are changed.
 region = session.region; index = missions[region].targets.findIndex(target => target[0] === session.target);
 score = session.score; found = session.found; attempts = session.attempts;
 view = session.view; chartViews = session.chartViews; lineOverrides = session.connections;
 showNames = session.display.names; showLines = session.display.guides;
 rememberedTarget = session.rememberedTargets; targetPage = session.picker.page;
 $('mode').value = session.mode; $('target-library').value = session.library;
 $('star-query').value = session.picker.query; $('search-feedback').textContent = '';
 ({hinted, mistakes} = attempts[session.target]); solved = found.includes(session.target);
 if (drag && $('sky').hasPointerCapture(drag.id)) $('sky').releasePointerCapture(drag.id);
 drag = null; lineEditing = false; lineStart = null; keyboardAim = false;
 cursor = [view.x + view.w / 2, view.y + view.h / 2];
 $('feedback').className = ''; $('feedback').textContent = solved ? '✓ You have already located this object.' : '';
 $('chart-choice').value = String(region);
 document.querySelectorAll('[data-region]').forEach(button => button.classList.toggle('active', Number(button.dataset.region) === region));
 best = Math.max(best, score); $('best').textContent = String(best).padStart(4, '0');
 try {localStorage.setItem('starpath-show-names', showNames); localStorage.setItem('starpath-blank-best', best);} catch {}
 refreshSuggestions(); applyView(); update();
}

function sessionMessage(message, error = false) {
 $('session-status').hidden = false; $('session-status').textContent = message;
 $('session-status').classList.toggle('error', error);
}

function exportSession() {
 try {
  const snapshot = sessionSnapshot();
  const blob = new Blob([JSON.stringify(snapshot, null, 2) + '\n'], {type: 'application/json'});
  if (blob.size > SESSION_FILE_LIMIT) throw new Error('This session is too large to export.');
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'starpath-session-' + snapshot.savedAt.slice(0, 19).replace(/[T:]/g, '-') + '.json';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  sessionMessage('Session file exported: ' + found.length + ' objects, ' + score + ' points.');
 } catch (error) {sessionMessage('Could not export the session. ' + error.message, true);}
}

async function importSessionFile(file) {
 if (!file || importingSession) return;
 importingSession = true; $('import-session').disabled = true; $('export-session').disabled = true;
 sessionMessage('Opening your saved session…');
 try {
  if (file.size > SESSION_FILE_LIMIT) throw new Error('Choose a session file smaller than 5 MB.');
  let data;
  try {data = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));}
  catch (error) {throw new Error('The session file could not be read as JSON.');}
  const session = validateSession(data);
  restoreSession(session);
  sessionMessage('Session restored: ' + found.length + ' objects, ' + score + ' points.');
 } catch (error) {sessionMessage('Could not import the session. ' + error.message + ' Your current session is unchanged.', true);}
 finally {
  importingSession = false; $('import-session').disabled = false; $('export-session').disabled = false;
  $('session-file').value = '';
 }
}

$('export-session').onclick = exportSession;
$('import-session').onclick = () => $('session-file').click();
$('session-file').onchange = event => importSessionFile(event.target.files[0]);
