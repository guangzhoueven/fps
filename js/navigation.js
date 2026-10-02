// ============================================================================
// NAVIGATION — grid + A* pathfinding
// ============================================================================
const NAV_CELL = 0.5;                 // grid cell size (world units)
const NAV_W = 200, NAV_H = 200;       // covers the 100x100 floor (-50..50)
const NAV_N = NAV_W * NAV_H;
const SQRT2 = Math.SQRT2;
const _NAV_DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const navGrids = [];                  // [{inflate, blocked: Uint8Array, doorCells: Map}]
let navReady = false;

function navIdxOf(x, z){
  const gx = Math.floor((x + 50) / NAV_CELL), gz = Math.floor((z + 50) / NAV_CELL);
  if(gx < 0 || gz < 0 || gx >= NAV_W || gz >= NAV_H) return -1;
  return gz * NAV_W + gx;
}
function navWorldOf(idx, out){
  out.x = ((idx % NAV_W) + 0.5) * NAV_CELL - 50;
  out.z = (((idx / NAV_W) | 0) + 0.5) * NAV_CELL - 50;
}
// Grid cells covered by a world-space box, inflated by r (enemy radius)
function navCellsForBox(box, r, out){
  out.length = 0;
  const minGX = Math.max(0, Math.floor((box.min.x - r + 50) / NAV_CELL));
  const maxGX = Math.min(NAV_W - 1, Math.floor((box.max.x + r + 50) / NAV_CELL));
  const minGZ = Math.max(0, Math.floor((box.min.z - r + 50) / NAV_CELL));
  const maxGZ = Math.min(NAV_H - 1, Math.floor((box.max.z + r + 50) / NAV_CELL));
  for(let gz = minGZ; gz <= maxGZ; gz++)
    for(let gx = minGX; gx <= maxGX; gx++)
      out.push(gz * NAV_W + gx);
}
const _navBoxKey = b => b.min.x + ',' + b.min.y + ',' + b.min.z + ',' + b.max.x + ',' + b.max.y + ',' + b.max.z;
const _navCellsTmp = [];

function buildNavGrids(){
  navGrids.length = 0;
  // Three grids sized for: small enemies (grunt/runner/shooter/phantom), brute/tank, boss
  for(const inflate of [0.4, 0.85, 1.3]){
    const grid = { inflate, blocked: new Uint8Array(NAV_N), doorCells: new Map() };
    const doorKeys = new Set(doors.map(d => _navBoxKey(d.collisionBox)));
    for(const col of wallColliders){
      if(!col || doorKeys.has(_navBoxKey(col))) continue; // doors are handled dynamically
      navCellsForBox(col, inflate, _navCellsTmp);
      for(const idx of _navCellsTmp) grid.blocked[idx] = 1;
    }
    for(const d of doors){
      const cells = [];
      navCellsForBox(d.collisionBox, inflate, cells);
      grid.doorCells.set(d, cells);
      if(!d.isOpen) for(const idx of cells) grid.blocked[idx] = 1;
    }
    navGrids.push(grid);
  }
  navReady = true;
}
// Door open/close → flip its cells in every grid
function navSetDoor(door, isOpen){
  if(!navReady) return;
  const db = door.collisionBox;
  for(const grid of navGrids){
    const cells = grid.doorCells.get(door);
    if(!cells) continue;
    for(const idx of cells){
      if(isOpen){
        // Unblock — unless the cell is ALSO covered by a non-frame collider (a rock, container or
        // neighbouring wall passing through the doorway footprint). Frame walls (the segments this
        // doorway was cut into) keep their old behaviour: their inflated cells were always unblocked.
        const cx = ((idx % NAV_W) + 0.5) * NAV_CELL - 50;
        const cz = (((idx / NAV_W) | 0) + 0.5) * NAV_CELL - 50;
        const h = NAV_CELL * 0.5;
        let blocked = false;
        for(const col of wallColliders){
          if(!col || col === door.colliderRef) continue;
          if(!(cx + h >= col.min.x - grid.inflate && cx - h <= col.max.x + grid.inflate &&
               cz + h >= col.min.z - grid.inflate && cz - h <= col.max.z + grid.inflate)) continue;
          const isFrame = col.max.x >= db.min.x - 0.15 && col.min.x <= db.max.x + 0.15 &&
                          col.max.z >= db.min.z - 0.15 && col.min.z <= db.max.z + 0.15 &&
                          col.max.y >= db.min.y - 0.15 && col.min.y <= db.max.y + 0.15;
          if(!isFrame){ blocked = true; break; }
        }
        grid.blocked[idx] = blocked ? 1 : 0;
      } else grid.blocked[idx] = 1;
    }
  }
}
// Free cells again when an explosive barrel is removed
function navUnblockBox(box){
  if(!navReady) return;
  for(const grid of navGrids){
    navCellsForBox(box, grid.inflate, _navCellsTmp);
    for(const idx of _navCellsTmp) grid.blocked[idx] = 0;
  }
}

// --- A* over a nav grid (shared workspace, generation-stamped arrays) ---
const _asG = new Float32Array(NAV_N);
const _asF = new Float32Array(NAV_N);
const _asParent = new Int32Array(NAV_N);
const _asState = new Uint8Array(NAV_N);   // 0 unseen, 1 open, 2 closed
const _asGen = new Int32Array(NAV_N);
let _asGenCounter = 0;
const _asHeap = new Int32Array(NAV_N + 8);
let _asHeapSize = 0;
function _asPush(node){
  let i = ++_asHeapSize;
  _asHeap[i] = node;
  while(i > 1){
    const p = i >> 1;
    if(_asF[_asHeap[p]] <= _asF[_asHeap[i]]) break;
    const t = _asHeap[p]; _asHeap[p] = _asHeap[i]; _asHeap[i] = t;
    i = p;
  }
}
function _asPop(){
  const top = _asHeap[1];
  _asHeap[1] = _asHeap[_asHeapSize--];
  let i = 1;
  for(;;){
    const l = i << 1, r = l + 1;
    let m = i;
    if(l <= _asHeapSize && _asF[_asHeap[l]] < _asF[_asHeap[m]]) m = l;
    if(r <= _asHeapSize && _asF[_asHeap[r]] < _asF[_asHeap[m]]) m = r;
    if(m === i) break;
    const t = _asHeap[m]; _asHeap[m] = _asHeap[i]; _asHeap[i] = t;
    i = m;
  }
  return top;
}
const _asWp = {x:0, z:0};
function findNearestOpenCell(grid, idx){
  if(idx < 0) return -1;
  if(!grid.blocked[idx]) return idx;
  const gx = idx % NAV_W, gz = (idx / NAV_W) | 0;
  for(let r = 1; r <= 8; r++){
    for(let dz = -r; dz <= r; dz++){
      for(let dx = -r; dx <= r; dx++){
        if(Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const nx = gx + dx, nz = gz + dz;
        if(nx < 0 || nz < 0 || nx >= NAV_W || nz >= NAV_H) continue;
        const ni = nz * NAV_W + nx;
        if(!grid.blocked[ni]) return ni;
      }
    }
  }
  return -1;
}
// Returns [{x,z}, ...] world waypoints start→goal, or null on failure
function astar(grid, sIdx, gIdx, maxExpand){
  if(sIdx === gIdx) return null;
  const gen = ++_asGenCounter;
  _asHeapSize = 0;
  const blocked = grid.blocked;
  const gGX = gIdx % NAV_W, gGZ = (gIdx / NAV_W) | 0;
  const hEst = (x, z) => { const dx = Math.abs(x - gGX), dz = Math.abs(z - gGZ); return dx + dz + (SQRT2 - 2) * Math.min(dx, dz); };
  _asGen[sIdx] = gen; _asState[sIdx] = 1; _asG[sIdx] = 0; _asParent[sIdx] = -1;
  _asF[sIdx] = hEst(sIdx % NAV_W, (sIdx / NAV_W) | 0);
  _asPush(sIdx);
  let expanded = 0, found = false;
  while(_asHeapSize > 0){
    const cur = _asPop();
    if(_asState[cur] === 2) continue; // stale heap entry
    if(cur === gIdx){ found = true; break; }
    _asState[cur] = 2;
    if(++expanded > maxExpand) break;
    const cx = cur % NAV_W, cz = (cur / NAV_W) | 0;
    for(let d = 0; d < 8; d++){
      const dx = _NAV_DIRS[d][0], dz = _NAV_DIRS[d][1];
      const nx = cx + dx, nz = cz + dz;
      if(nx < 0 || nz < 0 || nx >= NAV_W || nz >= NAV_H) continue;
      const ni = nz * NAV_W + nx;
      if(blocked[ni]) continue;
      if(dx !== 0 && dz !== 0 && (blocked[cz * NAV_W + nx] || blocked[nz * NAV_W + cx])) continue; // no corner cutting
      const ng = _asG[cur] + ((dx !== 0 && dz !== 0) ? SQRT2 : 1);
      if(_asGen[ni] !== gen){ _asGen[ni] = gen; _asState[ni] = 0; _asG[ni] = Infinity; }
      if(_asState[ni] === 2) continue;
      if(ng < _asG[ni]){
        _asG[ni] = ng; _asParent[ni] = cur; _asState[ni] = 1;
        _asF[ni] = ng + hEst(nx, nz) * 1.05; // slightly greedy → fewer expansions
        _asPush(ni);
      }
    }
  }
  if(!found) return null;
  const rev = [];
  let cur = gIdx;
  while(cur !== -1 && rev.length < 4000){ rev.push(cur); cur = _asParent[cur]; }
  rev.reverse(); // start → goal
  // World waypoints: skip the cell we're standing on, thin out to every 2nd cell
  const path = [];
  for(let i = 2; i < rev.length; i += 2){ navWorldOf(rev[i], _asWp); path.push({x:_asWp.x, z:_asWp.z}); }
  if(rev.length % 2 === 0){ navWorldOf(rev[rev.length - 1], _asWp); path.push({x:_asWp.x, z:_asWp.z}); }
  return path.length ? path : null;
}

// ============================================================================
// B* (Branch Star) — greedy goalward walk + branch-around-obstacle
// Explores far fewer cells than A*; paths are good but not always optimal.
// Returns [{x,z}, ...] start->goal waypoints (same shape as astar), or null.
// Modes: free = walk straight at the goal; on a wall -> branch two "crawlers"
// perpendicular that follow the wall until the goalward way reopens.
// ============================================================================
const _bsQCell = new Int32Array(NAV_N + 16);
const _bsQMeta = new Int32Array(NAV_N + 16);   // mode | wallside<<1 | dirIdx<<2
const _bsParent = new Int32Array(NAV_N);
const _bsVisit = new Int32Array(NAV_N);
let _bsGen = 0;
const _bsWp = {x:0, z:0};
function bstar(grid, sIdx, gIdx, maxExpand){
  if(sIdx < 0 || gIdx < 0 || sIdx === gIdx) return null;
  const blocked = grid.blocked;
  const gen = ++_bsGen;
  const gGX = gIdx % NAV_W, gGZ = (gIdx / NAV_W) | 0;
  let head = 0, tail = 0, steps = 0, found = -1;

  const stepOK = (c, dx, dz) => {
    if(dx === 0 && dz === 0) return false;
    const cx = c % NAV_W, cz = (c / NAV_W) | 0;
    const nx = cx + dx, nz = cz + dz;
    if(nx < 0 || nz < 0 || nx >= NAV_W || nz >= NAV_H) return false;
    const ni = nz * NAV_W + nx;
    if(blocked[ni]) return false;
    if(dx !== 0 && dz !== 0 && (blocked[cz * NAV_W + nx] || blocked[nz * NAV_W + cx])) return false;
    return true;
  };
  const enqueue = (ni, from, dirIdx, ws, mode) => {
    if(_bsVisit[ni] === gen) return;
    if(tail >= _bsQCell.length) return;
    _bsVisit[ni] = gen; _bsParent[ni] = from;
    _bsQCell[tail] = ni;
    _bsQMeta[tail] = mode | ((ws > 0 ? 1 : 0) << 1) | (dirIdx << 2);
    tail++;
  };
  const latBlocked = (x, z) => (x < 0 || z < 0 || x >= NAV_W || z >= NAV_H) ? true : blocked[z * NAV_W + x];

  _bsVisit[sIdx] = gen; _bsParent[sIdx] = -1;
  _bsQCell[0] = sIdx; _bsQMeta[0] = 0; tail = 1;

  while(head < tail && found < 0){
    if(steps >= maxExpand) return null;
    let cell = _bsQCell[head];
    const meta = _bsQMeta[head]; head++;
    let mode = meta & 1;
    let ws = (meta & 2) ? 1 : -1;
    const dirIdx = meta >> 2;

    runLoop: for(;;){
      if(steps >= maxExpand) return null;
      if(cell === gIdx){ found = cell; break; }
      const cx = cell % NAV_W, cz = (cell / NAV_W) | 0;
      const sdx = Math.sign(gGX - cx), sdz = Math.sign(gGZ - cz);

      // --- goalward step: diagonal first, then the two axis options ---
      let ni = -1;
      if(sdx !== 0 && sdz !== 0 && stepOK(cell, sdx, sdz)) ni = (cz + sdz) * NAV_W + (cx + sdx);
      else if(sdx !== 0 && stepOK(cell, sdx, 0)) ni = cz * NAV_W + (cx + sdx);
      else if(sdz !== 0 && stepOK(cell, 0, sdz)) ni = (cz + sdz) * NAV_W + cx;
      if(ni >= 0){
        if(ni === gIdx){ _bsParent[ni] = cell; found = ni; break; }
        if(_bsVisit[ni] !== gen){
          steps++;
          _bsVisit[ni] = gen; _bsParent[ni] = cell;
          cell = ni; mode = 0;               // crawl escaping -> converts to free walk
          continue;
        }
        if(mode === 0) break;                // free run merged into explored area -> done
        // crawl: goalward way already explored -> fall through and keep crawling
      }

      if(mode === 0){
        // --- wall ahead -> branch two crawlers perpendicular to goalward ---
        const dRefX = Math.abs(gGX - cx) >= Math.abs(gGZ - cz) ? sdx : 0;
        const dRefZ = dRefX === 0 ? sdz : 0;
        for(let sb = 1; sb >= -1; sb -= 2){
          const vx = sb === 1 ? -dRefZ : dRefZ;
          const vz = sb === 1 ? dRefX : -dRefX;
          if(!stepOK(cell, vx, vz)) continue;
          const ni2 = (cz + vz) * NAV_W + (cx + vx);
          if(ni2 === gIdx){ _bsParent[ni2] = cell; found = ni2; break runLoop; }
          enqueue(ni2, cell, ((vx + 1) << 2) | (vz + 1), -sb, 1);
        }
        break;                                 // run ends after branching
      }

      // --- crawl along the wall: forward, forward+away diagonal, away ---
      const dX = ((dirIdx >> 2) - 1), dZ = ((dirIdx & 3) - 1);
      // away = rot90(dir, -ws);  rot90(d,s): s=+1 -> (-dz,dx), s=-1 -> (dz,-dx)
      const aX = ws === -1 ? -dZ : dZ;
      const aZ = ws === -1 ? dX : -dX;
      let mX = dX + aX, mZ = dZ + aZ;         // normalize the diagonal combination
      if(Math.max(Math.abs(mX), Math.abs(mZ)) > 1){ mX = mX > 0 ? 1 : (mX < 0 ? -1 : 0); mZ = mZ > 0 ? 1 : (mZ < 0 ? -1 : 0); }
      let ni2 = -1, cX = 0, cZ = 0;
      const candTake = (dx2, dz2) => {
        if(!stepOK(cell, dx2, dz2)) return false;
        const t = (cz + dz2) * NAV_W + (cx + dx2);
        if(t !== gIdx && _bsVisit[t] === gen) return false; // already explored -> try next option
        ni2 = t; cX = dx2; cZ = dz2;
        return true;
      };
      if(!candTake(dX, dZ) && !candTake(mX, mZ)) candTake(aX, aZ);
      if(ni2 < 0) break;                       // pocket -> this branch dies
      steps++;
      if(ni2 === gIdx){ _bsParent[ni2] = cell; found = ni2; break; }
      // refresh wall side at the new cell: keep old side if wall still there, else flip
      const nx2 = ni2 % NAV_W, nz2 = (ni2 / NAV_W) | 0;
      let nws = ws;
      const onOld = ws === 1 ? latBlocked(nx2 - cZ, nz2 + cX) : latBlocked(nx2 + cZ, nz2 - cX);
      if(!onOld){
        const onOpp = ws === 1 ? latBlocked(nx2 + cZ, nz2 - cX) : latBlocked(nx2 - cZ, nz2 + cX);
        if(onOpp) nws = -ws;
      }
      enqueue(ni2, cell, ((cX + 1) << 2) | (cZ + 1), nws, 1);
      break;                                   // one crawl step per queue entry
    }
  }
  if(found < 0) return astar(grid, sIdx, gIdx, maxExpand); // greedy walk wedge -> A* guarantees completeness
  const rev = [];
  let cur = found;
  while(cur !== -1 && rev.length < 4000){ rev.push(cur); cur = _bsParent[cur]; }
  rev.reverse(); // start -> goal
  const path = [];
  for(let i = 2; i < rev.length; i += 2){ navWorldOf(rev[i], _bsWp); path.push({x:_bsWp.x, z:_bsWp.z}); }
  if(rev.length % 2 === 0){ navWorldOf(rev[rev.length - 1], _bsWp); path.push({x:_bsWp.x, z:_bsWp.z}); }
  return path.length ? path : null;
}
