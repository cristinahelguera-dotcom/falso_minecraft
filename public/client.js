//const socket = new WebSocket('ws://localhost:3000');
const socket = new WebSocket(`wss://${window.location.host}`);

const otherPlayers = {}; // para almacenar jugadores remotos

socket.addEventListener('message', e=>{
  const data = JSON.parse(e.data);

  if(data.type==='init'){
    // recibir ID y jugadores existentes
    window.playerId = data.id;
    for(const [id, p] of Object.entries(data.players)){
      if(id != playerId) addRemotePlayer(id, p);
    }
  }

  if(data.type==='update'){
    if(data.id != playerId){
      if(!otherPlayers[data.id]) addRemotePlayer(data.id, data.player);
      else updateRemotePlayer(data.id, data.player);
    }
  }

  if(data.type==='remove'){
    removeRemotePlayer(data.id);
  }
});

function addRemotePlayer(id, p){
  //const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({color:0xff0000}));
  //mesh.position.set(p.x, p.y, p.z);
  //scene.add(mesh);
  //otherPlayers[id] = mesh;
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(1,2,0.5), new THREE.MeshLambertMaterial({color:0xff0000}));
  body.position.y = 1; // cuerpo desde y=0 a y=2

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.8,0.8), new THREE.MeshLambertMaterial({color:0xffaaaa}));
  head.position.y = 2.4; // encima del cuerpo
  
  group.add(body);
  group.add(head);

  group.position.set(p.x, p.y, p.z);
  scene.add(group);

  otherPlayers[id] = group;
}

function updateRemotePlayer(id, p){
   const mesh = otherPlayers[id];
  if(mesh){
    // posición horizontal con interpolación
    mesh.position.x += (p.x - mesh.position.x)*0.2;
    mesh.position.z += (p.z - mesh.position.z)*0.2;

    // encontrar bloque más cercano debajo
    const downRay = new THREE.Raycaster(
      new THREE.Vector3(p.x, 50, p.z), // empezar desde arriba
      new THREE.Vector3(0,-1,0),
      0,
      100
    );
    const hits = downRay.intersectObjects(blocks);
    if(hits.length>0){
      mesh.position.y = hits[0].point.y + 1; // altura del jugador
    }

    // rotación
    mesh.rotation.y += (p.rotationY - mesh.rotation.y)*0.2;
  }
}

function removeRemotePlayer(id){
  const mesh = otherPlayers[id];
  if(mesh){
    scene.remove(mesh);
    delete otherPlayers[id];
  }
}

// enviar posición cada frame
function sendPlayerUpdate(){
  if(paused) return;
  const obj = controls.getObject();
  socket.send(JSON.stringify({
    type:'update',
    player:{ x: obj.position.x, y: obj.position.y, z: obj.position.z, rotationY: obj.rotation.y, isJumping: velocity.y > 0.1 }
  }));
}

const pauseOverlay = document.getElementById("pauseOverlay");
let paused=false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
let time = 0;

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff,1);
light.position.set(10,50,10);
scene.add(light);

// SOL
const sunGeo = new THREE.SphereGeometry(3,16,16);
const sunMat = new THREE.MeshBasicMaterial({color:0xffff00});
const sun = new THREE.Mesh(sunGeo,sunMat);
scene.add(sun);

const geo = new THREE.BoxGeometry(1,1,1);

// TEXTURAS INVENTADAS (pixel)
function tex(colorFn){
 const c=document.createElement("canvas");c.width=c.height=16;
 const ctx=c.getContext("2d");
 for(let x=0;x<16;x++){
  for(let y=0;y<16;y++){
   ctx.fillStyle=colorFn(x,y);
   ctx.fillRect(x,y,1,1);
  }
 }
 const t=new THREE.CanvasTexture(c);
 t.magFilter=THREE.NearestFilter;
 return t;
}

const grassMat=new THREE.MeshLambertMaterial({map:tex(()=>`rgb(30,${120+Math.random()*80},30)`) });
const dirtMat=new THREE.MeshLambertMaterial({map:tex(()=>`rgb(120,70,30)`) });
const waterMat=new THREE.MeshLambertMaterial({map:tex(()=>`rgb(30,100,${180+Math.random()*60})`) });
const woodMat=new THREE.MeshLambertMaterial({map:tex(()=>`rgb(${120+Math.random()*40},70,20)`) });
const leafMat=new THREE.MeshLambertMaterial({map:tex(()=>Math.random()<0.5?"#0a0a0a":"#00aa00") });

const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 2;

const chunks = new Map();
const blocks = [];

function getHeight(x,z){
  return Math.floor(Math.sin(x*0.2)+Math.cos(z*0.2)+4);
}

function chunkKey(cx,cz){ return cx+','+cz; }

function generateChunk(cx,cz){
  const key = chunkKey(cx,cz);
  if(chunks.has(key)) return;

  const chunkBlocks = [];

  for(let x=0;x<CHUNK_SIZE;x++){
    for(let z=0;z<CHUNK_SIZE;z++){

      const wx = cx*CHUNK_SIZE + x;
      const wz = cz*CHUNK_SIZE + z;
      const h = getHeight(wx,wz);

      for(let y=0;y<h;y++){
        const mat = y===h-1 ? grassMat : dirtMat;
        const block = new THREE.Mesh(geo, mat);
        block.position.set(wx,y,wz);
        scene.add(block);
        chunkBlocks.push(block);
        blocks.push(block);
      }

      if(h < 3){
        const waterGeo = new THREE.BoxGeometry(1,0.4,1);

        // capa inferior
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.set(wx,h-0.3,wz);
        scene.add(water);
        chunkBlocks.push(water);

        // capa superior (efecto profundidad)
        const waterTop = new THREE.Mesh(waterGeo, waterMat);
        waterTop.position.set(wx,h+0.1,wz);
        scene.add(waterTop);
        chunkBlocks.push(waterTop);

        // NO se añade a blocks → no es sólido
      }

      if(h >= 3 && x===8 && z===8){
        for(let i=0;i<3;i++){
          const log = new THREE.Mesh(geo, woodMat);
          log.position.set(wx,h+i,wz);
          scene.add(log);
          chunkBlocks.push(log);
          blocks.push(log);
        }
        for(let lx=-1;lx<=1;lx++){
          for(let lz=-1;lz<=1;lz++){
            for(let ly=3;ly<=4;ly++){
              const leaf = new THREE.Mesh(geo, leafMat);
              leaf.position.set(wx+lx,h+ly,wz+lz);
              scene.add(leaf);
              chunkBlocks.push(leaf);
              blocks.push(leaf);
            }
          }
        }
      }

    }
  }

  chunks.set(key, chunkBlocks);
}

function loadChunks(px,pz){
  const cx = Math.floor(px/CHUNK_SIZE);
  const cz = Math.floor(pz/CHUNK_SIZE);

  const needed = new Set();

  for(let dx=-RENDER_DISTANCE;dx<=RENDER_DISTANCE;dx++){
    for(let dz=-RENDER_DISTANCE;dz<=RENDER_DISTANCE;dz++){
      const k = chunkKey(cx+dx, cz+dz);
      needed.add(k);
      generateChunk(cx+dx, cz+dz);
    }
  }

  for(const [key,chunkBlocks] of chunks){
    if(!needed.has(key)){
      chunkBlocks.forEach(b=>scene.remove(b));
      chunks.delete(key);
    }
  }
}

const controls = new THREE.PointerLockControls(camera, document.body);
document.body.addEventListener('click', ()=>controls.lock());
scene.add(controls.getObject());

const spawn = new THREE.Vector3(0,10,0);
controls.getObject().position.copy(spawn);

const velocity = new THREE.Vector3();
let lastWPress = 0;
let sprint = false;
const keys = {};

document.addEventListener('keydown', e=>{

  // doble pulsación W para correr
  if(e.code==='KeyW'){
    const now = performance.now();
    if(now - lastWPress < 300){ sprint = true; }
    lastWPress = now;
  }
  keys[e.code]=true;

  if(e.code==='Escape'){
    paused=!paused;
    pauseOverlay.style.display=paused?"flex":"none";

    if(paused){
      controls.unlock(); // liberar ratón
    } else {
      controls.lock(); // volver al juego
    }
  }

  if(e.code==='KeyQ'){
    controls.getObject().position.copy(spawn);
    velocity.set(0,0,0);
  }
});

document.addEventListener('keyup', e=>{
  keys[e.code]=false;
  if(e.code==='KeyW') sprint = false;
});

// minar bloque a bloque
document.addEventListener('mousedown', e=>{
  if(paused) return;
  if(e.button===0){
    const dir = new THREE.Vector3();
    controls.getDirection(dir);

    const ray = new THREE.Raycaster(
      controls.getObject().position,
      dir,
      0,
      5
    );

    const hit = ray.intersectObjects(blocks);

    if(hit.length>0){
      const obj = hit[0].object;
      scene.remove(obj);
      const i = blocks.indexOf(obj);
      if(i>-1) blocks.splice(i,1);
    }
  }
});

function update(){
  time += 0.016;

	// ciclo día/noche cada 30s
	const DAY_DURATION = 600; // 10 minutos = 600s

	// ciclo día/noche
	const cycle = Math.floor(time / DAY_DURATION) % 2;
	if(cycle === 0){
	  // día
	  scene.background = new THREE.Color(0x87CEEB);
	  light.intensity = 1;
	} else {
	  // noche
	  scene.background = new THREE.Color(0x000022);
	  light.intensity = 0.2;
	}

  // mover el sol con el jugador
  const playerPos = controls.getObject().position;
  sun.position.set(playerPos.x + 10, playerPos.y + 20, playerPos.z - 10);
  if(paused) return;

  const obj = controls.getObject();

  const dir = new THREE.Vector3();
  if(keys['KeyW']) dir.z+=1;
  if(keys['KeyS']) dir.z-=1;
  if(keys['KeyA']) dir.x-=1;
  if(keys['KeyD']) dir.x+=1;

  dir.normalize();

  const forward = new THREE.Vector3();
  controls.getDirection(forward);
  forward.y=0;

  const right = new THREE.Vector3();
  right.crossVectors(forward,new THREE.Vector3(0,1,0));

  const speed = sprint ? 0.18 : 0.1;
  obj.position.add(forward.multiplyScalar(dir.z*speed));
  obj.position.add(right.multiplyScalar(dir.x*speed));

  velocity.y -= 0.02;
  obj.position.y += velocity.y;

  const down = new THREE.Raycaster(obj.position,new THREE.Vector3(0,-1,0));
  const hits = down.intersectObjects(blocks);

  if(hits.length>0 && hits[0].distance<2){
    velocity.y=0;
    obj.position.y = hits[0].point.y+2;
  }

  if(keys['Space'] && velocity.y===0){ velocity.y=0.3; }

  loadChunks(obj.position.x, obj.position.z);
}

function animate(){
  requestAnimationFrame(animate);
  update();
  renderer.render(scene,camera);
  //sendPlayerUpdate();
  setInterval(sendPlayerUpdate, 1000/15); 
}

animate();

