import * as THREE from './three.js-master/build/three.module.js';
import { GLTFLoader } from './three.js-master/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from './three.js-master/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from './three.js-master/examples/jsm/controls/PointerLockControls.js';
import { MTLLoader } from './three.js-master/examples/jsm/loaders/MTLLoader.js';
import TWEEN, { Easing, Tween } from './libs/tween.esm.js'
function onProgress(xhr) {
	console.log((xhr.loaded / xhr.total * 100) + '% loaded');
}
function onError(error) {
	console.log('An error happened');
}
var modelsLoaded = false;
var soundsLoaded = false;

const models = {
	drone: { url: './models/drone.gltf' },
	city: { url: './models/city.glb' }
}


const sounds = {
	background: { url: './sounds/music.mp3'}
}














const vertex = new THREE.Vector3();


var sound, listener, audioLoader;
function loadSounds() {

	const soundsLoaderMngr = new THREE.LoadingManager();
	soundsLoaderMngr.onLoad = () => {
		soundsLoaded = true;
	
		if(modelsLoaded & soundsLoaded) {
			main();
		}
	};

	soundsLoaderMngr.onProgress = (url, itemsLoaded, itemsTotal) => {
		console.log("Loading sounds... ", itemsLoaded / itemsTotal * 100, '%');
	};

	{
		const audioLoader = new THREE.AudioLoader(soundsLoaderMngr);
		for (const sound of Object.values(sounds)) {
			audioLoader.load( sound.url, function( buffer ) {
				
				sound.sound = buffer;

				console.log("Loaded ", buffer);
			});
		}
	} 
}

function playSoundTrack(){
	sound.isPlaying = false;
	sound.setBuffer(sounds.background.sound);
	sound.setLoop(true);
	sound.setVolume(0.3);
	sound.play();
}

function loadModels() {
	const modelsLoadMngr = new THREE.LoadingManager();
	modelsLoadMngr.onLoad = () => {
		modelsLoaded = true;

		// document.querySelector('#models_loading').hidden = true;

		if (modelsLoaded & soundsLoaded) {
			main();
		}
	};
	modelsLoadMngr.onProgress = (url, itemsLoaded, itemsTotal) => {
		console.log("Loading the models... ", itemsLoaded / itemsTotal * 100, "%");
		// document.getElementById("get_models_progress").innerHTML = `${itemsLoaded / itemsTotal * 100 | 0}%`;
	};
	{
		const gltfLoader = new GLTFLoader(modelsLoadMngr);
		for (const model of Object.values(models)) {
			console.log("Loading Model: ", model);
			gltfLoader.load(model.url, (gltf) => {
				const standardMaterial = new THREE.MeshPhongMaterial();
				gltf.scene.traverse(function (child) {

					if (child.isMesh) {
						child.castShadow = true;
						child.receiveShadow = true;
						if (child.material.depthWrite == true) console.log(child.material)
						child.material = new THREE.MeshStandardMaterial({
							color: child.material.color,
							emissive: child.material.emissive,
							opacity: child.material.opacity,
							transparent: child.material.transparent,
							polygonOffset: child.material.polygonOffset,
							refractionRatio: child.material.refractionRatio,
							// metalness: child.material.metalness,
							// roughness: child.material.roughness,
							side: THREE.FrontSide,
							fog:true
						});
						if (child.material.depthWrite == true) console.log(child.material)
					}

				});

				model.gltf = gltf.scene;
			});
		}
	}
}

window.onload = () => {
	loadModels();
	loadSounds();
}

var drone = {
	mesh: null,
	positionFrame: null,
	rotationFrame: null,
	elements: {
		propellers: {},
	},
	rotations: {

	}
}

var city = {
	mesh: null
}

// controls
const inputs = {
	w: false, // forward
	s: false, // backwards
	d: false, // right
	a: false, // left
	" ": false, // throttle up
	"<": false, // throttle down
	e: false, // clockwise rotation
	q: false // counter-clockwise rotation
}
const inputs_queue = {
	w: false, // forward
	s: false, // backwards
	d: false, // right
	a: false, // left
	" ": false, // throttle up
	"<": false, // throttle down
	e: false, // clockwise rotation
	q: false // counter-clockwise rotation;
}
const exclusives = {
	w: "s",
	s: "w",
	a: "d",
	d: "a",
	" ": "<",
	"<": " ",
	e: "q",
	q: "e"
}

class ThirdPersonCamera {
	constructor(params) {
		this._params = params;
		this._camera = params.camera;

		this._currentPosition = new THREE.Vector3();
		this._currentLookAt = new THREE.Vector3();
	}

	_CalculateOffset(theta, phi) {
		const radius = this._params.radius;
		const offset = new THREE.Vector3(Math.sin(theta) * Math.cos(phi) * radius, Math.sin(phi) * radius, Math.cos(phi) * Math.cos(theta) * radius);
		offset.applyEuler(this._params.target.rotation);
		offset.add(this._params.target.position);
		return offset;
	}

	_CalculateLookAt() {
		const lookAt = new THREE.Vector3(0, 0, 0);
		lookAt.applyEuler(this._params.target.rotation);
		lookAt.add(this._params.target.position);
		return lookAt;
	}
	SetTarget(target) {
		this._params.target = target;
	}

	Update(timePassed, theta, phi) {
		const offset = this._CalculateOffset(Math.PI - theta, phi);
		const lookAt = this._CalculateLookAt();

		const interpolate = 1.0 - Math.pow(0.0001, timePassed);

		this._currentPosition.lerp(offset, interpolate);
		this._currentLookAt.lerp(lookAt, interpolate);

		this._camera.position.copy(this._currentPosition);
		this._camera.lookAt(this._currentLookAt);
	}
}

function main() {

	let camera, scene, renderer, thirdPersonCamera, controls, rain, rainGeo, rainCount = 15000;
	let radius, theta, phi;

	var width = window.innerWidth;
	var height = window.innerHeight;

	const canvas = document.querySelector('#c');
	renderer = new THREE.WebGL1Renderer({
		canvas,
		// logarithmicDepthBuffer: true
	});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(width, height);
	renderer.autoClear = false;
	renderer.setAnimationLoop(animation);
	renderer.shadowMap.enabled = true
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	// creating scene
	scene = new THREE.Scene();

	// camera
	{
		camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 40);

		radius = 0.6;
		theta = 0;
		phi = Math.PI / 6;

		window.addEventListener('resize', () => {
			width = window.innerWidth;
			height = window.innerHeight;
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.setSize(width, height);
			max_mousemove = Math.pow(1580, Math.min(1 / camera.aspect, camera.aspect));
		}, false);

		controls = new PointerLockControls(camera, canvas);

		thirdPersonCamera = new ThirdPersonCamera({
			camera: camera,
			target: null,
			radius: radius
		})

		document.addEventListener('click', () => {
			controls.lock();
		})
		var max_mousemove = Math.pow(1580, 1 / camera.aspect);;
		document.addEventListener('mousemove', (event) => {
			if (controls.isLocked) {
				var dx = Math.max(-max_mousemove, Math.min(event.movementX, max_mousemove)) * 0.001;
				var dy = Math.max(-max_mousemove, Math.min(event.movementY, max_mousemove)) * 0.001;
				// console.log(event.movementX, event.movementY, camera.aspect)

				theta += dx * Math.PI / 2;
				phi += dy * Math.PI / 2;
				if (Math.abs(phi) > Math.PI / 2) {
					phi = phi > 0 ? Math.PI / 2 - 0.001 : -Math.PI / 2 + 0.001;
				}
				phi -= Math.abs(phi) > 2 * Math.PI ? phi < 0 ? -2 * Math.PI : 2 * Math.PI : 0;
				theta -= Math.abs(theta) > 2 * Math.PI ? theta < 0 ? -2 * Math.PI : 2 * Math.PI : 0;

			}
		})

	}

	//sounds
	{
		listener = new THREE.AudioListener();
		camera.add(listener);
		sound = new THREE.Audio(listener);
		audioLoader = new THREE.AudioLoader();

	
	}

	//rain
	{

		const points = [];
		for(let i=0;i<rainCount;i++) {
			let rainDrop = new THREE.Vector3(
			  Math.random() * 400 -200,
			  Math.random() * 500 - 250,
			  Math.random() * 400 - 200
			);
			rainDrop.velocity = {};
			rainDrop.velocity = 0;
			points.push(rainDrop);
		}
		rainGeo = new THREE.BufferGeometry().setFromPoints( points );
        let rainMaterial = new THREE.PointsMaterial({
        color: 0xaaaaaa,
        size: 0.1,
        transparent: true
        });
        rain = new THREE.Points(rainGeo,rainMaterial);
        scene.add(rain);
	}

	// plane
	// {
	// 	const planeSize = 400;

	// 	const loader = new THREE.TextureLoader();
	// 	const texture = loader.load('./textures/checker.png');
	// 	texture.wrapS = THREE.RepeatWrapping;
	// 	texture.wrapT = THREE.RepeatWrapping;
	// 	texture.magFilter = THREE.NearestFilter;
	// 	const repeats = planeSize / 20;
	// 	texture.repeat.set(repeats, repeats);

	// 	const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
	// 	const planeMat = new THREE.MeshPhongMaterial({
	// 		map: texture,
	// 		side: THREE.DoubleSide,
	// 	});
	// 	const mesh = new THREE.Mesh(planeGeo, planeMat);
	// 	mesh.rotation.x = Math.PI * -.5;
	// 	mesh.receiveShadow = true;
	// 	scene.add(mesh);
	// }
	// sky
	{
		const skyColor = 0xB1E1FF;  // light blue
		const groundColor = 0xB97A20;  // brownish orange
		const intensity = 1;
		const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
		scene.add(light);
	}

	function initDrone() {
		drone.mesh = new THREE.Object3D();
		drone.mesh.name = "Drone";

		drone.mesh.add(models.drone.gltf.getObjectByName('body'));
		drone.mesh.scale.set(0.01, 0.01, 0.01)
		drone.positionFrame = new THREE.Mesh();
		// drone.positionFrame.position.set(-34.64, 0.5, -37.50);
		drone.rotationFrame = new THREE.Mesh();
		drone.rotationFrame.add(new THREE.AxesHelper(15))
		scene.add(drone.positionFrame);
		drone.positionFrame.add(drone.rotationFrame)
		drone.rotationFrame.add(drone.mesh);
		drone.mesh.traverse(o => {

			if (o.name === "PropellerFR") {
				drone.elements.propellers.propellerFR = o;
			}
			if (o.name === "PropellerFL") {
				drone.elements.propellers.propellerFL = o;
			}
			if (o.name === "PropellerBR") {
				drone.elements.propellers.propellerBR = o;
			}
			if (o.name === "PropellerBL") {
				drone.elements.propellers.propellerBL = o;
			}

			if (o.name === "body") {
				drone.elements.propellers.body = o;
			}
		})

		// drone tweens
		{
			const tweens = {
				w: null,
				s: null,
				a: null,
				d: null,
				q: null,
				e: null,
				" ": null,
				"<": null,
			}

			const transition_s = 700;
			const transition = 2 * transition_s;
			const time_up = 5000;
			const time_yaw = 200;
			var ease_func = TWEEN.Easing.Elastic.Out;
			var ease_func_speed = TWEEN.Easing.Quartic.Out;
			// var ease_func = TWEEN.Easing.Back.Out;
			// var ease_func_up = TWEEN.Easing.Quadratic.Out;
			var ease_func_up = TWEEN.Easing.Linear.None;
			var throttle_control = false;




			function applyTweens(key) {
				inputs[key] = true;
				if (inputs.w) tweens.w = [
					new TWEEN.Tween(speed).to({ x: 1 }, transition_s).start().easing(ease_func_speed),
					new TWEEN.Tween(drone.mesh.rotation).to({ x: 0.2 }, transition).start().easing(ease_func)
				];
				if (inputs.s) tweens.s = [
					new TWEEN.Tween(speed).to({ x: -1 }, transition_s).start().easing(ease_func_speed),
					new TWEEN.Tween(drone.mesh.rotation).to({ x: -0.2 }, transition).start().easing(ease_func)
				];
				if (inputs.d) tweens.d = [
					new TWEEN.Tween(speed).to({ z: 1 }, transition_s).start().easing(ease_func_speed),
					new TWEEN.Tween(drone.mesh.rotation).to({ z: 0.2 }, transition).start().easing(ease_func)
				];
				if (inputs.a) tweens.a = [
					new TWEEN.Tween(speed).to({ z: -1 }, transition_s).start().easing(ease_func_speed),
					new TWEEN.Tween(drone.mesh.rotation).to({ z: -0.2 }, transition).start().easing(ease_func)
				];
				if (inputs.e) tweens.e = new TWEEN.Tween(o_speed).to({ y: -Math.PI }, time_yaw).start().easing(ease_func_up);
				if (inputs.q) tweens.q = new TWEEN.Tween(o_speed).to({ y: Math.PI }, time_yaw).start().easing(ease_func_up);
				if (throttle_control) return;
				if (inputs[" "] && acc.y < 12 && !tweens[" "]) {
					tweens[" "] = new TWEEN.Tween(speed).to({ y: '+1.2' }, time_up).start().easing(ease_func_up).onUpdate(() => {
						if (acc.y < 12) return;
						tweens[" "].stop();
						tweens[" "] = null;
					});
				}
				if (inputs["<"] && acc.y > 0 && !tweens["<"]) {
					tweens["<"] = new TWEEN.Tween(speed).to({ y: '-1.2' }, time_up).start().easing(ease_func_up).onUpdate(() => {
						if (acc.y > 0) return;
						tweens["<"].stop();
						tweens["<"] = null;
					});
				}
			}

			// event listeners
			document.addEventListener('keydown', function (event) {
				let key = event.key.toLowerCase();
				if (key === "h") console.log(drone.positionFrame.position)
				if(key === 'u') {
					playSoundTrack();
				}
				if ("wsadqe< ".indexOf(key) == -1) return;
				if (!inputs[key]) {
					if (inputs[exclusives[key]]) {
						inputs_queue[key] = true;
						return;
					}

					applyTweens(key);
				}
			});

			document.addEventListener('keyup', function (event) {
				let key = event.key.toLowerCase();
				if ("wsadqe< ".indexOf(key) == -1) return;
				inputs[key] = false;
				inputs_queue[key] = false;
				if (inputs_queue[exclusives[key]]) {
					inputs_queue[exclusives[key]] = false;
					applyTweens(exclusives[key]);
				}
				if (!(inputs.w || inputs.s)) {
					new TWEEN.Tween(speed).to({ x: 0 }, transition_s).start().easing(ease_func_speed);
					new TWEEN.Tween(drone.mesh.rotation).to({ x: 0 }, transition).start().easing(ease_func);
				};
				if (!(inputs.a || inputs.d)) {
					new TWEEN.Tween(speed).to({ z: 0 }, transition_s).start().easing(ease_func_speed);
					new TWEEN.Tween(drone.mesh.rotation).to({ z: 0 }, transition).start().easing(ease_func);
				};
				if (!(inputs.e || inputs.q)) new TWEEN.Tween(o_speed).to({ y: 0 }, time_yaw).start().easing(ease_func_up);

				if (!tweens[key]) return;
				switch (key) {
					case "w":
					case "s":
					case "a":
					case "d":
						tweens[key][0].stop();
						tweens[key][1].stop();
						break;
					case "q":
					case "e":
						tweens[key].stop();
						break;
					case " ":
					case "<":
						tweens[key].stop()
						tweens[key] = null;
						break;
					default:
						break;
				}
			});
		}
	}
	initDrone();

	function initCity() {
		city.mesh = new THREE.Object3D();
		city.mesh.name = "City";

		city.mesh.add(models.city.gltf.getObjectByName('Model1'));
		console.log(city.mesh);
		city.mesh.position.set(34.64*2, -0.5*2, 37.50*2);
		city.mesh.scale.set(2, 2, 2);
		scene.add(city.mesh);
	}
	initCity();

	// dirlight
	{
		const color = 0xFFFFFF;
		const intensity = 1;
		const light = new THREE.DirectionalLight(color, intensity);
		light.castShadow = true;
		light.position.set(10, 10, 0);
		light.target.position.set(0, 0, 0);
		light.shadow.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 20);
		light.shadow.mapSize.width = 4096;
		light.shadow.mapSize.height = 4096;
		light.shadow.bias = -0.004;
		// console.log(light.shadow.camera)
		drone.positionFrame.add(light);
		drone.positionFrame.add(light.target);
		const cameraHelper = new THREE.CameraHelper(light.shadow.camera);
		// scene.add(cameraHelper);
		const lightHelper = new THREE.DirectionalLightHelper(light, 5, 0xff0000);
		scene.add(lightHelper);
	}
	thirdPersonCamera.SetTarget(drone.positionFrame);



	// HUD
	{
		var hudCanvas = document.createElement('canvas');
		hudCanvas.width = width;
		hudCanvas.height = height;

		var hudBitmap = hudCanvas.getContext('2d');
		hudBitmap.font = "Normal 40px Arial";
		hudBitmap.textAlign = 'center';
		hudBitmap.fillStyle = "rgba(255,255,255,1.0)";
		hudBitmap.fillText('Initializing...', width / 2, height / 2);
		var cameraHUD = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0, 30);

		// Create also a custom scene for HUD.
		var sceneHUD = new THREE.Scene();

		// Create texture from rendered graphics.
		var hudTexture = new THREE.Texture(hudCanvas)
		hudTexture.needsUpdate = true;
		hudTexture.minFilter = THREE.LinearFilter;

		// Create HUD material.
		var material = new THREE.MeshBasicMaterial({ map: hudTexture });
		material.transparent = true;

		// Create plane to render the HUD. This plane fill the whole screen.
		var planeGeometry = new THREE.PlaneGeometry(width, height);
		var plane = new THREE.Mesh(planeGeometry, material);
		sceneHUD.add(plane);
	}
	var oldtime = 0;
	var speed = new THREE.Vector3();
	var o_speed = {
		y: 0
	};
	var acc = new THREE.Vector3();
	const max_acc = 12;
	acc.y = 10;
	const max_p_speed = Math.sqrt(max_acc / 4)
	const g = -10;
	var p_speed_p = new THREE.Vector4();
	var p_speed_r = new THREE.Vector4();
	var p_speed_y = new THREE.Vector4();
	p_speed_p.w = 0;
	p_speed_r.w = 0;
	p_speed_y.w = 0;

	function animation(time) {
		time *= 0.001;
		const dt = time - oldtime;
		oldtime = time;

		const max_rps = 250 * (2 * Math.PI);

		// 4 * kf * p_speed ^ 2 * cos phi * cos th = acc.y - kt * speed.y

		const p_speed = Math.sqrt(Math.max(acc.y, 0) / (4 * Math.cos(drone.mesh.rotation.x) * Math.cos(drone.mesh.rotation.z))) / max_p_speed * max_rps;

		p_speed_p.x = -drone.mesh.rotation.x * 10;
		p_speed_p.y = -drone.mesh.rotation.x * 10;
		p_speed_p.z = drone.mesh.rotation.x * 10;
		p_speed_p.w = drone.mesh.rotation.x * 10;
		p_speed_r.x = -drone.mesh.rotation.z * 10;
		p_speed_r.y = drone.mesh.rotation.z * 10;
		p_speed_r.z = -drone.mesh.rotation.z * 10;
		p_speed_r.w = drone.mesh.rotation.z * 10;
		p_speed_y.x = o_speed.y * 0.25;
		p_speed_y.y = -o_speed.y * 0.25;
		p_speed_y.z = -o_speed.y * 0.25;
		p_speed_y.w = o_speed.y * 0.25;

		// console.log((p_speed + p_speed_p.x + p_speed_r.x + p_speed_y.x) * dt);

		drone.elements.propellers.propellerFR.rotation.y += (p_speed + p_speed_p.x + p_speed_r.x + p_speed_y.x) * dt;
		drone.elements.propellers.propellerFL.rotation.y += (p_speed + p_speed_p.y + p_speed_r.y + p_speed_y.y) * dt;
		drone.elements.propellers.propellerBR.rotation.y += (p_speed + p_speed_p.z + p_speed_r.z + p_speed_y.z) * dt;
		drone.elements.propellers.propellerBL.rotation.y += (p_speed + p_speed_p.w + p_speed_r.w + p_speed_y.w) * dt;

		const dO = o_speed.y * dt;
		const dx = speed.x * dt;
		const dz = speed.z * dt;

		drone.rotationFrame.rotation.y += dO;

		const cos_rot_y = Math.cos(drone.rotationFrame.rotation.y);
		const sin_rot_y = Math.sin(drone.rotationFrame.rotation.y);

		// console.log(speed);
		drone.positionFrame.position.z += cos_rot_y * dx;
		drone.positionFrame.position.x += sin_rot_y * dx;
		drone.positionFrame.position.x -= cos_rot_y * dz;
		drone.positionFrame.position.z += sin_rot_y * dz;

		speed.y += (acc.y + g) * dt;
		drone.positionFrame.position.y += speed.y * dt;
		thirdPersonCamera.Update(dt, theta, phi);

		hudBitmap.clearRect(0, 0, width, height);
		hudBitmap.fillText(Math.round(1 / dt), 50, 50)
		hudBitmap.fillText((acc.y + g).toFixed(2), 50, 100)
		hudTexture.needsUpdate = true;


		//animazione pioggia
		var positionAttribute = rain.geometry.getAttribute( 'position' );
	
    	for ( var i = 0; i < positionAttribute.count; i ++ ) {
	
        	vertex.fromBufferAttribute( positionAttribute, i );
			

        	vertex.y -= 1;
		
        	if (vertex.y < - 200) {
            	vertex.y = 200;
        	}
		
        	positionAttribute.setXYZ( i, vertex.x, vertex.y, vertex.z );
	
    	}

    	positionAttribute.needsUpdate = true;





		renderer.render(scene, camera);

		renderer.render(sceneHUD, cameraHUD);
		TWEEN.update()
	}
}
