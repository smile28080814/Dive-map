/* ============================= DATA ============================= */
const STARS = n => {
  let s = '';
  for(let i=1;i<=5;i++) s += `<span class="${i<=n?'on':'off'}">★</span>`;
  return `<span class="stars">${s}</span>`;
};
const LEVELS = ['입문','초급','중급','상급','전문가'];

/* ============================= STATE / RENDER ============================= */
let currentTab = 'browse';
let activeContinent = '전체';
let currentDetail = null;
let currentArea = null;
let leafletMap = null;

function wikiPhotoLink(en){
  if(!en) return '';
  const q = encodeURIComponent(en + ' underwater');
  return `<a class="photo-link" href="https://commons.wikimedia.org/w/index.php?search=${q}&title=Special:MediaSearch&type=image" target="_blank" rel="noopener">📷 실제 사진 보기 (Wikimedia Commons)</a>`;
}

const root = document.getElementById('view-root');
const CONTINENT_ORDER = ['동남아시아','동아시아','오세아니아','유럽','아프리카','아메리카'];
const continents = ['전체', ...Array.from(new Set(COUNTRIES.map(c=>c.continent))).sort((x,y)=>(CONTINENT_ORDER.indexOf(x)+99)%99-(CONTINENT_ORDER.indexOf(y)+99)%99)];

function monthDots(months, peak){
  let out = '';
  for(let m=1;m<=12;m++){
    let cls = 'dot';
    if(peak && peak.includes(m)) cls += ' peak';
    else if(months && months.includes(m)) cls += ' ok';
    out += `<div class="cell"><div class="${cls}"></div></div>`;
  }
  return out;
}

function getAreas(c){
  const map = new Map();
  c.points.forEach(p=>{
    if(!map.has(p.region)) map.set(p.region, []);
    map.get(p.region).push(p);
  });
  return Array.from(map.entries()).map(([name, pts])=>({
    name,
    preview: Array.from(new Set(pts.map(p=>p.preview))).join(' · '),
    points: pts
  }));
}

function cautionClass(v){
  return 'level-' + v.replace(/\s/g,'.');
}

function renderCautionTable(cautions){
  const rows = Object.entries(cautions).map(([k,v])=>
    `<tr><td>${k}</td><td class="${cautionClass(v.split(' ')[0].replace('(','').replace(')',''))}">${v}</td></tr>`
  ).join('');
  return `<table class="caution-table"><tbody>${rows}</tbody></table>`;
}

function countryCardHTML(c){
  const topCreatures = c.creatures.slice(0,3).map(x=>x.name).join(' · ');
  return `
  <div class="card" onclick="openCountry('${c.id}')">
    <div class="region">${c.continent} · ${c.flag}</div>
    <h4 class="display">${c.name}</h4>
    <div class="creatures">${topCreatures}</div>
    <div class="stat-row">
      <span>프리 ${STARS(c.suit.free)}</span>
      <span>스쿠버 ${STARS(c.suit.scuba)}</span>
    </div>
  </div>`;
}

function renderBrowse(){
  const list = activeContinent==='전체' ? COUNTRIES : COUNTRIES.filter(c=>c.continent===activeContinent);
  root.innerHTML = `
    <section class="hero">
      <div class="gauge"></div>
      <div class="eyebrow">World Edition</div>
      <h2 class="display">모알보알의 정어리떼부터 갈라파고스의 귀상어까지,<br/>${COUNTRIES.length}개국 다이빙 가이드.</h2>
      <p>동남아시아·동아시아·오세아니아·유럽·아프리카·아메리카 ${COUNTRIES.length}개국, ${COUNTRIES.reduce((n,c)=>n+c.points.length,0)}개 프리다이빙·스쿠버 포인트와 월별 해양생물 캘린더를 한 곳에 모았습니다.</p>
      <div class="cta-row">
        <button class="btn primary" onclick="switchTab('search')">조건으로 추천받기</button>
        <button class="btn" onclick="document.getElementById('country-grid').scrollIntoView({behavior:'smooth'})">국가 목록 보기</button>
      </div>
    </section>

    <div class="section-head"><h3>대륙으로 찾기</h3></div>
    <div class="chip-row">
      ${continents.map(ct=>`<span class="chip ${ct===activeContinent?'active':''}" onclick="setContinent('${ct}')">${ct}</span>`).join('')}
    </div>

    <div class="section-head"><h3>지도로 찾기</h3><span class="count">점을 누르면 해당 국가로 이동</span></div>
    <div id="world-map" class="dive-map"></div>

    <div class="section-head" id="country-grid"><h3>국가 목록</h3><span class="count">${list.length}개국</span></div>
    <div class="grid">${list.map(countryCardHTML).join('')}</div>
  `;
  renderWorldMap(list);
}

function renderWorldMap(list){
  const el = document.getElementById('world-map');
  if(!el) return;
  const pts = [];
  list.forEach(c=>c.points.forEach((p,i)=>pts.push({...p, _cid:c.id, _first:i===0, _label:c.flag+' '+c.name})));
  renderMap({ id:'__world_'+activeContinent, points:pts }, null, {
    el,
    onPick: p => openCountry(p._cid),
    labelOf: p => p._first ? p._label : null,
    labelClass: 'world',
    pad: 1.12, markerScale: 0.55,
    caption: '휠·핀치로 확대 · 드래그로 이동 · 점이나 국가 이름을 누르면 상세 페이지로 이동'
  });
}

function setContinent(ct){ activeContinent = ct; renderBrowse(); }
function switchTab(tab){
  currentTab = tab; currentDetail = null;
  document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  if(tab==='browse') renderBrowse(); else renderSearch();
  window.scrollTo({top:0, behavior:'instant'});
}
document.querySelectorAll('nav.tabs button').forEach(b=>b.addEventListener('click', ()=>switchTab(b.dataset.tab)));

/* ---------- Country Detail ---------- */
function openCountry(id){
  currentDetail = COUNTRIES.find(c=>c.id===id);
  currentArea = null;
  mapState.view = null; mapState.cid = null; mapState.focusArea = false;
  renderDetail();
  window.scrollTo({top:0, behavior:'instant'});
}

function switchArea(name){
  currentArea = name;
  mapState.focusArea = true;
  renderDetail();
}


/* ---------- Interactive map: zoom / pan / area highlight ---------- */
let mapState = { cid:null, view:null, focusArea:false, raf:null, dragged:false };
let MAP_ASPECT = 700/320;

function mapFitBounds(pts, pad, minHalf){
  const lats = pts.map(p=>p.lat), lngs = pts.map(p=>p.lng);
  const midLat = (Math.min(...lats)+Math.max(...lats))/2;
  const midLng = (Math.min(...lngs)+Math.max(...lngs))/2;
  let halfLat = Math.max((Math.max(...lats)-Math.min(...lats))/2, minHalf) * pad;
  let halfLng = Math.max((Math.max(...lngs)-Math.min(...lngs))/2, minHalf) * pad;
  if(halfLng / halfLat < MAP_ASPECT){ halfLng = halfLat * MAP_ASPECT; } else { halfLat = halfLng / MAP_ASPECT; }
  return { x:midLng-halfLng, y:-(midLat+halfLat), w:halfLng*2, h:halfLat*2 };
}

function renderMap(c, activeName, opt){
  opt = opt || {};
  const el = opt.el || document.getElementById('detail-map');
  if(!el) return;
  const pts = c.points.filter(p=>typeof p.lat === 'number' && typeof p.lng === 'number');
  if(pts.length === 0){ el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = '';
  if(el.clientWidth && el.clientHeight) MAP_ASPECT = el.clientWidth / el.clientHeight;
  if(mapState.raf){ cancelAnimationFrame(mapState.raf); mapState.raf = null; }

  const full = mapFitBounds(pts, opt.pad || 1.7, 0.5);
  const areaPts = pts.filter(p=>p.region===activeName);
  if(mapState.cid !== c.id || !mapState.view){ mapState.cid = c.id; mapState.view = {...full}; }
  const startView = {...mapState.view};
  const target = (mapState.focusArea && areaPts.length) ? mapFitBounds(areaPts, 2.2, 0.55) : null;
  mapState.focusArea = false;
  const minW = 0.06, maxW = Math.min(full.w*3, 360);

  let markers = '';
  pts.forEach((p,i)=>{
    const on = p.region===activeName;
    if(on) markers += `<circle class="map-pulse" data-idx="${i}" cx="${p.lng}" cy="${-p.lat}" r="1"/>`;
  });
  pts.forEach((p,i)=>{
    const on = p.region===activeName;
    markers += `<circle class="map-marker ${activeName==null?'':(on?'active':'dim')}" data-idx="${i}" cx="${p.lng}" cy="${-p.lat}" r="1"><title>${p.name}</title></circle>`;
  });

  el.innerHTML = `<svg class="map-svg" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;">
      <rect class="map-sea" x="-400" y="-200" width="800" height="400" fill="#0c232a"/>
      <path d="${WORLD_LAND_PATH}" fill="#1c454d" stroke="#3a6b73" stroke-width="0.8" vector-effect="non-scaling-stroke" fill-rule="evenodd"/>
      ${markers}
    </svg>
    ${areaPts.length ? `<div class="map-chip"><span class="map-chip-dot"></span>${activeName} · ${areaPts.length}개 포인트</div>` : ''}
    <div class="map-ctrl">
      <button type="button" data-act="in" title="확대">+</button>
      <button type="button" data-act="out" title="축소">−</button>
      ${areaPts.length ? '<button type="button" data-act="area" title="선택 지역으로">◎</button>' : ''}
      <button type="button" data-act="full" title="전체 보기">⤢</button>
    </div>
    <div class="map-caption">${opt.caption || '휠·핀치로 확대 · 드래그로 이동 · 점을 누르면 해당 지역 선택'}</div>`;

  const svg = el.querySelector('svg');
  const markerEls = Array.from(el.querySelectorAll('.map-marker'));
  const pulseEls = Array.from(el.querySelectorAll('.map-pulse'));

  const pick = p => opt.onPick ? opt.onPick(p) : selectAreaFromMap(p.region);
  const labels = pts.map((p,i)=>{
    const on = p.region===activeName;
    const text = opt.labelOf ? opt.labelOf(p,i) : (p.name.length > 16 ? p.name.slice(0,15)+'…' : p.name);
    if(text == null) return null;
    const label = document.createElement('div');
    label.className = 'map-label ' + (activeName==null ? (opt.labelClass||'') : (on ? 'active' : 'dim'));
    label.textContent = text;
    label.addEventListener('click', ()=>{ if(!mapState.dragged) pick(p); });
    el.appendChild(label);
    return label;
  });

  function apply(v){
    mapState.view = v;
    svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    const Wpx = el.clientWidth || 700;
    const r = Math.max(Math.min(Math.max(Wpx/130, 5.5), 9) * (opt.markerScale || 1), 3) * v.w / Wpx;
    markerEls.forEach(m=>{
      const on = m.classList.contains('active');
      m.setAttribute('r', (on ? r*1.35 : r).toFixed(5));
    });
    pulseEls.forEach(m=> m.setAttribute('r', (r*1.35).toFixed(5)));
    placeLabels(v);
  }

  // label layout: selected-area labels first, then others; try above, then below the dot; hide if it would overlap
  let labelSizes = null;
  const order = pts.map((p,i)=>i).sort((a,b)=> (pts[b].region===activeName) - (pts[a].region===activeName));
  function placeLabels(v){
    const W = el.clientWidth, H = el.clientHeight;
    if(!labelSizes){
      labels.forEach(l=>{ if(l){ l.style.display=''; l.classList.remove('below'); } });
      labelSizes = labels.map(l=> l ? { w:l.offsetWidth, h:l.offsetHeight } : null);
    }
    const placed = [];
    const hit = r => placed.some(q => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
    // dots also block labels
    const dots = pts.map(p=>({ x:(p.lng - v.x)/v.w*W, y:(-p.lat - v.y)/v.h*H }));
    order.forEach(i=>{
      const lab = labels[i], d = dots[i], s = labelSizes[i];
      if(!lab) return;
      if(d.x < -10 || d.x > W+10 || d.y < 10 || d.y > H+10){ lab.style.display = 'none'; return; }
      const cx = Math.min(Math.max(d.x, s.w/2 + 3), W - s.w/2 - 3);
      const above = { x0:cx - s.w/2 - 2, x1:cx + s.w/2 + 2, y0:d.y - 9 - s.h - 1, y1:d.y - 7 };
      const below = { x0:above.x0, x1:above.x1, y0:d.y + 7, y1:d.y + 9 + s.h + 1 };
      let pos = null;
      if(!hit(above)) pos = 'above'; else if(!hit(below)) pos = 'below';
      if(!pos){ lab.style.display = 'none'; return; }
      placed.push(pos==='above' ? above : below);
      lab.style.display = '';
      lab.classList.toggle('below', pos==='below');
      const lx = Math.min(Math.max(d.x, s.w/2 + 3), W - s.w/2 - 3);
      lab.style.left = (lx / W * 100).toFixed(3) + '%';
      lab.style.top = (d.y / H * 100).toFixed(3) + '%';
    });
  }

  function clampView(v){
    let w = Math.min(Math.max(v.w, minW), maxW), h = w / MAP_ASPECT;
    const cx = v.x + v.w/2, cy = v.y + v.h/2;
    const lim = { x0: full.x - full.w, x1: full.x + full.w*2, y0: full.y - full.h, y1: full.y + full.h*2 };
    const ncx = Math.min(Math.max(cx, lim.x0), lim.x1), ncy = Math.min(Math.max(cy, lim.y0), lim.y1);
    return { x: ncx - w/2, y: ncy - h/2, w, h };
  }

  function animateTo(to, ms=650){
    if(mapState.raf) cancelAnimationFrame(mapState.raf);
    const from = {...mapState.view}, t0 = performance.now();
    const ease = t => t<.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
    const step = now=>{
      const t = Math.min((now - t0)/ms, 1), k = ease(t);
      apply({ x: from.x+(to.x-from.x)*k, y: from.y+(to.y-from.y)*k, w: from.w+(to.w-from.w)*k, h: from.h+(to.h-from.h)*k });
      mapState.raf = t < 1 ? requestAnimationFrame(step) : null;
    };
    mapState.raf = requestAnimationFrame(step);
  }

  function zoomAt(fx, fy, s){
    const v = mapState.view;
    const nv = clampView({ w: v.w*s, h: v.h*s, x: v.x + fx*(v.w - v.w*s), y: v.y + fy*(v.h - v.h*s) });
    // keep the anchor point fixed when zoom was clamped
    const realS = nv.w / v.w;
    nv.x = v.x + fx*(v.w - v.w*realS); nv.y = v.y + fy*(v.h - v.h*realS);
    apply(clampView(nv));
  }
  function stopAnim(){ if(mapState.raf){ cancelAnimationFrame(mapState.raf); mapState.raf = null; } }

  // wheel zoom
  el.addEventListener('wheel', e=>{
    e.preventDefault(); stopAnim();
    const rect = el.getBoundingClientRect();
    const dy = e.deltaMode === 1 ? e.deltaY*16 : e.deltaY;
    zoomAt((e.clientX-rect.left)/rect.width, (e.clientY-rect.top)/rect.height, Math.exp(dy*0.0018));
  }, {passive:false});

  // double click zoom in
  el.addEventListener('dblclick', e=>{
    if(e.target.closest('.map-ctrl')) return;
    const rect = el.getBoundingClientRect();
    stopAnim(); zoomAt((e.clientX-rect.left)/rect.width, (e.clientY-rect.top)/rect.height, 0.5);
  });

  // drag pan + pinch zoom (pointer events: mouse, touch, pen)
  const ptrs = new Map();
  let last = null;
  const pinchInfo = ()=>{
    const [a,b] = Array.from(ptrs.values());
    return { d: Math.hypot(a.x-b.x, a.y-b.y), mx:(a.x+b.x)/2, my:(a.y+b.y)/2 };
  };
  function onMove(e){
    if(!ptrs.has(e.pointerId)) return;
    const prev = ptrs.get(e.pointerId);
    ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
    const rect = el.getBoundingClientRect(), v = mapState.view;
    if(ptrs.size === 1){
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      if(Math.abs(dx)+Math.abs(dy) > 0) { if(!mapState.dragged && Math.hypot(e.clientX-last.sx, e.clientY-last.sy) > 5) mapState.dragged = true; }
      if(mapState.dragged){
        apply(clampView({ x: v.x - dx/rect.width*v.w, y: v.y - dy/rect.height*v.h, w:v.w, h:v.h }));
        el.classList.add('dragging');
      }
    } else if(ptrs.size === 2 && last && last.pinch){
      const now = pinchInfo();
      mapState.dragged = true;
      // pan by midpoint shift, then zoom around midpoint
      const pv = clampView({ x: v.x - (now.mx-last.pinch.mx)/rect.width*v.w, y: v.y - (now.my-last.pinch.my)/rect.height*v.h, w:v.w, h:v.h });
      apply(pv);
      if(now.d > 0) zoomAt((now.mx-rect.left)/rect.width, (now.my-rect.top)/rect.height, last.pinch.d/now.d);
      last.pinch = now;
    }
  }
  function onUp(e){
    ptrs.delete(e.pointerId);
    if(ptrs.size === 2) last.pinch = pinchInfo();
    else if(last) last.pinch = null;
    if(ptrs.size === 0){
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.classList.remove('dragging');
      // let the click handler see "dragged", then reset
      setTimeout(()=>{ mapState.dragged = false; }, 0);
    }
  }
  el.addEventListener('pointerdown', e=>{
    if(e.target.closest('.map-ctrl')) return;
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    stopAnim();
    if(ptrs.size === 0){
      mapState.dragged = false;
      last = { sx:e.clientX, sy:e.clientY, pinch:null };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    }
    ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(ptrs.size === 2) last.pinch = pinchInfo();
  });

  // controls
  el.querySelector('.map-ctrl').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    const v = mapState.view, act = b.dataset.act;
    if(act === 'in')  animateTo(clampView({ w:v.w*0.55, h:v.h*0.55, x:v.x+v.w*0.225, y:v.y+v.h*0.225 }), 300);
    if(act === 'out') animateTo(clampView({ w:v.w/0.55, h:v.h/0.55, x:v.x-(v.w/0.55-v.w)/2, y:v.y-(v.h/0.55-v.h)/2 }), 300);
    if(act === 'full') animateTo(full);
    if(act === 'area' && areaPts.length) animateTo(mapFitBounds(areaPts, 2.2, 0.55));
  });

  // markers
  markerEls.forEach(m=>{
    m.addEventListener('click', ()=>{
      if(mapState.dragged) return;
      pick(pts[parseInt(m.getAttribute('data-idx'))]);
    });
  });

  // keep the view undistorted if the map box changes shape (rotation, resize)
  if(window.ResizeObserver){
    if(mapState.ro) mapState.ro.disconnect();
    mapState.ro = new ResizeObserver(()=>{
      if(!el.isConnected || !el.clientWidth || !el.clientHeight) return;
      const a = el.clientWidth / el.clientHeight;
      if(Math.abs(a - MAP_ASPECT) < 0.01) return;
      MAP_ASPECT = a; labelSizes = null;
      const v = mapState.view, cy = v.y + v.h/2;
      apply({ x:v.x, w:v.w, h:v.w/a, y: cy - v.w/a/2 });
    });
    mapState.ro.observe(el);
  }
  // if the stored view came from a different box shape, re-fit its height
  if(Math.abs(startView.w/startView.h - MAP_ASPECT) > 0.01){ const cy = startView.y + startView.h/2; startView.h = startView.w/MAP_ASPECT; startView.y = cy - startView.h/2; }
  apply(startView);
  if(target) animateTo(target);
}

function selectAreaFromMap(name){
  switchArea(name);
  const tabs = document.querySelector('.area-tabs');
  const t = tabs && tabs.querySelector('.area-tab.active');
  if(t) t.scrollIntoView({block:'nearest', inline:'center', behavior:'smooth'});
}

function renderDetail(){
  const c = currentDetail;
  root.innerHTML = `
    <span class="back-link" onclick="switchTab('${currentTab==='search'?'search':'browse'}')">← 목록으로</span>
    <div class="detail-head">
      <div>
        <h2 class="display">${c.flag} ${c.name}</h2>
        <div class="sub">${c.regions}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:12.5px;color:var(--muted);margin-bottom:4px;">추천 여행 월</div>
        <div style="font-family:'IBM Plex Mono',monospace;color:var(--bioline);font-size:13.5px;">${c.bestMonths}</div>
      </div>
    </div>

    <div class="stat-cards">
      <div class="sc"><div class="k">평균 수온</div><div class="v">${c.temp}</div></div>
      <div class="sc"><div class="k">평균 시야</div><div class="v">${c.viz}</div></div>
      <div class="sc"><div class="k">초보자 적합도</div><div class="v">${STARS(c.suit.beginner)}</div></div>
      <div class="sc"><div class="k">프리다이빙 적합도</div><div class="v">${STARS(c.suit.free)}</div></div>
      <div class="sc"><div class="k">스쿠버 적합도</div><div class="v">${STARS(c.suit.scuba)}</div></div>
    </div>

    <p class="summary-text">${c.summary}</p>

    <div id="detail-map" class="dive-map"></div>

    <h3 class="subhead">대표 프리다이빙 / 스쿠버 포인트</h3>
    ${(() => {
      const areas = getAreas(c);
      const active = areas.find(a=>a.name===currentArea) || areas[0];
      return `
      <div class="area-tabs">
        ${areas.map(a=>`
          <div class="area-tab ${a===active?'active':''}" onclick="switchArea('${a.name.replace(/'/g,"\\'")}')">
            <div class="area-tab-name">${a.name}</div>
            <div class="area-tab-preview">${a.preview}</div>
          </div>
        `).join('')}
      </div>
      ${active.points.map(p=>`
      <div class="point-card">
        <div class="pname display">${p.name}</div>
        <div class="pmeta">${p.region} · 입수:${p.entry} · 평균수심 ${p.avgDepth} · 최대수심 ${p.maxDepth} · 시야 ${p.viz} · 추천레벨 ${p.level}</div>
        <div class="pnote">${p.note}</div>
        <div class="pnote"><strong style="color:var(--bioline);">프리다이버 팁 —</strong> ${p.free_tips}</div>
        <div class="pnote"><strong style="color:var(--coral);">스쿠버다이버 팁 —</strong> ${p.scuba_tips}</div>
        <div class="rating-row">
          <span><span class="rlabel">프리다이빙</span>${STARS(p.free)}</span>
          <span><span class="rlabel">스쿠버다이빙</span>${STARS(p.scuba)}</span>
        </div>
        <div class="rating-row" style="margin-top:10px;">
          ${Object.entries(p.caution).map(([k,v])=>`<span><span class="rlabel">${k}</span><span class="${cautionClass(v)}">${v}</span></span>`).join('')}
        </div>
      </div>
      `).join('')}
      `;
    })()}

    <h3 class="subhead">월별 관찰 가능한 해양생물</h3>
    <div class="legend">
      <span><span class="dot" style="background:var(--bioline);"></span>피크 시즌</span>
      <span><span class="dot" style="background:rgba(89,230,200,.35);"></span>관찰 가능</span>
      <span><span class="dot" style="background:var(--line);"></span>관찰 어려움</span>
    </div>
    <div class="cal-wrap">
      <div class="cal">
        <div class="hcell"></div>
        ${['1','2','3','4','5','6','7','8','9','10','11','12'].map(m=>`<div class="hcell">${m}월</div>`).join('')}
        ${c.creatures.map(cr=>`<div class="name-cell">${cr.name}${cr.conf==='확인 필요'?'<span class="confirm-tag">확인 필요</span>':''}</div>${monthDots(cr.months, cr.peak)}`).join('')}
      </div>
    </div>
    <div style="margin-top:16px;">
      ${c.creatures.map(cr=>`
        <div class="point-card" style="padding:14px 18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div><strong>${cr.name}</strong> <span style="color:var(--muted); font-size:12px;">(${cr.en})</span></div>
            <div style="font-size:12px; color:var(--muted);">신뢰도: <span style="color:${cr.conf==='높음'?'#7fd99a':cr.conf==='확인 필요'?'var(--amber)':'var(--muted)'}">${cr.conf}</span></div>
          </div>
          <div class="pnote" style="margin-top:6px;">${cr.desc}</div>
          <div class="rating-row" style="margin-top:8px;">
            <span><span class="rlabel">프리</span>${STARS(cr.free)}</span>
            <span><span class="rlabel">스쿠버</span>${STARS(cr.scuba)}</span>
            <span><span class="rlabel">주의 정도</span><span class="${cautionClass(cr.caution)}">${cr.caution}</span></span>
          </div>
          ${wikiPhotoLink(cr.en)}
        </div>
      `).join('')}
    </div>

    <h3 class="subhead">주의사항</h3>
    ${renderCautionTable(c.cautions)}

    <div class="safety-box">
      <div class="stitle display">안전 및 환경 보호 안내</div>
      <ul>
        <li>프리다이빙은 반드시 버디와 함께 진행하며, 절대 혼자 입수하지 않습니다.</li>
        <li>과호흡은 블랙아웃 위험을 높이므로 피해야 합니다.</li>
        <li>현지 기상·조류·파도 상황을 입수 전 반드시 확인하세요.</li>
        <li>초보자는 공인 강사 또는 현지 가이드 동반을 권장합니다.</li>
        <li>해양생물을 만지거나 쫓거나 먹이를 주지 않으며, 이동 경로를 막지 않습니다.</li>
        <li>산호·해초·해저 지형을 훼손하지 않도록 부력과 핀킥에 주의합니다.</li>
        <li>보호구역에서는 입수·촬영이 제한될 수 있으니 사전 허가 여부를 확인하세요.</li>
        <li>실제 여행 전 현지 다이빙 센터와 정부 관광청의 최신 공식 정보를 확인하세요.</li>
      </ul>
    </div>

    <div class="footer-next">
      <button class="btn" onclick="switchTab('search')">조건으로 다른 곳 찾아보기</button>
      <button class="btn" onclick="switchTab('browse')">국가 목록으로 돌아가기</button>
    </div>
  `;
  const _areas = getAreas(c);
  renderMap(c, (_areas.find(a=>a.name===currentArea) || _areas[0] || {}).name);
}

/* ---------- Condition Search ---------- */
// species groups: one dropdown entry matches every regional variant (e.g. 혹등고래(모레아), 혹등고래(닝갈루 스윔))
const CREATURE_GROUPS = [
  ['고래상어', ['고래상어']],
  ['만타레이·모블라가오리', ['만타','모블라']],
  ['귀상어(해머헤드)', ['귀상어','해머헤드']],
  ['혹등고래', ['혹등고래']],
  ['돌고래', ['돌고래']],
  ['바다거북', ['바다거북','매부리거북','초록·매부리']],
  ['정어리떼', ['정어리']],
  ['황소상어', ['황소상어']],
  ['뱀상어', ['뱀상어']],
  ['암초상어·너스상어', ['암초상어','화이트팁리프','화이트팁','너스상어']],
  ['바다사자·물개·물범', ['바다사자','물개','물범']],
  ['개복치(몰라몰라)', ['개복치','몰라몰라']],
  ['바라쿠다·잭피시 무리', ['바라쿠다','잭피시']],
  ['다금바리·그루퍼', ['다금바리','그루퍼']],
  ['연산호·산호 군락', ['연산호','고르고니안','돌산호','붉은산호']],
  ['매크로 생물', ['매크로','갯민숭']],
  ['기타 고래(밍크·향유·들쇠)', ['밍크고래','향유고래','들쇠고래']]
];
function creatureKeywords(sel){
  const g = CREATURE_GROUPS.find(x=>x[0]===sel);
  return g ? g[1] : [sel];
}
function creatureMatches(cr, sel){
  const g = CREATURE_GROUPS.find(x=>x[0]===sel);
  return g ? g[1].some(k=>cr.name.includes(k)) : cr.name===sel;
}
function allCreatureNames(){
  const grouped = CREATURE_GROUPS.filter(([label])=>COUNTRIES.some(c=>c.creatures.some(cr=>creatureMatches(cr,label)))).map(g=>g[0]);
  const rest = new Set();
  COUNTRIES.forEach(c=>c.creatures.forEach(cr=>{ if(!CREATURE_GROUPS.some(([label])=>creatureMatches(cr,label))) rest.add(cr.name); }));
  return [...grouped, ...Array.from(rest).sort()];
}

function renderSearch(){
  const creatureOpts = allCreatureNames();
  root.innerHTML = `
    <div class="section-head" style="margin-top:26px;"><h3>조건으로 추천받기</h3></div>
    <div class="search-panel">
      <div class="field-grid">
        <div class="field">
          <label>여행 월</label>
          <select id="f-month">
            <option value="0">상관없음</option>
            ${Array.from({length:12},(_,i)=>i+1).map(m=>`<option value="${m}">${m}월</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>보고 싶은 생물</label>
          <select id="f-creature">
            <option value="">상관없음</option>
            ${creatureOpts.map(n=>`<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>다이빙 방식</label>
          <select id="f-mode">
            <option value="both">프리 + 스쿠버 모두</option>
            <option value="free">프리다이빙</option>
            <option value="scuba">스쿠버다이빙</option>
          </select>
        </div>
        <div class="field">
          <label>사용자 레벨</label>
          <select id="f-level">
            <option value="">상관없음</option>
            ${LEVELS.map(l=>`<option value="${l}">${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn primary" onclick="runSearch()">추천 국가 찾기</button>
    </div>
    <div id="search-results"></div>
  `;
  document.getElementById('search-results').innerHTML = `<p style="color:var(--muted); font-size:13.5px;">조건을 선택하고 '추천 국가 찾기'를 눌러주세요.</p>`;
}

function bestPointFor(c, creatureName){
  if(creatureName){
    const kws = creatureKeywords(creatureName).concat(creatureName.replace(/\(.*?\)/g,'').split('·').map(x=>x.trim()).filter(x=>x.length>1));
    const hit = c.points.find(p => p.preview && kws.some(k=>p.preview.includes(k)));
    if(hit) return hit;
  }
  return c.points[0];
}

function runSearch(){
  const month = parseInt(document.getElementById('f-month').value);
  const creature = document.getElementById('f-creature').value;
  const mode = document.getElementById('f-mode').value;
  const level = document.getElementById('f-level').value;

  let scored = COUNTRIES.map(c=>{
    let score = 0;
    let matchedCreature = null;
    let matchedMonthOK = true;

    if(creature){
      // among this country's matching variants, prefer the one whose season fits the chosen month
      const cands = c.creatures.filter(cr=>creatureMatches(cr, creature));
      const fit = cr => !month ? 0 : (cr.peak && cr.peak.includes(month)) ? 2 : (cr.months && cr.months.includes(month)) ? 1 : 0;
      matchedCreature = cands.sort((x,y)=>fit(y)-fit(x))[0];
      if(!matchedCreature){ score -= 100; }
      else{
        score += 10;
        if(month){
          if(matchedCreature.peak && matchedCreature.peak.includes(month)){ score += 8; matchedMonthOK = true; }
          else if(matchedCreature.months && matchedCreature.months.includes(month)){ score += 4; matchedMonthOK = true; }
          else { score -= 6; matchedMonthOK = false; }
        }
      }
    } else if(month){
      // no specific creature: score by how many creatures peak this month
      const peakCount = c.creatures.filter(cr=>cr.peak && cr.peak.includes(month)).length;
      const okCount = c.creatures.filter(cr=>cr.months && cr.months.includes(month)).length;
      score += peakCount*5 + okCount*2;
    }

    if(mode==='free') score += c.suit.free;
    else if(mode==='scuba') score += c.suit.scuba;
    else score += (c.suit.free + c.suit.scuba)/2;

    if(level){
      const idx = LEVELS.indexOf(level);
      if(idx<=1) score += c.suit.beginner; // 입문/초급 -> 초보자 적합도 가중
    }

    return {c, score, matchedCreature, matchedMonthOK};
  });

  scored = scored.filter(s=>s.score > -50);
  scored.sort((a,b)=>b.score-a.score);
  const top5 = scored.slice(0,8);

  const condRows = `
    <table style="margin-bottom:24px;">
      <tbody>
        <tr><td style="width:140px;color:var(--muted);">여행 월</td><td>${month?month+'월':'상관없음'}</td></tr>
        <tr><td style="color:var(--muted);">보고 싶은 생물</td><td>${creature||'상관없음'}</td></tr>
        <tr><td style="color:var(--muted);">다이빙 방식</td><td>${mode==='both'?'프리+스쿠버 모두':mode==='free'?'프리다이빙':'스쿠버다이빙'}</td></tr>
        <tr><td style="color:var(--muted);">사용자 레벨</td><td>${level||'상관없음'}</td></tr>
      </tbody>
    </table>`;

  const resultRows = top5.map((s,i)=>{
    const c = s.c;
    const rep = s.matchedCreature ? s.matchedCreature.name : c.creatures[0].name;
    const avail = s.matchedCreature ? (s.matchedMonthOK ? (s.matchedCreature.peak.includes(month)?'높음':'보통') : '낮음') : '보통';
    return `
    <tr class="result-row" onclick="openCountry('${c.id}')">
      <td class="rank">${i+1}</td>
      <td><strong>${c.flag} ${c.name}</strong><br/><span style="color:var(--muted); font-size:12px;">${c.regions}</span></td>
      <td>${bestPointFor(c, creature).name}</td>
      <td>${rep}</td>
      <td>${avail}</td>
      <td>${STARS(c.suit.free)}</td>
      <td>${STARS(c.suit.scuba)}</td>
    </tr>`;
  }).join('');

  const best = top5[0];
  const bestReasonCreature = best ? (best.matchedCreature ? best.matchedCreature.name : best.c.creatures[0].name) : '';

  document.getElementById('search-results').innerHTML = `
    <h3 class="subhead">검색 조건</h3>
    ${condRows}
    <h3 class="subhead">추천 국가 TOP ${top5.length}</h3>
    <div style="overflow-x:auto;">
    <table>
      <thead><tr><th></th><th>국가</th><th>추천 포인트</th><th>대표 생물</th><th>관찰 가능성</th><th>프리 적합도</th><th>스쿠버 적합도</th></tr></thead>
      <tbody>${resultRows || '<tr><td colspan="7" style="color:var(--muted);">조건에 맞는 국가를 찾지 못했습니다. 조건을 조정해보세요.</td></tr>'}</tbody>
    </table>
    </div>
    ${best ? `
    <div class="pick-best">
      <div class="eyebrow">가장 추천하는 선택</div>
      <h3 class="display" style="margin:0 0 10px; font-size:22px; cursor:pointer;" onclick="openCountry('${best.c.id}')">${best.c.flag} ${best.c.name} — ${bestPointFor(best.c, creature).name}</h3>
      <p style="color:#dcebe9; font-size:14px; line-height:1.8; margin:0 0 12px;">
        ${creature? `'${bestReasonCreature}'를 목표로 한다면 ` : ''}${best.c.name}이(가) 현재 조건에 가장 잘 맞습니다. ${month? `${month}월 기준 ` : ''}${best.c.bestMonths}이(가) 추천 시기이며, 프리다이빙 적합도 ${best.c.suit.free}점, 스쿠버다이빙 적합도 ${best.c.suit.scuba}점, 초보자 적합도 ${best.c.suit.beginner}점입니다. 자세한 포인트별 정보와 주의사항은 국가 상세 도감에서 확인하세요.
      </p>
      <button class="btn primary" onclick="openCountry('${best.c.id}')">${best.c.name} 상세 도감 보기</button>
    </div>` : ''}
  `;
}

renderBrowse();
