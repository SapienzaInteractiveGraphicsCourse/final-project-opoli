import * as THREE from './three.js-master/build/three.module.js';
import { OBJLoader } from './three.js-master/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from './three.js-master/examples/jsm/controls/OrbitControls.js';
import { MTLLoader } from './three.js-master/examples/jsm/loaders/MTLLoader.js';
function onProgress(xhr) {
	console.log((xhr.loaded / xhr.total * 100) + '% loaded');
}
function onError(error) {
	console.log('An error happened');
}
function frameArea(sizeToFitOnScreen, boxSize, boxCenter, camera) {
	const halfSizeToFitOnScreen = sizeToFitOnScreen * 0.5;
	const halfFovY = THREE.MathUtils.degToRad(camera.fov * .5);
	const distance = halfSizeToFitOnScreen / Math.tan(halfFovY);

	const direction = (new THREE.Vector3())
    .subVectors(camera.position, boxCenter)
    .multiply(new THREE.Vector3(1, 0, 1))
    .normalize();

	// move the camera to a position distance units way from the center
	// in whatever direction the camera was from the center already
	camera.position.copy(direction.multiplyScalar(distance).add(boxCenter));

	// pick some near and far values for the frustum that
	// will contain the box.
	camera.near = boxSize / 100;
	camera.far = boxSize * 100;

	camera.updateProjectionMatrix();

	// point the camera to look at the center of the box
	camera.lookAt(boxCenter.x, boxCenter.y, boxCenter.z);
}
function main() {

	let camera, scene, renderer;
	let geometry, material, cube;

	const canvas = document.querySelector('#c');
	renderer = new THREE.WebGL1Renderer({ canvas });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setAnimationLoop(animation);


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
		light.position.set(0, 10, 0);
		light.target.position.set(-5, 0, 0);
		scene.add(light);
		scene.add(light.target);
	}

	{
		const mtlLoader = new MTLLoader();
		mtlLoader.load('./materials/windmill1.mtl', (mtl) => {
			mtl.preload();
			const objLoader = new OBJLoader();
			objLoader.setMaterials(mtl);
			objLoader.load('./models/windmill1.obj', (root) => {
				scene.add(root);
			});
		});
	}
	{
		const mtlLoader = new MTLLoader();
		mtlLoader.load('./materials/drone.mtl', (mtl) => {
			mtl.preload();
			const objLoader = new OBJLoader();
			objLoader.setMaterials(mtl);
			objLoader.load('./models/drone.obj', (root) => {
				root.traverse((child) => {
					console.log(child)
				})
				scene.add(root);
			});
		});
	}
	scene.traverse(function(obj) {

	})

	function animation(time) {
		time *= 0.001;
		renderer.render(scene, camera);
	}
}
main();

