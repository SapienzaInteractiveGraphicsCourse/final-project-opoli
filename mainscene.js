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
import TWEEN, { Easing, Tween } from './libs/tween.esm.js';
import { AxesHelper, BoxGeometry, LineBasicMaterial, Mesh, MeshPhongMaterial, MultiplyOperation, Plane, PlaneGeometry, TextureLoader, Vector3 } from './three.js-master/build/three.module.js';
import { PointerLockControls } from './three.js-master/examples/jsm/controls/PointerLockControls.js';
import { Water } from './three.js-master/examples/js/objects/Water.js';
import { CSM } from './three.js-master/examples/jsm/csm/CSM.js'
import { CSMHelper } from './three.js-master/examples/jsm/csm/CSMHelper.js'

// /**
//  * Is touch device?
//  */

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

// tweens
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


const transition_s = 700;
const transition = 2 * transition_s;
const time_up = 5000;
const time_yaw = 200;
var ease_func = TWEEN.Easing.Elastic.Out;
var ease_func_speed = TWEEN.Easing.Quartic.Out;
var ease_func_up = TWEEN.Easing.Linear.None;
var throttle_control = false;

var sound, listener, droneSound;
var soundsLoaded = false;
const sounds = {
	background: { url: './sounds/music.mp3' },
	drone: { url: './sounds/drone.mp3' },
}

function loadSounds() {
	const soundsLoaderMngr = new THREE.LoadingManager();
	soundsLoaderMngr.onLoad = () => {
		soundsLoaded = true;
	};
	/*soundsLoaderMngr.onProgress = (url, itemsLoaded, itemsTotal) => {
		console.log("Loading sounds... ", itemsLoaded / itemsTotal * 100, '%');
	};*/
	const audioLoader = new THREE.AudioLoader(soundsLoaderMngr);
	for (const sound of Object.values(sounds)) {
		audioLoader.load(sound.url, function (buffer) {
			sound.sound = buffer;
			//console.log("Loaded ", buffer);
		});
	}
}

function showCommands() {
	if (document.getElementById("commands").style.display == 'block') {
		document.getElementById("commands").style.display = 'none';
	} else {
		document.getElementById("commands").style.display = 'block';
	}
}

function playSoundTrack() {
	if (!soundsLoaded) return;
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
		droneSound.setVolume(0.05);
		droneSound.play();
	}
}




class MainScene extends Scene3D {
	constructor() {
		super('MainScene')
	}

	init() {
		this.renderer.setPixelRatio(Math.max(1, window.devicePixelRatio / 2))
		this.imageLoader = new TextureLoader();

		// camera
		{
			this.camera = new THREE.PerspectiveCamera(60, this.camera.aspect, 0.1, 1000);




			this.radius = 10;
			this.theta = 0;
			this.phi = Math.PI / 6;


			this.controls = new PointerLockControls(this.camera, this.canvas);

			this.thirdPersonCamera = new ThirdPersonCamera({
				camera: this.camera,
				target: null,
				radius: this.radius
			})

			// csm
			// this.renderer.shadowMap.enabled = true;
			// this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // or any other type of shadowmap
			// this.csm = new CSM({
			// 	maxFar: this.camera.far,
			// 	cascades: 4,
			// 	shadowMapSize: 1024,
			// 	lightDirection: new THREE.Vector3(1, 1, 1).normalize(),
			// 	camera: this.camera,
			// 	parent: this.scene
			// });
			// let material = new THREE.MeshPhongMaterial(); // works with Phong and Standard materials
			// this.csm.setupMaterial(material); // must be called to pass all CSM-related uniforms to the shader




			document.addEventListener('click', () => {
				this.controls.lock();
			})
			var max_mousemove = Math.pow(1580, 1 / this.camera.aspect);;
			document.addEventListener('mousemove', (event) => {
				if (this.controls.isLocked) {
					var dx = Math.max(-max_mousemove, Math.min(event.movementX, max_mousemove)) * 0.001;
					var dy = Math.max(-max_mousemove, Math.min(event.movementY, max_mousemove)) * 0.001;
					// console.log(event.movementX, event.movementY, camera.aspect)

					this.theta += dx * Math.PI / 2;
					this.phi += dy * Math.PI / 2;
					if (Math.abs(this.phi) > Math.PI / 2) {
						this.phi = this.phi > 0 ? Math.PI / 2 - 0.001 : -Math.PI / 2 + 0.001;
					}
					this.phi -= Math.abs(this.phi) > 2 * Math.PI ? this.phi < 0 ? -2 * Math.PI : 2 * Math.PI : 0;
					this.theta -= Math.abs(this.theta) > 2 * Math.PI ? this.theta < 0 ? -2 * Math.PI : 2 * Math.PI : 0;

				}
			})

		}

		//sounds
		{
			listener = new THREE.AudioListener();
			this.camera.add(listener);
			sound = new THREE.Audio(listener);
			droneSound = new THREE.Audio(listener);
			//audioLoader = new THREE.AudioLoader();
		}

		//rain
		{
			let rain, rainGeo, rainCount = 15000;
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
			this.rain = rain;
		}

		// this.physics.collisionEvents.on('collision', data => {
		// 	const { bodies, event } = data
		// 	console.log(bodies[0].name, bodies[1].name, event)
		// })
	}

	async preload() {
		const city = this.load.preload('city', './models/scene.gltf')

		const drone = this.load.preload('drone', './models/drone.glb')

		await Promise.all([city, drone])
	}

	speed = new Vector3(0, 0, 0);
	ang = new Vector3(0, 0, 0);
	acc = new Vector3(0, 0, 0);
	ang_speed = new Vector3(0, 0, 0);
	freefall = false;
	gameStarted = false;
	old_ang = new Vector3(0, 0, 0);
	old_speed_y = 0;
	oldTime = -0.007;
	fuel = 3000;
	gauge = null;
	max_speed_y = 15;

	applyTweens(key) {
		inputs[key] = true;
		if (inputs.w) tweens.w = [
			new TWEEN.Tween(this.speed).to({ z: 10 }, transition_s).start().easing(ease_func_speed),
			new TWEEN.Tween(this.ang).to({ x: 0.2 }, transition).start().easing(ease_func)
		];
		if (inputs.s) tweens.s = [
			new TWEEN.Tween(this.speed).to({ z: -10 }, transition_s).start().easing(ease_func_speed),
			new TWEEN.Tween(this.ang).to({ x: -0.2 }, transition).start().easing(ease_func)
		];
		if (inputs.a) tweens.a = [
			new TWEEN.Tween(this.speed).to({ x: 10 }, transition_s).start().easing(ease_func_speed),
			new TWEEN.Tween(this.ang).to({ z: -0.2 }, transition).start().easing(ease_func)
		];
		if (inputs.d) tweens.d = [
			new TWEEN.Tween(this.speed).to({ x: -10 }, transition_s).start().easing(ease_func_speed),
			new TWEEN.Tween(this.ang).to({ z: 0.2 }, transition).start().easing(ease_func)
		];
		if (inputs.e) tweens.e = new TWEEN.Tween(this.ang_speed).to({ y: -Math.PI }, time_yaw).start().easing(ease_func_up)
		if (inputs.q) tweens.q = new TWEEN.Tween(this.ang_speed).to({ y: Math.PI }, time_yaw).start().easing(ease_func_up)
		if (throttle_control) return;
		if (inputs[" "] && this.speed.y < this.max_speed_y && !tweens[" "]) {
			tweens[" "] = new TWEEN.Tween(this.speed).to({ y: '+10' }, time_up).start().easing(ease_func_up).onUpdate(() => {
				if (this.speed.y < this.max_speed_y) return;
				tweens[" "].stop();
				tweens[" "] = null;
			});
		}
		if (inputs["<"] && this.speed.y > 0 && !tweens["<"]) {
			tweens["<"] = new TWEEN.Tween(this.speed).to({ y: '-10' }, time_up).start().easing(ease_func_up).onUpdate(() => {
				if (this.speed.y > 0) return;
				tweens["<"].stop();
				tweens["<"] = null;
			});
		}
	}
	droneElements = {};



	async create() {
		const { lights } = await this.warpSpeed('-ground', '-orbitControls')

		let sky = this.scene.children[1]
		this.physics.add.existing(sky, {
			shape: 'concave',
			collisionFlags: 1,
			mass: 0
		})

		const { hemisphereLight, ambientLight, directionalLight } = lights
		const intensity = 0.65
		hemisphereLight.intensity = 0
		ambientLight.intensity = intensity
		directionalLight.intensity = intensity
		this.directional = directionalLight

		// ground
		this.ground = new ExtendedObject3D()
		this.ground.add(new Mesh(new PlaneGeometry(1000, 1000), new MeshPhongMaterial({ color: 0xff0000 })));
		this.ground.rotation.x = -Math.PI / 2
		this.ground.position.setY(-3.5)
		this.ground.visible = false;

		this.add.existing(this.ground)
		this.physics.add.existing(this.ground, {
			collisionFlags: 1,
			mass: 0
		})


		const addCity = async () => {
			var tex_map, tex_normal_map;
			this.imageLoader.load('./textures/grass.jpeg', (texture) => {
				tex_map = texture
				tex_map.wrapS = THREE.RepeatWrapping;
				tex_map.wrapT = THREE.RepeatWrapping;

				tex_map.repeat.set(0.5, 0.5);

				tex_map.anisotropy = 4;
			});
			this.imageLoader.load('./textures/grasslight-big-nm.jpg', (texture) => {
				tex_normal_map = texture
				tex_normal_map.wrapS = THREE.RepeatWrapping;
				tex_normal_map.wrapT = THREE.RepeatWrapping;

				tex_normal_map.repeat.set(0.5, 0.5);

				tex_normal_map.anisotropy = 4;
			});


			const object = await this.load.gltf('city')
			const scene = object.scenes[0]

			const city = new ExtendedObject3D()
			city.name = 'scene'
			city.add(scene)
			city.scale.set(10, 10, 10)
			city.position.set(430, -5, 400)
			this.add.existing(city)

			city.traverse(child => {
				if (child.isMesh) {
					if (child.name.includes("Green")) {
						child.material.color.setHex(0xffffff);
						child.material.map = tex_map;
						child.material.normalMap = tex_normal_map;
						child.material.map.needsUpdate = true
						child.material.normalMap.needsUpdate = true

					} else if (child.material.color.r === 0.5684522089150544) {
						child.material.color.setRGB(0.752941, 0.752941, 0.752941)
					} else if (child.name.includes("Cyan")) {

					}
					child.castShadow = child.receiveShadow = true;
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
		const addDrone = async () => {
			const object = await this.load.gltf('drone')
			const drone = object.scene.children[0]

			this.drone = new ExtendedObject3D()
			this.drone.name = 'drone'
			this.drone.add(drone)
			this.drone.add(new AxesHelper(2));
			this.drone.position.set(35, 1, 0)
			// add shadow
			this.drone.traverse(child => {
				if (child.isMesh) {
					child.castShadow = child.receiveShadow = true;
					child.material.roughness = 1
					child.material.metalness = 0
					if (child.name === "PropellerFR") {
						this.droneElements.propellerFR = child;
						child.material.color.setHex(0x000000)
					}
					if (child.name === "PropellerFL") {
						this.droneElements.propellerFL = child;
						child.material.color.setHex(0x000000)
					}
					if (child.name === "PropellerBR") {
						this.droneElements.propellerBR = child;
						child.material.color.setHex(0x000000)
					}
					if (child.name === "PropellerBL") {
						this.droneElements.propellerBL = child;
						child.material.color.setHex(0x000000)
					}
					if (child.name === "propellers_axes") {
						this.droneElements.propellers_axes = child
					}
				}
			})
			this.add.existing(this.drone)
			this.physics.add.existing(this.drone, {
				shape: 'hull',
				mass: 1
			})

			this.drone.body.checkCollisions = true;

			this.drone.body.on.collision((otherObj, event) => {
				// console.log(otherObj.material.color, otherObj);
				if (otherObj.name.includes("CONSUMABLE")) {
					this.physics.destroy(otherObj.body)
					otherObj.parent.remove(otherObj)
					console.log('CONSUMABILE HITTATO ' + otherObj.name)
				} else if (otherObj.name === "PropellerFR" || otherObj.name === "PropellerFL" || otherObj.name === "PropellerBR" || otherObj.name === "PropellerBL") {

				} else if (new Vector3(this.drone.body.velocity.x, this.drone.body.velocity.y, this.drone.body.velocity.z).length() > 8) {
					this.collisionDrone();
					console.log('COLLISIONE FORTE')

					if (this.lives == 0) {
						this.freefall = true;
						this.drone.body.setAngularFactor(1, 1, 1)
						new TWEEN.Tween(this.speed).to({ x: 0, y: 0, z: 0 }, time_up).start().easing(ease_func_up)
						new TWEEN.Tween(this.ang_speed).to({ y: 0 }, time_yaw).start().easing(ease_func_up)
					}

				}
			})


			this.drone.body.setFriction(0.8)
			this.drone.body.setAngularFactor(0, 0, 0)

			this.drone.body.setCcdMotionThreshold(1e-7)
			this.drone.body.setCcdSweptSphereRadius(0.25)
			this.thirdPersonCamera.SetTarget(this.drone);

			var context = this;
			// event listeners
			document.addEventListener('keydown', function (event) {
				if (context.freefall) return;
				let key = event.key.toLowerCase();
				if (key === "h") console.log(context.drone.position)
				if (key === "g") {
					context.drone.body.setCollisionFlags(2);
					context.drone.position.setY(100);
					context.drone.body.needUpdate = true;
					context.drone.body.once.update(() => {
						context.drone.body.setCollisionFlags(0);
						context.drone.body.setVelocity(0, 0, 0);
					})
				}
				if (key === 'u') {
					playSoundTrack();
				}
				if ("wsadqe< ".indexOf(key) == -1) return;
				if (!inputs[key]) {
					if (inputs[exclusives[key]]) {
						inputs_queue[key] = true;
						return;
					}

					context.applyTweens(key);
				}
			});

			document.getElementById("musicbutton").addEventListener("click", playSoundTrack);
			document.getElementById("joystickbutton").addEventListener("click", showCommands);

			document.addEventListener('keyup', function (event) {
				if (context.freefall) return;
				let key = event.key.toLowerCase();
				if ("wsadqe< ".indexOf(key) == -1) return;
				inputs[key] = false;
				inputs_queue[key] = false;
				if (inputs_queue[exclusives[key]]) {
					inputs_queue[exclusives[key]] = false;
					context.applyTweens(exclusives[key]);
				}
				if (!(inputs.w || inputs.s)) {
					new TWEEN.Tween(context.speed).to({ z: 0 }, transition_s).start().easing(ease_func_speed);
					new TWEEN.Tween(context.ang).to({ x: 0 }, transition).start().easing(ease_func);
				};
				if (!(inputs.a || inputs.d)) {
					new TWEEN.Tween(context.speed).to({ x: 0 }, transition_s).start().easing(ease_func_speed);
					new TWEEN.Tween(context.ang).to({ z: 0 }, transition).start().easing(ease_func);
				};
				if (!(inputs.e || inputs.q)) new TWEEN.Tween(context.ang_speed).to({ y: 0 }, time_yaw).start().easing(ease_func_up);

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

		const addWater = async () => {

			var geo = new THREE.PlaneBufferGeometry(1000, 1000, 10, 10);

			var c = this.directional.position.clone();

			var normal = this.imageLoader.load('./textures/waternormals.jpg');

			normal.wrapS = THREE.RepeatWrapping;
			normal.wrapT = THREE.RepeatWrapping;

			var water = new Water(geo, {
				textureWidth: 2048,
				textureHeight: 2048,
				waterNormals: normal,
				alpha: 0.9,
				fog: true,
				distortionScale: 15.0,
				sunDirection: c.normalize(),
				sunColor: 0x7f7f7f,
				waterColor: 0x001e0f,
				side: THREE.DoubleSide
			});

			water.rotation.x = - Math.PI * 0.5;

			water.position.y = -3.5;

			water.matrixAutoUpdate = false;
			water.rotationAutoUpdate = false;
			water.updateMatrix();

			water.name = 'water';
			this.water = water;

			this.add.existing(water);

		}

		addWater().then(() => {
			addCity().then(() => {
				addDrone().then(() => {
					// boxes 
					setTimeout(() => {
						for (let i = 0; i < 20; i++) {
							const x = (Math.random() - 0.5) * 5,
								y = 150,
								z = (Math.random() - 0.5) * 5

							const geometry = new THREE.BoxGeometry(1, 1, 1)
							const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 })
							const box_three = new THREE.Mesh(geometry, material)
							const box_object = new ExtendedObject3D();
							box_object.add(box_three)
							box_object.name = "CONSUMABLE " + i
							box_object.position.set(x, y, z)
							this.add.existing(box_object)
							this.physics.add.existing(box_object)

						}
					}, 1000)
				});
			})
		})

		loadSounds()
	}

	blink_color = 0x000000;
	lives = 3;
	isRaining = false;
	collisionDrone() {
		function changeColor(context, times, color) {
			//console.log("TIMES TO BLINK: "+times)
			if (times == 0) return;

			context.droneElements.propellerBL.material.transparent = true;
			context.droneElements.propellerFL.material.transparent = true;
			context.droneElements.propellerBR.material.transparent = true;
			context.droneElements.propellerFR.material.transparent = true;
			context.droneElements.propellerBL.material.opacity = color;
			context.droneElements.propellerFL.material.opacity = color;
			context.droneElements.propellerBR.material.opacity = color;
			context.droneElements.propellerFR.material.opacity = color;

			context.drone.children[0].material.transparent = true;
			context.drone.children[0].material.opacity = color;
			if (color == 1) {
				setTimeout(function () { changeColor(context, times - 1, 0) }, 500);
			} else {
				setTimeout(function () { changeColor(context, times - 1, 1) }, 500);
			}
		}

		if (this.lives > 0) this.lives -= 1;
		new Noty({
			type: 'warning',
			layout: 'topRight',
			theme: 'nest',
			text: 'You lost 1 life',
			timeout: '3000',
			progressBar: true,
			closeWith: ['click'],
			killer: true,
		}).show();

		if (this.lives > 0) {
			var context = this;
			setTimeout(function () { changeColor(context, 6, 0x000000) }, 500);
		} else {
			new Noty({
				type: 'error',
				layout: 'topRight',
				theme: 'nest',
				text: 'You died.',
				timeout: '3000',
				progressBar: true,
				closeWith: ['click'],
				killer: true,
			}).show();
		}

	}

	shiftRain(isRaining) {
		if (isRaining) {
			this.rain.material.opacity = 1
		} else {
			this.rain.material.opacity = 0
		}
		this.isRaining = isRaining;

		new Noty({
			type: 'info',
			layout: 'topRight',
			theme: 'nest',
			text: isRaining ? "It's raining..." : "The rain has stopped.",
			timeout: '3000',
			progressBar: true,
			closeWith: ['click'],
			killer: true,
		}).show();

		if (isRaining) {
			document.getElementById("rainbutton").src = './menu/rain.png';
		} else {
			document.getElementById("rainbutton").src = './menu/sun.png';
		}

		let context = this;
		setTimeout(function () { context.shiftRain(!isRaining) }, Math.random() * (20000 - 5000) + 5000)
	}

	p_speed_p = new THREE.Vector4(0, 0, 0, 0);
	p_speed_r = new THREE.Vector4(0, 0, 0, 0);
	p_speed_y = new THREE.Vector4(0, 0, 0, 0);
	update(time) {
		const delta = time - this.oldTime
		this.oldTime = time;
		if (delta >= project.projectConfig.maxSubSteps * project.projectConfig.fixedTimeStep) {
			// console.log(project.projectConfig.maxSubSteps);
			// console.log('1/', 1 / project.projectConfig.fixedTimeStep);
			project.projectConfig.maxSubSteps *= 2
			project.projectConfig.fixedTimeStep *= 2
		} else if (delta < project.projectConfig.maxSubSteps * project.projectConfig.fixedTimeStep / 8) {
			project.projectConfig.maxSubSteps /= 2
			project.projectConfig.fixedTimeStep /= 2
		}
		if (this.drone && this.drone.body && this.thirdPersonCamera) {
			if (this.water) {

				this.water.material.uniforms.time.value += 0.5 * delta;

			}
			if (!this.gameStarted) {
				this.shiftRain(false);
				document.getElementById("menu").style.display = 'block';
				document.getElementById("fuel").style.display = 'block';

				var opts = {
					angle: 0.15,
					lineWidth: 0.44,
					radiusScale: 1,
					pointer: {
						length: 0.6,
						strokeWidth: 0.035,
						color: '#000000'
					},
					limitMax: true,
					limitMin: true,
					colorStart: '#6FADCF',
					colorStop: '#8FC0DA',
					strokeColor: '#E0E0E0',
					generateGradient: true,
					highDpiSupport: true,
					staticZones: [
						{ strokeStyle: "#F03E3E", min: 0, max: 500 },
						{ strokeStyle: "#E0E0E0", min: 500, max: 3000 },
					],

				};
				var target = document.getElementById('gauge');
				var gauge = new Gauge(target).setOptions(opts);

				gauge.maxValue = 3000;
				gauge.setMinValue(0);
				gauge.animationSpeed = 32;
				this.gauge = gauge;

				new Noty({
					type: 'success',
					layout: 'topRight',
					theme: 'nest',
					text: 'Hi, you can start playing!',
					timeout: '3000',
					progressBar: true,
					closeWith: ['click'],
					killer: true,
				}).show();
			}
			this.gameStarted = true;

			// fuel simulator
			this.gauge.set(this.fuel);
			this.fuel -= 1;

			this.thirdPersonCamera.Update(delta, this.theta, this.phi);

			this.ang.y += this.ang_speed.y * delta * Math.min(this.speed.y / this.max_speed_y * 2, 1);
			var d_ang = new Vector3(this.ang.x * Math.min(this.speed.y / this.max_speed_y * 2, 1) - this.old_ang.x, this.ang.y - this.old_ang.y, this.ang.z * Math.min(this.speed.y / this.max_speed_y * 2, 1) - this.old_ang.z)
			const d_speed_y = this.speed.y - this.old_speed_y;


			let cos_rot_y, sin_rot_y;
			cos_rot_y = Math.cos(this.ang.y)
			sin_rot_y = Math.sin(this.drone.rotation.y);

			// propellers
			// this.speed.x*=3
			// this.speed.z*=3
			const p_speed = this.speed.y * 10;
			if (!this.freefall) {
				this.drone.body.applyForceY(p_speed * delta / 10 + d_speed_y)
				this.drone.body.applyForceY(-this.drone.body.velocity.y * 0.001)
				this.drone.body.setAngularVelocityY(d_ang.y / delta);
				this.drone.body.setAngularVelocityX((cos_rot_y * d_ang.x + sin_rot_y * d_ang.z) / delta);
				this.drone.body.setAngularVelocityZ((cos_rot_y * d_ang.z - sin_rot_y * d_ang.x) / delta);

				this.drone.body.setVelocityX((cos_rot_y * this.speed.x + sin_rot_y * this.speed.z) * Math.min(this.speed.y / this.max_speed_y * 2, 1));
				this.drone.body.setVelocityZ((cos_rot_y * this.speed.z - sin_rot_y * this.speed.x) * Math.min(this.speed.y / this.max_speed_y * 2, 1));
			}

			this.p_speed_p.x = -d_ang.x / delta;
			this.p_speed_p.y = -d_ang.x / delta;
			this.p_speed_p.z = d_ang.x / delta;
			this.p_speed_p.w = d_ang.x / delta;
			this.p_speed_r.x = -d_ang.z / delta;
			this.p_speed_r.y = d_ang.z / delta;
			this.p_speed_r.z = -d_ang.z / delta;
			this.p_speed_r.w = d_ang.z / delta;
			this.p_speed_y.x = -this.ang_speed.y * 0.25;
			this.p_speed_y.y = this.ang_speed.y * 0.25;
			this.p_speed_y.z = this.ang_speed.y * 0.25;
			this.p_speed_y.w = -this.ang_speed.y * 0.25;

			this.droneElements.propellerFR.rotation.y -= (p_speed + d_speed_y + this.p_speed_p.x + this.p_speed_r.x + this.p_speed_y.x) * delta;
			this.droneElements.propellerFL.rotation.y -= (p_speed + d_speed_y + this.p_speed_p.y + this.p_speed_r.y + this.p_speed_y.y) * delta;
			this.droneElements.propellerBR.rotation.y -= (p_speed + d_speed_y + this.p_speed_p.z + this.p_speed_r.z + this.p_speed_y.z) * delta;
			this.droneElements.propellerBL.rotation.y -= (p_speed + d_speed_y + this.p_speed_p.w + this.p_speed_r.w + this.p_speed_y.w) * delta;


			this.drone.body.needUpdate = true;
			this.old_ang.set(this.ang.x * Math.min(this.speed.y / this.max_speed_y * 2, 1), this.ang.y, this.ang.z * Math.min(this.speed.y / this.max_speed_y * 2, 1));
			this.old_speed_y = this.speed.y;

			//rain
			if (this.isRaining) {
				const vertex = new THREE.Vector3();
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
			}

			TWEEN.update();

			document.getElementById("fps").innerHTML = "FPS: " + Math.round(1 / delta) + "<br> Flight Time: " + Math.round(time) + "s <br>" + "Lives: <span style='color: red'>" + "♥".repeat(this.lives) + "</span>";

			// this.csm.update(this.camera.matrix);
		}
	}
}
var project;
window.addEventListener('load', () => {
	PhysicsLoader('./libs/ammo_new', () => {
		project = new Project({ antialias: true, maxSubSteps: 1, fixedTimeStep: 1 / 960, scenes: [MainScene], gravity: { x: 0, y: -9.81, z: 0 } })

		const destination = document.getElementById('drone')
		destination.appendChild(project.canvas)

		project.canvas.style.marginTop = '0px !important'

		const resize = () => {
			const newWidth = window.innerWidth;
			const newHeight = window.innerHeight;

			destination.style.width = `${newWidth}px`;
			destination.style.height = `${newHeight}px1`;

			project.renderer.setSize(newWidth, newHeight);
			project.camera.aspect = newWidth / newHeight;
			project.camera.updateProjectionMatrix();
		}

		window.onresize = resize;
		resize();
	})
})