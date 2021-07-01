import * as THREE from './three.js-master/build/three.module.js';
import { GLTFLoader } from './three.js-master/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from './three.js-master/examples/jsm/controls/OrbitControls.js';
import { MTLLoader } from './three.js-master/examples/jsm/loaders/MTLLoader.js';
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

function main() {


	let camera, scene, renderer;
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

	camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
	camera.position.set(100, 50, 100);
	camera.lookAt(scene.position)

	const controls = new OrbitControls(camera, canvas);
	controls.target.set(0, 5, 0);
	controls.update();

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
		drone.mesh.position.y = 10;
		scene.add(drone.mesh);
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
	{
		document.addEventListener('keydown', function (event) {
			if (event.key == "e") {       // decollo tasto E
				drone.mesh.position.y += 0.001;

			}
		}, true);

		document.addEventListener('keydown', function (event) {
			if (event.key == "q") {		// atterraggio tasto R
				drone.mesh.position.y -= 0.001;

			}
		}, true);

		document.addEventListener('keydown', function (event) {
			if (event.key == "w") {		// avanti tasto W
				drone.mesh.position.z += 0.001;
				if (drone.elements.propellers.body.rotation.x <= 1.75) {
					drone.elements.propellers.body.rotation.x += 0.0001;
				}

			}
		}, true);

		document.addEventListener('keyup', function (event) {
			if (event.key == "w") {		// inclinazione in avanti
				if (drone.elements.propellers.body.rotation.x > 1.57) {
					drone.elements.propellers.body.rotation.x -= 0.0001;
				}

			}
		}, true);

		document.addEventListener('keydown', function (event) {
			if (event.key == "s") {		// indietro tasto S
				drone.mesh.position.z -= 0.001;
				if (drone.elements.propellers.body.rotation.x >= 1.39) {
					drone.elements.propellers.body.rotation.x -= 0.0001;
				}

			}
		}, true);

		document.addEventListener('keyup', function (event) {
			if (event.key == "s") {		// inclinazione indietro
				if (drone.elements.propellers.body.rotation.x < 1.57) {
					drone.elements.propellers.body.rotation.x += 0.0001;
				}

			}
		}, true);


		document.addEventListener('keydown', function (event) {
			if (event.key == "d") {		// destra tasto D
				drone.mesh.position.x -= 0.001;
				if (drone.elements.propellers.body.rotation.y <= 0.20) {
					drone.elements.propellers.body.rotation.y += 0.0001;
				}

			}
		}, true);

		document.addEventListener('keyup', function (event) {
			if (event.key == "d") {		// inclinazione destra
				if (drone.elements.propellers.body.rotation.y >= 0) {
					drone.elements.propellers.body.rotation.y -= 0.0001;
				}

			}
		}, true);

		document.addEventListener('keydown', function (event) {
			if (event.key == "a") {		// sinistra tasto A
				drone.mesh.position.x += 0.001;
				if (drone.elements.propellers.body.rotation.y >= -0.20) {
					drone.elements.propellers.body.rotation.y -= 0.0001;
				}

			}
		}, true);

		document.addEventListener('keyup', function (event) {
			if (event.key == "a") {		// inclinazione sinistra
				if (drone.elements.propellers.body.rotation.y <= 0) {
					drone.elements.propellers.body.rotation.y += 0.0001;
				}

			}
		}, true);
	}
	console.log(drone)
	{
		document.addEventListener('keydown', function (event) {
			inputs[event.key] = true;
		});


		document.addEventListener('keyup', function (event) {
			inputs[event.key] = false;
			// switch (event.key) {
			// 	case "w":
			// 		while (drone.mesh.rotation.x > 1.57) {
			// 			drone.mesh.rotation.x -= 0.0001;
			// 		}
			// 		break;
			// 	case "s":
			// 		while (drone.mesh.rotation.x < 1.57) {
			// 			drone.mesh.rotation.x += 0.0001;
			// 		}
			// 		break;
			// 	case "d":
			// 		while (drone.mesh.rotation.y >= 0) {
			// 			drone.mesh.rotation.y -= 0.0001;
			// 		}
			// 		break;
			// 	case "a":
			// 		while (drone.mesh.rotation.y <= 0) {
			// 			drone.mesh.rotation.y += 0.0001;
			// 		}
			// 		break;
			// 	default:
			// 		break;
			// }
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

		hudBitmap.clearRect(0, 0, width, height);
		hudBitmap.fillText(Math.round(1 / dt), 50, 50)
		hudTexture.needsUpdate = true;

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
		if (inputs[" "]) ay += 0.1;
		if (inputs["<"]) ay -= 0.1;
		if (inputs.w) drone.mesh.position.z += ds;
		if (inputs.s) drone.mesh.position.z -= ds;
		if (inputs.a) drone.mesh.position.x += ds;
		if (inputs.d) drone.mesh.position.x -= ds;
		if (inputs.e) drone.mesh.rotation.y += dO;
		if (inputs.q) drone.mesh.rotation.y -= dO;
		speedy += (ay+g) * dt;
		drone.mesh.position.y += speedy * dt;
		
		renderer.render(scene, camera);
		renderer.render(sceneHUD, cameraHUD);
	}
}
