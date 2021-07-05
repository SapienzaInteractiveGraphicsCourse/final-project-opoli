import * as THREE from './three.js-master/build/three.module.js';
import { GLTFLoader } from './three.js-master/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from './three.js-master/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from './three.js-master/examples/jsm/controls/PointerLockControls.js';
import { MTLLoader } from './three.js-master/examples/jsm/loaders/MTLLoader.js';
import TWEEN, { Easing } from './libs/tween.esm.js'
function onProgress(xhr) {
	console.log((xhr.loaded / xhr.total * 100) + '% loaded');
}
function onError(error) {
	console.log('An error happened');
}
var modelsLoaded = false;
const models = {
	drone: { url: './models/drone.gltf' }
}
function loadModels() {
	const modelsLoadMngr = new THREE.LoadingManager();
	modelsLoadMngr.onLoad = () => {
		modelsLoaded = true;

		// document.querySelector('#models_loading').hidden = true;

		if (modelsLoaded) {
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
				const standardMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 })
				gltf.scene.traverse(function (child) {

					if (child.isMesh) {
						child.castShadow = true;
						child.receiveShadow = true;
						child.material = standardMaterial;
					}

				});

				model.gltf = gltf.scene;
			});
		}
	}
}

window.onload = loadModels;
var drone = {
	mesh: null,
	referenceFrame: null,
	positions: {
		left: -1,
		ahead: 0,
		right: 1,
		back: 2,
		up: 3,
		down: 4
	},
	elements: {
		propellers: {},
	},
	rotations: {

	}
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


	let camera, scene, renderer, thirdPersonCamera, controls;
	let radius, theta, phi;

	var width = window.innerWidth;
	var height = window.innerHeight;

	const canvas = document.querySelector('#c');
	renderer = new THREE.WebGL1Renderer({ canvas });
	renderer.setSize(width, height);
	renderer.autoClear = false;
	renderer.setAnimationLoop(animation);
	renderer.shadowMap.enabled = true

	// creating scene
	scene = new THREE.Scene();

	// camera
	{
		camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 1000);
		// camera.position.set(0, 50, -100);
		// camera.lookAt(0, 0, 0);

		radius = 60;
		theta = 0;
		phi = Math.PI / 6;

		window.addEventListener('resize', () => {
			width = window.innerWidth;
			height = window.innerHeight;
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.setSize(width, height);
		}, false);

		controls = new PointerLockControls(camera, canvas);

		document.addEventListener('click', () => {
			controls.lock();
		})

		document.addEventListener('mousemove', (event) => {
			if (controls.isLocked) {
				var dx = Math.max(-15, Math.min(event.movementX, 15))*0.001;
				var dy = Math.max(-15, Math.min(event.movementY, 15))*0.001;

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

	// plane
	{
		const planeSize = 400;

		const loader = new THREE.TextureLoader();
		const texture = loader.load('./textures/checker.png');
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.magFilter = THREE.NearestFilter;
		const repeats = planeSize / 20;
		texture.repeat.set(repeats, repeats);

		const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
		const planeMat = new THREE.MeshPhongMaterial({
			map: texture,
			side: THREE.DoubleSide,
		});
		const mesh = new THREE.Mesh(planeGeo, planeMat);
		mesh.rotation.x = Math.PI * -.5;
		mesh.receiveShadow = true;
		scene.add(mesh);
	}
	// sky
	{
		const skyColor = 0xB1E1FF;  // light blue
		const groundColor = 0xB97A20;  // brownish orange
		const intensity = 1;
		const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
		scene.add(light);
	}
	// dirlight
	{
		const color = 0xFFFFFF;
		const intensity = 1;
		const light = new THREE.DirectionalLight(color, intensity);
		light.castShadow = true;
		light.position.set(100, 100, 0);
		light.target.position.set(0, 0, 0);
		light.shadow.camera = new THREE.OrthographicCamera(-50, 50, 50, -50);
		light.shadow.mapSize.width = 2048;
		light.shadow.mapSize.height = 2048;
		console.log(light.shadow.camera)
		scene.add(light);
		scene.add(light.target);
		const cameraHelper = new THREE.CameraHelper(light.shadow.camera);
		scene.add(cameraHelper);
	}


	function initDrone() {
		drone.mesh = new THREE.Object3D();
		drone.mesh.name = "Drone";

		drone.mesh.add(models.drone.gltf.getObjectByName('body'));
		drone.referenceFrame = new THREE.Mesh();
		drone.referenceFrame.position.y = 10;
		drone.referenceFrame.add(new THREE.AxesHelper(15))
		scene.add(drone.referenceFrame);
		drone.referenceFrame.add(drone.mesh);
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

		// event listeners

	}
	initDrone();
	thirdPersonCamera = new ThirdPersonCamera({
		camera: camera,
		target: drone.referenceFrame,
		radius: radius
	})
	{
		var tween_forward;
		var tween_backwards;
		var tween_right;
		var tween_left;
	}
	console.log(drone)
	{
		var transition = 1000;
		var ease_func = TWEEN.Easing.Elastic.Out;
		// var ease_func = TWEEN.Easing.Quartic.Out;
		function applyTweens(key) {
			inputs[key] = true;
			if (inputs.w) tween_forward = new TWEEN.Tween(drone.mesh.rotation).to({ x: 0.2 }, transition).start().easing(ease_func);
			if (inputs.s) tween_backwards = new TWEEN.Tween(drone.mesh.rotation).to({ x: -0.2 }, transition).start().easing(ease_func);
			if (inputs.d) tween_right = new TWEEN.Tween(drone.mesh.rotation).to({ z: 0.2 }, transition).start().easing(ease_func);
			if (inputs.a) tween_left = new TWEEN.Tween(drone.mesh.rotation).to({ z: -0.2 }, transition).start().easing(ease_func);
		}
		document.addEventListener('keydown', function (event) {
			let key = event.key.toLowerCase();
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
			if (!(inputs.w || inputs.s)) new TWEEN.Tween(drone.mesh.rotation).to({ x: 0 }, transition).start().easing(ease_func);
			if (!(inputs.a || inputs.d)) new TWEEN.Tween(drone.mesh.rotation).to({ z: 0 }, transition).start().easing(ease_func);
			if (key === "w") {
				tween_forward.stop();
			}
			if (key === "s") {
				tween_backwards.stop();
			}
			if (key === "a") {
				tween_left.stop();
			}
			if (key === "d") {
				tween_right.stop();
			}
		});
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
	var oldtime = 0;
	var ay = 9.81;
	var speedy = 0;
	function animation(time) {
		time *= 0.001;
		var dt = time - oldtime;
		oldtime = time;


		const prop_speed = 10;
		const rot = time * prop_speed;
		drone.elements.propellers.propellerFR.rotation.y = -rot;
		drone.elements.propellers.propellerFL.rotation.y = -rot;
		drone.elements.propellers.propellerBR.rotation.y = -rot;
		drone.elements.propellers.propellerBL.rotation.y = -rot;

		const speed = 50;
		const ang_speed = 1;
		var dO = ang_speed * dt;
		var ds = speed * dt;
		const g = -9.81;
		if (inputs[" "]) ay += 0.4;
		if (inputs["<"]) ay -= 0.4;

		if (inputs.e) drone.referenceFrame.rotation.y -= dO;
		if (inputs.q) drone.referenceFrame.rotation.y += dO;

		var cos_rot_y = Math.cos(drone.referenceFrame.rotation.y);
		var sin_rot_y = Math.sin(drone.referenceFrame.rotation.y);
		if (inputs.w) {
			drone.referenceFrame.position.z += cos_rot_y * ds;
			drone.referenceFrame.position.x += sin_rot_y * ds;
		}
		if (inputs.s) {
			drone.referenceFrame.position.z -= cos_rot_y * ds;
			drone.referenceFrame.position.x -= sin_rot_y * ds;
		}
		if (inputs.a) {
			drone.referenceFrame.position.x += cos_rot_y * ds;
			drone.referenceFrame.position.z -= sin_rot_y * ds;
		}
		if (inputs.d) {
			drone.referenceFrame.position.x -= cos_rot_y * ds;
			drone.referenceFrame.position.z += sin_rot_y * ds;
		}
		speedy += (ay + g) * dt;
		drone.referenceFrame.position.y += speedy * dt;
		// camera.lookAt(drone.referenceFrame.position.x, drone.referenceFrame.position.y, drone.referenceFrame.position.z);
		// controls.update();
		thirdPersonCamera.Update(dt, theta, phi);

		hudBitmap.clearRect(0, 0, width, height);
		hudBitmap.fillText(Math.round(1 / dt), 50, 50)
		hudBitmap.fillText((ay + g).toFixed(2), 50, 100)
		hudTexture.needsUpdate = true;


		renderer.render(scene, camera);

		renderer.render(sceneHUD, cameraHUD);
		TWEEN.update()
	}
}
