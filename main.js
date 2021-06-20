import * as THREE from './js/three.module.js';
function main() {

	let camera, scene, renderer;
	let geometry, material, cube;

	const canvas = document.querySelector('#c');
	renderer = new THREE.WebGL1Renderer({ canvas });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setAnimationLoop(animation);


	camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
	camera.position.z = 1;

	// creating scene
	scene = new THREE.Scene();

	function makeInstance(geometry, color, x, y = 0, z = 0) {
		const material = new THREE.MeshPhongMaterial({ color });

		const cube = new THREE.Mesh(geometry, material);
		scene.add(cube);

		cube.position.x = x;
		cube.position.y = y;
		cube.position.z = z;

		return cube;
	}
	geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
	// adding cubes to scene
	const cubes = [
		makeInstance(geometry, 0x44aa88, 0),
		makeInstance(geometry, 0x8844aa, -0.5),
		makeInstance(geometry, 0xaa8844, 0.5),
	];

	// adding directional light to scene
	const color = 0xFFFFFF;
	const intensity = 1;
	const light = new THREE.DirectionalLight(color, intensity);

	light.position.set(-1, 2, 4);
	scene.add(light);


	function animation(time) {
		time *= 0.001;
		cubes.forEach((cube, i) => {
			const speed = 1+ i*.5;
			const rot = time*speed
			cube.rotation.x = rot;
			cube.rotation.y = rot * 2;
		});

		renderer.render(scene, camera);
	}
}
main();

