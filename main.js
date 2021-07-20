// import * as THREE from './three.js-master/build/three.module.js';
import { GLTFLoader } from './three.js-master/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from './three.js-master/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from './three.js-master/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from './three.js-master/examples/jsm/controls/PointerLockControls.js';
import { MTLLoader } from './three.js-master/examples/jsm/loaders/MTLLoader.js';
import TWEEN, { Easing, Tween } from './libs/tween.esm.js';
import { OimoPhysics } from './three.js-master/examples/jsm/physics/OimoPhysics.js';

const {
	Project,
	PhysicsLoader,
	Scene3D,
	ExtendedObject3D,
	THREE,
	JoyStick,
	ThirdPersonControls,
	PointerLock,
	PointerDrag
} = ENABLE3D


function onProgress(xhr) {
	console.log((xhr.loaded / xhr.total * 100) + '% loaded');
}
function onError(error) {
	console.log('An error happened');
}
var modelsLoaded = false;
var soundsLoaded = false;

const models = {
	drone: { url: './models/drone.gltf', loader: 'gltf' },
	city: { url: './models/scene.gltf', loader: 'gltf' }
}


const sounds = {
	background: { url: './sounds/music.mp3' },
	drone: { url: './sounds/drone.mp3' },
}

const vertex = new THREE.Vector3();


var sound, listener, droneSound, audioLoader;
function loadSounds() {

	const soundsLoaderMngr = new THREE.LoadingManager();
	soundsLoaderMngr.onLoad = () => {
		soundsLoaded = true;

		// if (modelsLoaded & soundsLoaded) {
		// 	main();
		// }
	};

	soundsLoaderMngr.onProgress = (url, itemsLoaded, itemsTotal) => {
		console.log("Loading sounds... ", itemsLoaded / itemsTotal * 100, '%');
	};

	{
		const audioLoader = new THREE.AudioLoader(soundsLoaderMngr);
		for (const sound of Object.values(sounds)) {
			audioLoader.load(sound.url, function (buffer) {

				sound.sound = buffer;

				console.log("Loaded ", buffer);
			});
		}
	}
}

function playSoundTrack() {
	if (sound.isPlaying) {
		document.getElementById("musicbutton").src = './menu/soundoff.png';
		sound.pause();
		droneSound.pause();
	} else {
		document.getElementById("musicbutton").src = './menu/soundin.png';
		sound.isPlaying = false;
		sound.setBuffer(sounds.background.sound);
		sound.setLoop(true);
		sound.setVolume(0.15);
		sound.play();
		droneSound.isPlaying = false;
		droneSound.setBuffer(sounds.drone.sound);
		droneSound.setLoop(true);
		droneSound.setVolume(0.3);
		droneSound.play();
	}
}

var max_mousemove;
function loadModels() {
	const modelsLoadMngr = new THREE.LoadingManager();
	modelsLoadMngr.onLoad = () => {
		modelsLoaded = true;

		// document.querySelector('#models_loading').hidden = true;

		// if (modelsLoaded & soundsLoaded) {
		// 	main();
		// }
	};
	modelsLoadMngr.onProgress = (url, itemsLoaded, itemsTotal) => {
		console.log("Loading the models... ", itemsLoaded / itemsTotal * 100, "%");
		// document.getElementById("get_models_progress").innerHTML = `${itemsLoaded / itemsTotal * 100 | 0}%`;
	};
	// load gltf
	{
		const gltfLoader = new GLTFLoader(modelsLoadMngr);
		const fbxLoader = new FBXLoader(modelsLoadMngr)
		for (const model of Object.values(models)) {
			console.log("Loading Model: ", model);
			switch (model.loader) {
				case 'fbx':
					fbxLoader.load(model.url, fbx => {
						fbx.traverse(child => {
							if (child.isMesh) {
								child.castShadow = true;
								child.receiveShadow = true;
								// if (child.material.specular != null) console.log(child.material)
								// for (var i = 0; i < child.material.length; i++) {
								// 	if (child.material[i].specular != 0)
								// 	child.material.specular = {r:1.0, g: 1.0, b:1.0};
								// 		console.log(child.material);
								// }
								// child.material = child.material[2] || child.material;
								// if (child.material.depthWrite == true) console.log(child.material)
							}
						});

						model.obj = fbx;
					});
					break;
				case 'gltf':
					gltfLoader.load(model.url, (gltf) => {
						gltf.scene.traverse(child => {
							if (child.isMesh) {
								child.castShadow = true;
								child.receiveShadow = true;
								// if (child.material.depthWrite == true) console.log(child.material)
								// child.material.side = THREE.DoubleSide;
								// if (child.material.depthWrite == true) console.log(child.material)
							}
						});

						model.obj = gltf.scene;
					});
					break;
			}
		}
	}
}


// window.onload = () => {
// 	PhysicsLoader('./libs/ammo', () => {
// 		loadModels();
// 		loadSounds();
// 		document.getElementById("musicbutton").addEventListener("click", playSoundTrack);
// 	});
// }

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

class MainScene extends Scene3D {
	constructor() {
		super('MainScene');
	}
	async init() {
		this.renderer.setPixelRatio(1)
		this.renderer.setSize(window.innerWidth, window.innerHeight)
		this.renderer.autoClear = false;
		this.renderer.shadowMap.enabled = true
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	}
	async preload() {

		const city = this.load.preload('city', './models/scene.gltf')
		const drone = this.load.preload('drone', './models/drone.gltf')
		await Promise.all([city, drone])
	}

	async create() {
		document.getElementById("menu").style.display = 'block';
		let camera, scene, thirdPersonCamera, controls, rain, rainGeo, rainCount = 15000;
		let radius, theta, phi;


		var width = window.innerWidth;
		var height = window.innerHeight;
		this.warpSpeed('-ground', '-orbitControls', '-light', '-grid')
		this.physics.debug.enable();

		// camera
		{
			camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 40);

			radius = 0.6;
			theta = 0;
			phi = Math.PI / 6;


			controls = new PointerLockControls(camera, this.canvas);

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
			droneSound = new THREE.Audio(listener);
			audioLoader = new THREE.AudioLoader();
		}
		//rain
		{
			const points = [];
			for (let i = 0; i < rainCount; i++) {
				let rainDrop = new THREE.Vector3(
					Math.random() * 400 - 200,
					Math.random() * 500 - 250,
					Math.random() * 400 - 200
				);
				rainDrop.velocity = {};
				rainDrop.velocity = 0;
				points.push(rainDrop);
			}
			rainGeo = new THREE.BufferGeometry().setFromPoints(points);
			let rainMaterial = new THREE.PointsMaterial({
				color: 0xaaaaaa,
				size: 0.1,
				transparent: true
			});
			rain = new THREE.Points(rainGeo, rainMaterial);
			this.add.existing(rain);
		}
		// sky
		{
			const skyColor = 0xB1E1FF;  // light blue
			const groundColor = 0xB97A20;  // brownish orange
			const intensity = 1;
			const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
			// this.add(light);
		}

		const initDrone = async () => {
			models.drone.obj = await this.load.gltf('drone');
			modelsLoaded = true;
			drone.mesh = new THREE.Object3D();
			drone.mesh.name = "Drone";
			drone.mesh.add(models.drone.obj.scene.getObjectByName('body'));
			drone.mesh.scale.set(0.01, 0.01, 0.01)
			drone.positionFrame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.066, 0.2));
			drone.positionFrame.material.visible = false;
			// drone.positionFrame.position.set(2.9802289996865827, 9.867894072051383, -14.220647606355177);
			drone.rotationFrame = new THREE.Mesh();
			drone.rotationFrame.add(new THREE.AxesHelper(15))
			this.add.existing(drone.positionFrame);
			this.physics.add.existing(drone.positionFrame);
			// console.log(drone.positionFrame);
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
					if (key === 'u') {
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
			thirdPersonCamera.SetTarget(drone.positionFrame);
			

		}
		initDrone();
		const initCity = async () => {
			models.city.obj = await this.load.gltf('city');
			city.mesh = new THREE.Object3D();
			city.mesh.name = "City";

			city.mesh.add(models.city.obj.scene.getObjectByName('Model'));
			city.mesh.position.set(69, -1, 75);
			city.mesh.scale.set(2, 2, 2);
			this.add.existing(city.mesh);
			city.mesh.traverse(child => {
				if (child.isMesh) {
					child.material.metalness = 0
					child.material.roughness = 1

					if (/mesh/i.test(child.name)) {
						this.physics.add.existing(child, {
							shape: 'concave',
							mass: 0,
							collisionFlags: 1,
							autoCenter: false
						})
						child.body.setAngularFactor(0, 0, 0)
						child.body.setLinearFactor(0, 0, 0)
					}
				}
			})
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
			light.shadow.bias = -0.001;
			// console.log(light.shadow.camera)
			// drone.positionFrame.add(light);
			// drone.positionFrame.add(light.target);
			const cameraHelper = new THREE.CameraHelper(light.shadow.camera);
			// scene.add(cameraHelper);
			const lightHelper = new THREE.DirectionalLightHelper(light, 5, 0xff0000);
			this.add.existing(lightHelper);
		}

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




		this.camera = camera;
		this.thirdPersonCamera = thirdPersonCamera;
		this.theta = theta;
		this.phi = phi;
		this.radius = radius;
		this.hudBitmap = hudBitmap;
		this.hudTexture = hudTexture;
		this.rain = rain;
		this.sceneHUD = sceneHUD;
		this.cameraHUD = cameraHUD;
	}
	update(time, dt) {
		if (!modelsLoaded) return;
		time *= 0.001;
		dt *= 0.001;

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
		this.thirdPersonCamera.Update(dt, this.theta, this.phi);

		this.hudBitmap.clearRect(0, 0, window.innerWidth, window.innerHeight);
		this.hudBitmap.fillText("FPS:" + Math.round(1 / dt), 100, 50)
		this.hudBitmap.fillText((acc.y + g).toFixed(2), 100, 100)
		this.hudTexture.needsUpdate = true;


		//rain
		var positionAttribute = this.rain.geometry.getAttribute('position');
		for (var i = 0; i < positionAttribute.count; i++) {
			vertex.fromBufferAttribute(positionAttribute, i);
			vertex.y -= 1;
			if (vertex.y < - 200) {
				vertex.y = 200;
			}
			positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
		}
		positionAttribute.needsUpdate = true;

		// renderer.render(scene, camera);

		this.renderer.render(this.sceneHUD, this.cameraHUD);
		TWEEN.update()
	}
}

function main() {
	document.getElementById("menu").style.display = 'block';

	let camera, scene, renderer, thirdPersonCamera, controls, rain, rainGeo, rainCount = 15000;
	let radius, theta, phi;


	var width = window.innerWidth;
	var height = window.innerHeight;

	const canvas = document.querySelector('#c');
	renderer = new THREE.WebGL1Renderer({
		canvas,
		antialias: true
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
	scene.background = new THREE.Color(0x87ceeb);


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
		droneSound = new THREE.Audio(listener);
		audioLoader = new THREE.AudioLoader();
	}

	//rain
	{

		const points = [];
		for (let i = 0; i < rainCount; i++) {
			let rainDrop = new THREE.Vector3(
				Math.random() * 400 - 200,
				Math.random() * 500 - 250,
				Math.random() * 400 - 200
			);
			rainDrop.velocity = {};
			rainDrop.velocity = 0;
			points.push(rainDrop);
		}
		rainGeo = new THREE.BufferGeometry().setFromPoints(points);
		let rainMaterial = new THREE.PointsMaterial({
			color: 0xaaaaaa,
			size: 0.1,
			transparent: true
		});
		rain = new THREE.Points(rainGeo, rainMaterial);
		scene.add(rain);
	}

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

		drone.mesh.add(models.drone.obj.getObjectByName('body'));
		drone.mesh.scale.set(0.01, 0.01, 0.01)
		drone.positionFrame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.066, 0.2));
		drone.positionFrame.material.visible = false;
		// drone.positionFrame.position.set(2.9802289996865827, 9.867894072051383, -14.220647606355177);
		drone.rotationFrame = new THREE.Mesh();
		drone.rotationFrame.add(new THREE.AxesHelper(15))
		scene.add(drone.positionFrame);
		console.log(drone.positionFrame);
		physics.addMesh(drone.positionFrame, 1);
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
				if (key === 'u') {
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
	const floor = new THREE.Mesh(
		new THREE.BoxGeometry(200, 0.5, 200)
	);
	floor.material.visible = false;
	floor.position.y = -0.4;
	floor.receiveShadow = true;
	scene.add(floor);
	initDrone();

	function initCity() {
		city.mesh = new THREE.Object3D();
		city.mesh.name = "City";

		city.mesh.add(models.city.obj.getObjectByName('Model'));
		city.mesh.position.set(69, -1, 75);
		city.mesh.scale.set(2, 2, 2);
		scene.add(city.mesh);
		city.mesh.traverse(o => {
			if (o.isMesh) {
				var bbox = new THREE.Box3().setFromObject(o);
				// var geom = new Geometry()
				// var hitbox = new THREE.Mesh(geom.fromBufferGeometry(o.geometry));
				var hitbox_visual = new THREE.Mesh(o.geometry);
				// hitbox.geometry.attributes = o.geometry.attributes;
				var hitbox_2 = new THREE.Mesh(new THREE.BoxGeometry(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y, bbox.max.z - bbox.min.z));
				// hitbox.scale.set(2, 2, 2);
				// hitbox.position.set(69/2, -1/2, 75/2);
				hitbox_visual.scale.set(2, 2, 2);
				hitbox_visual.position.set(69 / 2, -1 / 2, 75 / 2);
				new OIMO.RigidBody()

				// hitbox.position.x = (bbox.min.x+bbox.max.x)/2;
				// hitbox.position.y = (bbox.min.y+bbox.max.y)/2;
				// hitbox.position.z = (bbox.min.z+bbox.max.z)/2;
				hitbox_visual.material.color = new THREE.Color(0xff00000);
				scene.add(hitbox_visual);
				// physics.addMesh(hitbox);
			}
		})
		// console.log(physics);
		scene.add(new THREE.Mesh(new THREE.BufferGeometry()))
		console.log(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1)))
		// physics.addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1)));
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
		light.shadow.bias = -0.001;
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
		hudBitmap.fillText("FPS:" + Math.round(1 / dt), 100, 50)
		hudBitmap.fillText((acc.y + g).toFixed(2), 100, 100)
		hudTexture.needsUpdate = true;


		//rain
		var positionAttribute = rain.geometry.getAttribute('position');
		for (var i = 0; i < positionAttribute.count; i++) {
			vertex.fromBufferAttribute(positionAttribute, i);
			vertex.y -= 1;
			if (vertex.y < - 200) {
				vertex.y = 200;
			}
			positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
		}
		positionAttribute.needsUpdate = true;

		renderer.render(scene, camera);

		renderer.render(sceneHUD, cameraHUD);
		TWEEN.update()
	}
}

window.addEventListener('load', () => {
	PhysicsLoader('./libs/ammo', () => {
		const project = new Project({ antialias: true, maxSubSteps: 10, fixedTimeStep: 1 / 120, scenes: [MainScene] })

		const destination = document.getElementById('drone')
		destination.appendChild(project.canvas)
		document.getElementById("musicbutton").addEventListener("click", playSoundTrack);

		project.canvas.style.marginTop = '0px !important'

		const resize = () => {
			const newWidth = window.innerWidth;
			const newHeight = window.innerHeight;

			destination.style.width = `${newWidth}px`;
			destination.style.height = `${newHeight}px1`;

			project.renderer.setSize(newWidth, newHeight);
			project.camera.aspect = newWidth / newHeight;
			max_mousemove = Math.pow(1580, Math.min(1 / project.camera.aspect, project.camera.aspect));
			project.camera.updateProjectionMatrix();
		}

		window.onresize = resize;
		resize();
	})
})