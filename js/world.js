// ============================================================================
// WORLD — scene build, doors, pickups, decorations
// ============================================================================
// ============================================================================
// WORLD
// ============================================================================
let wallColliders = [];
let wallMeshes = [];
let solidSlabs = [];
let roofSlabs = [];
let doors = [];
let pickups = [];
let platforms = []; // {box: Box3, top: number} — player can stand on top
let explosiveBarrels = [];

function addStaticWall(cx,cz,halfLen,isX,mat,cy=1.5){
  const geo = isX ? new THREE.BoxGeometry(halfLen*2,3.0,0.15) : new THREE.BoxGeometry(0.15,3.0,halfLen*2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(cx, cy, cz);
  scene.add(m);
  const bb = new THREE.Box3().setFromObject(m).clone();
  wallColliders.push(bb);
  wallMeshes.push(m);
  // Register wall top as platform so player can stand on it
  platforms.push({box: bb, top: cy + 1.5});
}

let doorIdCounter = 0;

function buildScene(){
  // Initialize object pools
  particlePool=[]; tracerPool=[]; projectilePool=[];
  solidSlabs = [ new THREE.Box3(new THREE.Vector3(-60,-1,-60), new THREE.Vector3(60,0,60)) ];
  roofSlabs = [];
  // Create 200 particle meshes (tiny spheres)
  const particleGeo = new THREE.SphereGeometry(0.08,4,4);
  const particleMat = new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:1});
  for(let i=0;i<200;i++){
    const m = new THREE.Mesh(particleGeo, particleMat.clone());
    m.visible=false; scene.add(m); particlePool.push(m);
  }
  // Create 50 tracer meshes (thin cylinders)
  const tracerGeo = new THREE.CylinderGeometry(0.01,0.01,1,4);
  const tracerMat = new THREE.MeshBasicMaterial({color:0xffdd66,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending});
  for(let i=0;i<50;i++){
    const m = new THREE.Mesh(tracerGeo, tracerMat.clone());
    m.visible=false; scene.add(m); tracerPool.push(m);
  }
  // Create 30 projectile meshes
  const projGeo = new THREE.SphereGeometry(0.18,8,8);
  const projMat = new THREE.MeshBasicMaterial({color:0x44ddff});
  for(let i=0;i<30;i++){
    const m = new THREE.Mesh(projGeo, projMat.clone());
    m.visible=false; scene.add(m); projectilePool.push(m);
  }

  const floorMat = new THREE.MeshStandardMaterial({map:floorTex(),color:0xffffff,roughness:.92,metalness:.05});
  const wallMat = new THREE.MeshStandardMaterial({map:wallTex(),color:0xffffff,roughness:.85});
  const ceilMat = new THREE.MeshStandardMaterial({map:ceilTex(),color:0xffffff,roughness:.95});
  const doorMat = new THREE.MeshStandardMaterial({map:doorTex(),color:0xffffff,roughness:.6,metalness:.3});
  const platformMat = new THREE.MeshStandardMaterial({map:crateTex(),color:0xffffff,roughness:.7});

  // Floor — large outdoor ground
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100,100), floorMat);
  floor.rotation.x = -Math.PI/2; scene.add(floor);
  // Ceilings — only for rooms (not outdoor)
  for(const rm of ROOMS){
    const rc = new THREE.Mesh(new THREE.PlaneGeometry(rm.w, rm.d), ceilMat);
    rc.rotation.x = Math.PI/2; rc.position.set(rm.x, 3.0, rm.z);
    scene.add(rc);
    // Roof — visible from outside (top side), darker brown
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(rm.w + 0.6, rm.d + 0.6), new THREE.MeshStandardMaterial({color:0x5a4030, roughness:0.85, side: THREE.DoubleSide}));
    roof.rotation.x = -Math.PI/2; roof.position.set(rm.x, 3.05, rm.z);
    scene.add(roof);
    const roofBox = new THREE.Box3(
      new THREE.Vector3(rm.x-(rm.w+0.6)/2, 2.98, rm.z-(rm.d+0.6)/2),
      new THREE.Vector3(rm.x+(rm.w+0.6)/2, 3.08, rm.z+(rm.d+0.6)/2)
    );
    solidSlabs.push(roofBox);
    roofSlabs.push(roofBox);
    platforms.push({box: roofBox, top: 3.05, stepUp: 0.8});
  }

  // Each room is standalone. Each room gets ONE door on the wall facing nearest other room,
  // plus one door facing outdoor (away from nearest room) so player can always enter/exit.
  const DOOR_W=1.4, DOOR_H=2.6, DOOR_HALF=DOOR_W/2;

  for(const rm of ROOMS){
    const cx=rm.x, cz=rm.z, hw=rm.w/2, hd=rm.d/2;
    // Find nearest other room
    let nearest = null, nearestDist = Infinity;
    for(const r2 of ROOMS){
      if(r2.id === rm.id) continue;
      const d = Math.sqrt((cx-r2.x)**2 + (cz-r2.z)**2);
      if(d < nearestDist){ nearestDist = d; nearest = r2; }
    }
    // Door faces nearest room (if within 20 units), otherwise door faces south (outdoor)
    let doorAxis, doorSide;
    if(nearest && nearestDist < 20){
      const dx = nearest.x - cx, dz = nearest.z - cz;
      if(Math.abs(dx) > Math.abs(dz)){ doorAxis = 'x'; doorSide = dx > 0 ? 'east' : 'west'; }
      else { doorAxis = 'z'; doorSide = dz > 0 ? 'north' : 'south'; }
    } else {
      doorAxis = 'z'; doorSide = 'south';
    }
    // Also add a second door on opposite side for outdoor access
    let door2Axis, door2Side;
    if(doorAxis === 'x'){ door2Axis = 'z'; door2Side = 'south'; }
    else { door2Axis = 'x'; door2Side = Math.random() < 0.5 ? 'east' : 'west'; }

    const segHalf=(hw*2-DOOR_W)/2, segOff=DOOR_HALF+segHalf;
    // Helper: does this wall have a door?
    const hasDoorN = (doorAxis==='z' && doorSide==='north') || (door2Axis==='z' && door2Side==='north');
    const hasDoorS = (doorAxis==='z' && doorSide==='south') || (door2Axis==='z' && door2Side==='south');
    const hasDoorW = (doorAxis==='x' && doorSide==='west') || (door2Axis==='x' && door2Side==='west');
    const hasDoorE = (doorAxis==='x' && doorSide==='east') || (door2Axis==='x' && door2Side==='east');

    if(hasDoorN){addStaticWall(cx-segOff,cz+hd,segHalf,true,wallMat);addStaticWall(cx+segOff,cz+hd,segHalf,true,wallMat);}
    else addStaticWall(cx,cz+hd,hw,true,wallMat);
    if(hasDoorS){addStaticWall(cx-segOff,cz-hd,segHalf,true,wallMat);addStaticWall(cx+segOff,cz-hd,segHalf,true,wallMat);}
    else addStaticWall(cx,cz-hd,hw,true,wallMat);
    if(hasDoorW){addStaticWall(cx-hw,cz-segOff,segHalf,false,wallMat);addStaticWall(cx-hw,cz+segOff,segHalf,false,wallMat);}
    else addStaticWall(cx-hw,cz,hd,false,wallMat);
    if(hasDoorE){addStaticWall(cx+hw,cz-segOff,segHalf,false,wallMat);addStaticWall(cx+hw,cz+segOff,segHalf,false,wallMat);}
    else addStaticWall(cx+hw,cz,hd,false,wallMat);

    // Create doors
    const handleMat = new THREE.MeshStandardMaterial({color:0xddaa44,metalness:.8,roughness:.3});
    const makeDoor = (axis, side) => {
      let posX, posZ;
      if(axis==='z'){ posX=cx; posZ = side==='north' ? cz+hd : cz-hd; }
      else { posZ=cz; posX = side==='east' ? cx+hw : cx-hw; }
      const group = new THREE.Group();
      if(axis==='z') group.position.set(posX-DOOR_HALF, 1.3, posZ);
      else group.position.set(posX, 1.3, posZ-DOOR_HALF);
      const dm = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.12), doorMat);
      if(axis==='z'){ dm.position.x = DOOR_HALF; }
      else { dm.rotation.y = Math.PI/2; dm.position.z = DOOR_HALF; }
      group.add(dm);
      const handle = new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8), handleMat);
      if(axis==='z') handle.position.set(DOOR_W*0.4, 0, 0.12);
      else handle.position.set(0.12, 0, DOOR_W*0.4);
      dm.add(handle);
      scene.add(group);
      let cMin, cMax;
      if(axis==='z'){ cMin=new THREE.Vector3(posX-DOOR_HALF,0,posZ-0.07); cMax=new THREE.Vector3(posX+DOOR_HALF,DOOR_H,posZ+0.07); }
      else { cMin=new THREE.Vector3(posX-0.07,0,posZ-DOOR_HALF); cMax=new THREE.Vector3(posX+0.07,DOOR_H,posZ+DOOR_HALF); }
      const cb = new THREE.Box3(cMin,cMax);
      const collider = cb.clone();
      wallColliders.push(collider);
      wallMeshes.push(dm); // bullet + LOS raycast target (swings aside when open)
      doors.push({id:doorIdCounter++, group, mesh:dm, isOpen:false, openAngle:0, targetAngle:0, axis, pos:{x:posX,z:posZ}, collisionBox:cb, colliderRef:collider});
    };
    if(hasDoorN) makeDoor('z','north');
    if(hasDoorS) makeDoor('z','south');
    if(hasDoorW) makeDoor('x','west');
    if(hasDoorE) makeDoor('x','east');

    // Room light fixture
    const fixtureMat = new THREE.MeshStandardMaterial({color:0xffeebb,emissive:0xffcc66,emissiveIntensity:1.2});
    const fx = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.08,1.2), fixtureMat);
    fx.position.set(cx, 3.1, cz);
    scene.add(fx);
  }

  // Outdoor cover — natural-looking rocks (dodecahedron visual, box collider) + containers with ramps
  const rockMat = new THREE.MeshStandardMaterial({color:0x555048,roughness:.95,flatShading:true});

  const isNearDoor = (x, z) => {
    for(const d of doors){ if(Math.abs(x-d.pos.x)<1.5 && Math.abs(z-d.pos.z)<1.5) return true; }
    return false;
  };
  const isInRoom = (x, z, margin=5) => ROOMS.some(rm => Math.abs(x-rm.x)<margin && Math.abs(z-rm.z)<margin);

  // Rocks — natural dodecahedron appearance, but collision is an axis-aligned box (can stand on)
  for(let i=0; i<6; i++){
    const angle = Math.random()*Math.PI*2, dist = 10+Math.random()*22;
    const rx = Math.cos(angle)*dist, rz = Math.sin(angle)*dist;
    if(isInRoom(rx,rz) || isNearDoor(rx,rz) || Math.sqrt(rx*rx+rz*rz) < 4) continue;
    const rockHeight = 1.4+Math.random()*0.8;
    const rockRadius = 0.8+Math.random()*0.4;
    // Visual: natural dodecahedron rock
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rockRadius,0), rockMat);
    rock.scale.set(1.3, rockHeight/(rockRadius*2), 1.3);
    rock.position.set(rx, rockHeight/2, rz);
    rock.rotation.y = Math.random()*Math.PI;
    rock.rotation.z = (Math.random()-.5)*0.2;
    scene.add(rock);
    // Collider: axis-aligned box matching the visual footprint (NOT added to wallMeshes so bullets pass through visual-only)
    const colSize = rockRadius * 1.3;
    const colBox = new THREE.Box3(
      new THREE.Vector3(rx - colSize, 0, rz - colSize),
      new THREE.Vector3(rx + colSize, rockHeight, rz + colSize)
    );
    wallColliders.push(colBox);
    // Add the rock mesh to wallMeshes for bullet collision (use the actual mesh)
    wallMeshes.push(rock);
    platforms.push({box: colBox, top: rockHeight});
  }

  // Shipping containers — max 4, at least 1.5m apart, with aligned ramp
  const containerPositions = [];
  const containerHeight = 2.6;
  const containerColors = [0xb05a2a, 0x2a5a8a, 0x5a8a2a, 0x8a2a5a];
  let containerCount = 0;
  for(let i=0; i<20 && containerCount < 4; i++){
    const angle = Math.random()*Math.PI*2, dist = 12+Math.random()*20;
    const cx = Math.cos(angle)*dist, cz = Math.sin(angle)*dist;
    if(isInRoom(cx,cz,7) || isNearDoor(cx,cz) || Math.sqrt(cx*cx+cz*cz) < 6) continue;
    // Check distance to other containers (at least 1.5m apart, accounting for container size)
    let tooClose = false;
    for(const cp of containerPositions){
      if(Math.sqrt((cx-cp.x)**2 + (cz-cp.z)**2) < 8.5){ tooClose = true; break; } // 6(container len) + 1.5(gap) + 1(margin)
    }
    if(tooClose) continue;
    containerPositions.push({x:cx, z:cz});

    // Container only rotates in 90° increments so ramp aligns properly
    const cRot = Math.floor(Math.random()*4) * (Math.PI/2);
    const cMat = new THREE.MeshStandardMaterial({color:containerColors[containerCount],roughness:.6,metalness:.3});
    const container = new THREE.Mesh(new THREE.BoxGeometry(6, containerHeight, 2.5), cMat);
    container.position.set(cx, containerHeight/2, cz);
    container.rotation.y = cRot;
    scene.add(container);
    const cb = new THREE.Box3().setFromObject(container);
    wallColliders.push(cb);
    wallMeshes.push(container);
    platforms.push({box: cb, top: containerHeight});

    // Container: 6 long (X) × 2.6 high × 2.5 deep (Z)
    // Ramp on +Z side (Z edge = +1.25), high end at container, low end away
    const rampLen = 3.0;
    const rampMat = new THREE.MeshStandardMaterial({color:0x999999,roughness:.7,metalness:.2});
    const rampGroup = new THREE.Group();
    const tilt = Math.atan2(containerHeight, rampLen);
    const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, rampLen), rampMat);
    // rotation.x = -tilt: -Z end up, +Z end down
    // Mesh center at Z = 1.25 + rampLen/2 = 2.75
    // -Z side (Z=1.25, container edge) → UP (high) ✓
    // +Z side (Z=4.25, far away) → DOWN (low) ✓
    rampMesh.rotation.x = tilt;
    rampMesh.position.y = containerHeight / 2;
    rampMesh.position.z = 1.25 + rampLen/2; // flush against container +Z edge
    rampGroup.add(rampMesh);
    rampGroup.position.set(cx, 0, cz);
    rampGroup.rotation.y = cRot;
    scene.add(rampGroup);

    // Ramp steps — high near container (Z=1.25), low far away (Z=4.25)
    for(let s=0; s<6; s++){
      const frac = s / 5;
      const stepY = (1 - frac) * containerHeight;
      const stepLocalZ = 1.25 + frac * rampLen; // Z=1.25 (near) to Z=4.25 (far)
      // Match Three.js Y rotation: (x,y,z) → (x*cos+z*sin, y, -x*sin+z*cos)
      // For local (0, 0, stepLocalZ): world = (cx + stepLocalZ*sin, 0, cz + stepLocalZ*cos)
      const cos = Math.cos(cRot), sin = Math.sin(cRot);
      const stepWorldX = cx + stepLocalZ * sin;
      const stepWorldZ = cz + stepLocalZ * cos;
      const stepBox = new THREE.Box3(
        new THREE.Vector3(stepWorldX - 1.3, 0, stepWorldZ - 1.3),
        new THREE.Vector3(stepWorldX + 1.3, stepY + 0.15, stepWorldZ + 1.3)
      );
      platforms.push({box: stepBox, top: stepY + 0.15});
    }

    // (accent light removed — forward renderer shades every point light per pixel)
    containerCount++;
  }

  // Fill empty outdoor areas — 100% build a container + adjacent two-story building
  const allObjects = [...ROOMS.map(r=>({x:r.x,z:r.z})), ...containerPositions];
  const wallMatFill = new THREE.MeshStandardMaterial({map:wallTex(),color:0xffffff,roughness:.85});
  const ceilMatFill = new THREE.MeshStandardMaterial({map:ceilTex(),color:0xffffff,roughness:.95});
  const doorMatFill = new THREE.MeshStandardMaterial({map:doorTex(),color:0xffffff,roughness:.6,metalness:.3});
  const handleMatFill = new THREE.MeshStandardMaterial({color:0xddaa44,metalness:.8,roughness:.3});
  const containerColorsFill = [0xb05a2a, 0x2a5a8a, 0x5a8a2a, 0x8a2a5a];

  // Helper: build a room at (bx,bz) with size (bw,bd), door on specified wall
  // doorWall: 'north','south','east','west'
  const buildRoom = (bx, bz, bw, bd, doorWall, floorY, ceilY) => {
    const hw = bw/2, hd = bd/2;
    const DW = 1.4, DH = 2.6, DHF = DW/2;
    const segH = (bw - DW)/2, segO = DHF + segH;
    const segH2 = (bd - DW)/2, segO2 = DHF + segH2;
    const hasN = doorWall === 'north';
    const hasS = doorWall === 'south';
    const hasE = doorWall === 'east';
    const hasW = doorWall === 'west';
    // North wall (z+)
    if(hasN){addStaticWall(bx-segO,bz+hd,segH,true,wallMatFill,floorY+1.5);addStaticWall(bx+segO,bz+hd,segH,true,wallMatFill,floorY+1.5);}
    else addStaticWall(bx,bz+hd,hw,true,wallMatFill,floorY+1.5);
    // South wall (z-)
    if(hasS){addStaticWall(bx-segO,bz-hd,segH,true,wallMatFill,floorY+1.5);addStaticWall(bx+segO,bz-hd,segH,true,wallMatFill,floorY+1.5);}
    else addStaticWall(bx,bz-hd,hw,true,wallMatFill,floorY+1.5);
    // West wall (x-)
    if(hasW){addStaticWall(bx-hw,bz-segO2,segH2,false,wallMatFill,floorY+1.5);addStaticWall(bx-hw,bz+segO2,segH2,false,wallMatFill,floorY+1.5);}
    else addStaticWall(bx-hw,bz,hd,false,wallMatFill,floorY+1.5);
    // East wall (x+)
    if(hasE){addStaticWall(bx+hw,bz-segO2,segH2,false,wallMatFill,floorY+1.5);addStaticWall(bx+hw,bz+segO2,segH2,false,wallMatFill,floorY+1.5);}
    else addStaticWall(bx+hw,bz,hd,false,wallMatFill,floorY+1.5);
    // Floor
    if(floorY > 1.0){
      // Second floor: solid floor except stair hole (east strip: bx+1 to bx+3, full Z depth)
      // Left part (west, x: bx-hw to bx+1) — covers most of the room
      const lfW = (bx + 1) - (bx - hw);
      const flT = 0.16;
      const lf = new THREE.Mesh(new THREE.BoxGeometry(lfW, flT, bd), new THREE.MeshStandardMaterial({map:floorTex(),color:0xffffff,roughness:.92}));
      lf.position.set(bx - hw + lfW/2, floorY - flT/2, bz); scene.add(lf);
      // Register as platform so player can stand on it
      platforms.push({box: new THREE.Box3(new THREE.Vector3(bx-hw, 0, bz-hd), new THREE.Vector3(bx+1, floorY+0.1, bz+hd)), top: floorY, stepUp: 2.0});
      roofSlabs.push(new THREE.Box3(new THREE.Vector3(bx-hw, floorY-0.05, bz-hd), new THREE.Vector3(bx+1, floorY+0.05, bz+hd)));
      // Right part (east, x: bx+3 to bx+hw) — small strip east of stair hole
      const rfW = (bx + hw) - (bx + 3);
      if(rfW > 0.1){
        const rf = new THREE.Mesh(new THREE.BoxGeometry(rfW, flT, bd), new THREE.MeshStandardMaterial({map:floorTex(),color:0xffffff,roughness:.92}));
        rf.position.set(bx + 3 + rfW/2, floorY - flT/2, bz); scene.add(rf);
        platforms.push({box: new THREE.Box3(new THREE.Vector3(bx+3, 0, bz-hd), new THREE.Vector3(bx+hw, floorY+0.1, bz+hd)), top: floorY, stepUp: 2.0});
        roofSlabs.push(new THREE.Box3(new THREE.Vector3(bx+3, floorY-0.05, bz-hd), new THREE.Vector3(bx+hw, floorY+0.05, bz+hd)));
      }
      // Hole between bx+1 and bx+3 is the stair opening — no floor, no platform
    } else {
      // First floor: no floor mesh (use the outdoor ground plane already at y=0)
      // Just add a slightly raised floor for visual distinction
      const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(bw, bd), new THREE.MeshStandardMaterial({map:floorTex(),color:0xffffff,roughness:.92}));
      floorMesh.rotation.x = -Math.PI/2; floorMesh.position.set(bx, 0.02, bz); scene.add(floorMesh);
    }
    // Ceiling — only for top floor (skip if this is floor1 and there's a floor2 above)
    if(floorY < 1.0){
      // First floor of two-story building: no ceiling (floor2 is the ceiling)
      // Check if this is a two-story building (ceilY < 4 means there's a second floor)
      // Skip ceiling for first floor
    } else {
      // Second floor: add ceiling + roof — register as platform so player can stand on roof
      const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(bw, bd), ceilMatFill);
      ceilMesh.rotation.x = Math.PI/2; ceilMesh.position.set(bx, ceilY, bz); scene.add(ceilMesh);
      const roofMesh = new THREE.Mesh(new THREE.PlaneGeometry(bw+0.6, bd+0.6), new THREE.MeshStandardMaterial({color:0x5a4030, roughness:0.85, side: THREE.DoubleSide}));
      roofMesh.rotation.x = -Math.PI/2; roofMesh.position.set(bx, ceilY+0.05, bz); scene.add(roofMesh);
      // Register roof as platform (stepUp: jump under the ceiling to climb on top)
      platforms.push({box: new THREE.Box3(new THREE.Vector3(bx-bw/2-0.3, 0, bz-bd/2-0.3), new THREE.Vector3(bx+bw/2+0.3, ceilY+0.1, bz+bd/2+0.3)), top: ceilY+0.05, stepUp: 0.8});
      roofSlabs.push(new THREE.Box3(new THREE.Vector3(bx-bw/2-0.3, ceilY-0.07, bz-bd/2-0.3), new THREE.Vector3(bx+bw/2+0.3, ceilY+0.12, bz+bd/2+0.3)));
    }
    // Light — only one per floor, skip for first floor of two-story to reduce light count
    if(floorY > 1.0){
      const rlight = new THREE.PointLight(0xffcc88, 4, 12, 1.5);
      rlight.position.set(bx, ceilY-0.3, bz); scene.add(rlight);
    }
    // Door
    let dpx, dpz, daxis;
    if(hasS){dpx=bx; dpz=bz-hd; daxis='z';}
    else if(hasN){dpx=bx; dpz=bz+hd; daxis='z';}
    else if(hasE){dpx=bx+hw; dpz=bz; daxis='x';}
    else {dpx=bx-hw; dpz=bz; daxis='x';}
    const dg = new THREE.Group();
    if(daxis==='z') dg.position.set(dpx-DHF, floorY+1.3, dpz);
    else dg.position.set(dpx, floorY+1.3, dpz-DHF);
    const dm = new THREE.Mesh(new THREE.BoxGeometry(DW, DH, 0.12), doorMatFill);
    if(daxis==='z') dm.position.x = DHF;
    else { dm.rotation.y = Math.PI/2; dm.position.z = DHF; }
    dg.add(dm);
    const dh = new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8), handleMatFill);
    if(daxis==='z') dh.position.set(DW*0.4, 0, 0.12); else dh.position.set(0.12, 0, DW*0.4);
    dm.add(dh);
    scene.add(dg);
    let dMin, dMax;
    if(daxis==='z'){dMin=new THREE.Vector3(dpx-DHF,0,dpz-0.07);dMax=new THREE.Vector3(dpx+DHF,DH,dpz+0.07);}
    else {dMin=new THREE.Vector3(dpx-0.07,0,dpz-DHF);dMax=new THREE.Vector3(dpx+0.07,DH,dpz+DHF);}
    const dcb = new THREE.Box3(dMin, dMax);
    const dcol = dcb.clone();
    wallColliders.push(dcol);
    wallMeshes.push(dm); // bullet + LOS raycast target (swings aside when open)
    const door = {id:doorIdCounter++, group:dg, mesh:dm, isOpen:Math.random()<0.4, openAngle:0, targetAngle:0, axis:daxis, pos:{x:dpx,z:dpz}, collisionBox:dcb, colliderRef:dcol};
    door.targetAngle = door.isOpen ? Math.PI/2 : 0;
    door.openAngle = door.targetAngle;
    door.group.rotation.y = door.targetAngle;
    syncDoorCollision(door);
    doors.push(door);
  };

  for(let gx = -22; gx <= 22; gx += 14) {
    for(let gz = -22; gz <= 22; gz += 14) {
      if(Math.sqrt(gx*gx + gz*gz) < 8) continue;
      let hasNearby = false;
      for(const obj of allObjects) {
        if(Math.sqrt((gx-obj.x)**2 + (gz-obj.z)**2) < 9) { hasNearby = true; break; }
      }
      if(hasNearby) continue;
      if(isNearDoor(gx, gz)) continue;

      // Layout: container at (gx, gz), two-story building adjacent on +X side
      // Container: 6(X) × 2.6(H) × 2.5(Z)
      const cMat = new THREE.MeshStandardMaterial({color:containerColorsFill[Math.floor(Math.random()*4)],roughness:.6,metalness:.3});
      const container = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.5), cMat);
      container.position.set(gx, 1.3, gz);
      scene.add(container);
      const cb = new THREE.Box3().setFromObject(container);
      wallColliders.push(cb); wallMeshes.push(container);
      platforms.push({box: cb, top: 2.6});
      allObjects.push({x: gx, z: gz});
      // Ramp on +Z side of container
      const rl = 3.0, tilt = Math.atan2(2.6, rl);
      const rg = new THREE.Group();
      const rm = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, rl), new THREE.MeshStandardMaterial({color:0x999999,roughness:.7,metalness:.2}));
      rm.rotation.x = tilt; rm.position.y = 1.3; rm.position.z = 1.25 + rl/2;
      rg.add(rm); rg.position.set(gx, 0, gz); scene.add(rg);
      for(let s=0; s<6; s++){
        const frac = s/5, sy = (1-frac)*2.6, slz = 1.25 + frac*rl;
        platforms.push({box: new THREE.Box3(new THREE.Vector3(gx-1.3,0,gz+slz-1.3), new THREE.Vector3(gx+1.3,sy+0.15,gz+slz+1.3)), top: sy+0.15});
      }

      // Two-story building at (gx+6, gz) — adjacent to container on +X side
      // Building is 7×7, big enough for stairs
      const bx = gx + 6, bz = gz;
      const bw = 7, bd = 7;
      // Floor 1: door on north or south (NOT facing container which is west/-X)
      const f1Door = Math.random() < 0.5 ? 'north' : 'south';
      buildRoom(bx, bz, bw, bd, f1Door, 0, 3.0);
      // Floor 2: door facing container (west/-X)
      buildRoom(bx, bz, bw, bd, 'west', 3.1, 6.1);
      // Stairs inside — 5 steps from floor1 (y=0) to floor2 (y=3.1)
      // Stairs against east wall, going up from south to north
      // Highest step (st=4) must touch the north wall (bz+hd)
      const hw2 = bw / 2; // 3.5
      const hd2 = bd / 2; // 3.5
      const stepDepth = 1.0;
      const startZ = bz + hd2 - 4 * stepDepth - stepDepth/2; // last step centered at bz+hd2-0.5, edge touches north wall
      for(let st = 0; st < 5; st++){
        const stepH = (st / 5) * 3.1;
        const stepZ = startZ + st * stepDepth; // from south to north, highest at north wall
        const stepBox = new THREE.Box3(
          new THREE.Vector3(bx + 0.5, 0, stepZ - 0.5),
          new THREE.Vector3(bx + hw2, stepH + 0.15, stepZ + 0.5)
        );
        const stairMesh = new THREE.Mesh(
          new THREE.BoxGeometry(hw2 - 0.5, stepH + 0.15, stepDepth),
          new THREE.MeshStandardMaterial({color:0x666666, roughness:0.8})
        );
        stairMesh.position.set(bx + 0.5 + (hw2 - 0.5) / 2, (stepH + 0.15) / 2, stepZ);
        scene.add(stairMesh);
        wallColliders.push(stepBox);
        wallMeshes.push(stairMesh);
        platforms.push({box: stepBox, top: stepH + 0.15});
      }
      // Register rooms for minimap
      ROOMS.push({id: ROOMS.length, x: bx, z: bz, w: bw, d: bd});
      allObjects.push({x: bx, z: bz});
    }
  }

  // No corridors needed — rooms are standalone with doors to outdoor

  // Outdoor ground lights — 2 brighter lamps instead of 6 (fewer per-pixel light loops)
  for(let i=0; i<2; i++){
    const angle = (i/2)*Math.PI*2, dist = 16;
    const pl = new THREE.PointLight(0xffcc66, 2.6, 15, 1.5);
    pl.position.set(Math.cos(angle)*dist, 3, Math.sin(angle)*dist);
    scene.add(pl);
  }

  // No platforms/pillars needed — containers and rocks serve as cover

  // Props — fewer barrels for performance
  const barrelMat = new THREE.MeshStandardMaterial({map:barrelTex(),roughness:.6,metalness:.4});
  const explBarrelMat = new THREE.MeshStandardMaterial({color:0xaa2211,emissive:0xff3300,emissiveIntensity:.4,roughness:.5,metalness:.3});
  const barrelLidMat = new THREE.MeshStandardMaterial({color:0x5a2a1a,roughness:.7});
  const crateMat = new THREE.MeshStandardMaterial({map:crateTex(),roughness:.8});
  for(let i=0; i<6; i++){
    const angle = Math.random()*Math.PI*2, dist = 8+Math.random()*22;
    const pp = {x: Math.cos(angle)*dist, z: Math.sin(angle)*dist};
    // Don't place too close to spawn
    if(Math.sqrt(pp.x**2+pp.z**2) < 3) continue;
    const roll = Math.random();
    if(roll < 0.4){
      // Explosive barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,0.95,12), explBarrelMat);
      barrel.position.set(pp.x, 0.475, pp.z);
      barrel.userData.explosiveBarrel = true;
      scene.add(barrel);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.36,0.36,0.06,12), barrelLidMat);
      lid.position.set(pp.x, 0.98, pp.z); scene.add(lid);
      const bCol = new THREE.Box3().setFromObject(barrel);
      wallColliders.push(bCol);
      wallMeshes.push(barrel);
      explosiveBarrels.push({mesh:barrel, pos:new THREE.Vector3(pp.x,0.5,pp.z), exploded:false, collider:bCol});
    } else if(roll < 0.7){
      // Normal barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,0.95,12), barrelMat);
      barrel.position.set(pp.x, 0.475, pp.z); scene.add(barrel);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.36,0.36,0.06,12), barrelLidMat);
      lid.position.set(pp.x, 0.98, pp.z); scene.add(lid);
      wallColliders.push(new THREE.Box3().setFromObject(barrel));
      wallMeshes.push(barrel);
    } else {
      // Crates
      const cm = new THREE.MeshStandardMaterial({map:crateTex(),roughness:.8});
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.8,0.8), cm);
      c1.position.set(pp.x, 0.4, pp.z); c1.rotation.y = Math.random()*0.4;
      scene.add(c1);
      if(Math.random()<0.5){ const c2=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.6,0.6),cm); c2.position.set(pp.x+0.1,1.0,pp.z-0.05); c2.rotation.y=Math.random()*0.5; scene.add(c2); wallColliders.push(new THREE.Box3().setFromObject(c2)); wallMeshes.push(c2); }
      wallColliders.push(new THREE.Box3().setFromObject(c1));
      wallMeshes.push(c1);
    }
  }

  for(const p of platforms){
    const b = p.box;
    if(!b) continue;
    solidSlabs.push(new THREE.Box3(
      new THREE.Vector3(b.min.x, p.top - 0.02, b.min.z),
      new THREE.Vector3(b.max.x, p.top + 0.02, b.max.z)
    ));
  }

  // Pre-place pickups
  const rp = [...ROOMS].filter(r=>r.id!==4);
  rp.sort(()=>Math.random()-0.5);
  rp.slice(0,3).forEach(rm=>spawnPickup(rm.x+(Math.random()-.5)*3, rm.z+(Math.random()-.5)*3, 'medkit'));
  rp.slice(3,5).forEach(rm=>spawnPickup(rm.x+(Math.random()-.5)*3, rm.z+(Math.random()-.5)*3, 'ammo'));
  rp.slice(5,7).forEach(rm=>spawnPickup(rm.x+(Math.random()-.5)*3, rm.z+(Math.random()-.5)*3, 'grenade_black'));
  // One initial supply crate in a random room
  const crateRoom = rp[7] || rp[0];
  spawnSupplyCrate(crateRoom.x, crateRoom.z);
}

// ============================================================================
// PICKUPS
// ============================================================================
function spawnPickup(x, z, type){
  let color=0x44cc44, emissive=0x115511;
  if(type==='ammo'){color=0xff8800;emissive=0xcc6600;}
  else if(type==='grenade'){color=0x66cc44;emissive=0x338822;}
  else if(type==='armor'){color=0x4488ff;emissive=0x1133aa;}
  else if(type==='grenade_black'){color=0x111111;emissive=0x222222;emissiveIntensity=.3;}
  const geo = type==='ammo' ? new THREE.BoxGeometry(0.45,0.3,0.35) : new THREE.BoxGeometry(0.4,0.4,0.4);
  const mat = new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:.5,roughness:.4});
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 0.5, z);
  scene.add(mesh);
  pickups.push({mesh, type, baseY:0.5, spawnTime:clock.elapsedTime});
}
// Golden supply crate — contains 2 medkits + 30 ammo + 2 grenades
function spawnSupplyCrate(x, z){
  const group = new THREE.Group();
  // Golden box
  const boxMat = new THREE.MeshStandardMaterial({color:0xdaa520,emissive:0x886600,emissiveIntensity:.5,roughness:.4,metalness:.6});
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.6,0.6), boxMat);
  box.position.y = 0.3;
  group.add(box);
  // Lid
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.82,0.08,0.62), boxMat);
  lid.position.y = 0.64;
  group.add(lid);
  // Glow light
  const light = new THREE.PointLight(0xffaa00, 3, 6, 1.5);
  light.position.y = 0.5;
  group.add(light);
  group.position.set(x, 0, z);
  scene.add(group);
  pickups.push({mesh:group, type:'crate', baseY:0, spawnTime:clock.elapsedTime, isOpen:false});
}
function spawnPowerup(x, z){
  const def = POWERUP_DEFS[Math.floor(Math.random()*POWERUP_DEFS.length)];
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.32,0), new THREE.MeshStandardMaterial({color:def.color,emissive:def.color,emissiveIntensity:.8,roughness:.2}));
  mesh.position.set(x, 0.6, z);
  scene.add(mesh);
  pickups.push({mesh, type:'powerup', powerupId:def.id, powerupLabel:def.label, powerupIcon:def.icon, powerupDuration:def.duration, baseY:0.6, spawnTime:clock.elapsedTime});
}

// ============================================================================
// DOORS — toggle + collision sync
// ============================================================================
function syncDoorCollision(door){
  if(door.isOpen){
    if(door.colliderRef){
      const idx = wallColliders.indexOf(door.colliderRef);
      if(idx !== -1) wallColliders.splice(idx, 1);
      door.colliderRef = null;
    }
  } else {
    if(!door.colliderRef){
      const cb = door.collisionBox.clone();
      wallColliders.push(cb);
      door.colliderRef = cb;
    }
  }
  navSetDoor(door, door.isOpen); // keep A* grids in sync with door state
}
function toggleDoorNearPlayer(maxDist=2.6){
  const px=camera.position.x, pz=camera.position.z;
  let nearest=null, nearestDist=Infinity;
  for(const door of doors){
    const dx=door.pos.x-px, dz=door.pos.z-pz;
    const d=Math.sqrt(dx*dx+dz*dz);
    if(d<maxDist && d<nearestDist){ nearest=door; nearestDist=d; }
  }
  if(!nearest) return false;
  nearest.isOpen = !nearest.isOpen;
  nearest.targetAngle = nearest.isOpen ? Math.PI/2 : 0;
  syncDoorCollision(nearest);
  audio.door();
  return true;
}

// Ground decorations — instanced meshes (a handful of draw calls instead of ~260 objects)
function spawnGroundDecorations(){
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  // Rocks — instanced, per-instance scale/rotation/color (not raycast targets: tiny pebbles)
  const rockPlacements = [];
  for(let i=0;i<80;i++){
    const angle = Math.random()*Math.PI*2, dist = 3+Math.random()*38;
    const x = Math.cos(angle)*dist, z = Math.sin(angle)*dist;
    let blocked=false;
    for(const room of ROOMS) if(Math.abs(x-room.x)<room.w/2+1 && Math.abs(z-room.z)<room.d/2+1){ blocked=true; break; }
    if(!blocked) for(const d of doors){ if(Math.abs(x-d.pos.x)<1.2 && Math.abs(z-d.pos.z)<1.2){ blocked=true; break; } }
    if(blocked||Math.sqrt(x*x+z*z)<3) continue;
    rockPlacements.push({x, z, s:0.9+Math.random()*2.2, rx:Math.random()*1.2, ry:Math.random()*Math.PI*2, rz:Math.random()*1.2});
  }
  if(rockPlacements.length){
    const rockMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.2, 0),
      new THREE.MeshStandardMaterial({color:0xffffff, roughness:.87, flatShading:true}),
      rockPlacements.length
    );
    const rockColors = [0x8a7a6a, 0x6a5a4a, 0x9a8a7a];
    rockPlacements.forEach((p,i)=>{
      dummy.position.set(p.x, 0.08, p.z);
      dummy.scale.setScalar(p.s);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      dummy.updateMatrix();
      rockMesh.setMatrixAt(i, dummy.matrix);
      rockMesh.setColorAt(i, tmpColor.setHex(rockColors[i%3]));
    });
    rockMesh.instanceMatrix.needsUpdate = true;
    if(rockMesh.instanceColor) rockMesh.instanceColor.needsUpdate = true;
    rockMesh.frustumCulled = false;
    scene.add(rockMesh);
  }

  // Grass tufts — one instanced cone per geometry variant, 3 green tones
  const grassPlacements = [];
  for(const room of ROOMS){
    for(let i=0;i<18;i++){
      const gx = room.x + (Math.random()-.5)*(room.w+4);
      const gz = room.z + (Math.random()-.5)*(room.d+4);
      if(Math.abs(gx-room.x)<room.w/2+0.5 && Math.abs(gz-room.z)<room.d/2+0.5) continue;
      let nearDoor=false;
      for(const d of doors){
        if(Math.abs(gx-d.pos.x)<1.5 && Math.abs(gz-d.pos.z)<1.5){ nearDoor=true; break; }
      }
      if(nearDoor||Math.sqrt(gx*gx+gz*gz)<3) continue;
      grassPlacements.push({x:gx, z:gz, s:0.8+Math.random()*1.4, tilt:(Math.random()-.5)*0.4, ry:Math.random()*Math.PI*2});
    }
  }
  if(grassPlacements.length){
    const grassMesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.1, 0.32, 5, 1),
      new THREE.MeshStandardMaterial({color:0xffffff, roughness:.7, flatShading:true}),
      grassPlacements.length
    );
    const grassColors = [0x5a9a3a, 0x3a7a2a, 0x6aaa4a];
    grassPlacements.forEach((p,i)=>{
      dummy.position.set(p.x, 0.16, p.z);
      dummy.scale.setScalar(p.s);
      dummy.rotation.set(p.tilt, p.ry, p.tilt*0.5);
      dummy.updateMatrix();
      grassMesh.setMatrixAt(i, dummy.matrix);
      grassMesh.setColorAt(i, tmpColor.setHex(grassColors[i%3]));
    });
    grassMesh.instanceMatrix.needsUpdate = true;
    if(grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
    grassMesh.frustumCulled = false;
    scene.add(grassMesh);
  }

  // Flower patches — instanced spheres with per-instance colors
  const flowerPlacements = [];
  for(const room of ROOMS){
    for(let i=0;i<8;i++){
      const fx = room.x + (Math.random()-.5)*(room.w+3);
      const fz = room.z + (Math.random()-.5)*(room.d+3);
      if(Math.abs(fx-room.x)<room.w/2+0.5 && Math.abs(fz-room.z)<room.d/2+0.5) continue;
      if(Math.sqrt(fx*fx+fz*fz)<3) continue;
      flowerPlacements.push({x:fx, z:fz, s:0.6+Math.random()*1.0});
    }
  }
  if(flowerPlacements.length){
    const flowerMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.06, 4, 4),
      new THREE.MeshBasicMaterial({color:0xffffff}),
      flowerPlacements.length
    );
    const flowerColors = [0xff6688, 0xffaa44, 0xffff66, 0x66bbff, 0xff88cc];
    flowerPlacements.forEach((p,i)=>{
      dummy.position.set(p.x, 0.08, p.z);
      dummy.scale.setScalar(p.s);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      flowerMesh.setMatrixAt(i, dummy.matrix);
      flowerMesh.setColorAt(i, tmpColor.setHex(flowerColors[i%5]));
    });
    flowerMesh.instanceMatrix.needsUpdate = true;
    if(flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true;
    flowerMesh.frustumCulled = false;
    scene.add(flowerMesh);
  }
}

function updateDoors(dt){
  for(const door of doors){
    const diff = door.targetAngle - door.openAngle;
    if(Math.abs(diff) > 0.01){
      door.openAngle += diff * Math.min(1, dt*6);
      door.group.rotation.y = door.openAngle;
    }
    // Collision is managed by toggleDoorNearPlayer + syncDoorCollision.
    // Here we only ensure visual angle matches target. No state changes.
  }
}
function updatePickups(time){
  for(const pk of pickups){
    if(pk.type === 'crate'){
      // Crate stays on ground, just rotates slowly
      pk.mesh.rotation.y = time * 0.3;
    } else {
      pk.mesh.position.y = pk.baseY + Math.sin(time*2 + pk.spawnTime)*0.15;
      pk.mesh.rotation.y = time * 0.8;
      if(pk.type === 'powerup') pk.mesh.rotation.x = time * 0.6;
    }
  }
}
