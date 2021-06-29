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
loadModels();

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

function main() {

	let camera, scene, renderer;

	const canvas = document.querySelector('#c');
	renderer = new THREE.WebGL1Renderer({ canvas });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setAnimationLoop(animation);
	renderer.shadowMap.enabled = true


	camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
	camera.position.set(0, 10, 20);

	const controls = new OrbitControls(camera, canvas);
	controls.target.set(0, 5, 0);
	controls.update();

	// creating scene
	scene = new THREE.Scene();

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

	{
		const skyColor = 0xB1E1FF;  // light blue
		const groundColor = 0xB97A20;  // brownish orange
		const intensity = 1;
		const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
		scene.add(light);
	}

	{
		const color = 0xFFFFFF;
		const intensity = 1;
		const light = new THREE.DirectionalLight(color, intensity);
		light.castShadow = true;
		light.position.set(100, 100, 0);
		light.target.position.set(0, 0, 0);
		light.shadow.camera = new THREE.OrthographicCamera(-50,50,50,-50);
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
		})
	}
	initDrone();
	console.log(drone)
	scene.traverse(function (obj) {

	})

	function animation(time) {
		time *= 0.001;
		const speed = 10;
		const rot = time * speed;
		drone.elements.propellers.propellerFR.rotation.y = -rot;
		drone.elements.propellers.propellerFL.rotation.y = -rot;
		drone.elements.propellers.propellerBR.rotation.y = -rot;
		drone.elements.propellers.propellerBL.rotation.y = -rot;
		renderer.render(scene, camera);
	}
}
