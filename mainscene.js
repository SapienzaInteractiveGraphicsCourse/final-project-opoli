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
import { AxesHelper, BoxGeometry, LineBasicMaterial, Mesh, MeshPhongMaterial, MultiplyOperation, Vector3 } from './three.js-master/build/three.module.js';
import { PointerLockControls } from './three.js-master/examples/jsm/controls/PointerLockControls.js';

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

const transition_s = 700;
const transition = 2 * transition_s;
const time_up = 5000;
const time_yaw = 200;
var ease_func = TWEEN.Easing.Elastic.Out;
var ease_func_speed = TWEEN.Easing.Quartic.Out;
var ease_func_up = TWEEN.Easing.Linear.None;
var throttle_control = false;

var sound, listener, droneSound, audioLoader;
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
	soundsLoaderMngr.onProgress = (url, itemsLoaded, itemsTotal) => {
		console.log("Loading sounds... ", itemsLoaded / itemsTotal * 100, '%');
	};
	const audioLoader = new THREE.AudioLoader(soundsLoaderMngr);
	for (const sound of Object.values(sounds)) {
		audioLoader.load(sound.url, function (buffer) {
			sound.sound = buffer;
			console.log("Loaded ", buffer);
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
	if(!soundsLoaded) return;
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

		// camera
		{
			this.camera = new THREE.PerspectiveCamera(60, this.camera.aspect, 0.1, 1000);

			this.radius = 5;
			this.theta = 0;
			this.phi = Math.PI / 6;


			this.controls = new PointerLockControls(this.camera, this.canvas);

			this.thirdPersonCamera = new ThirdPersonCamera({
				camera: this.camera,
				target: null,
				radius: this.radius
			})

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
			audioLoader = new THREE.AudioLoader();
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
	control = -9.81;
	fuel = 3000;
	gauge = null;

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
		if (inputs[" "] && this.speed.y < 20 && !tweens[" "]) {
			tweens[" "] = new TWEEN.Tween(this.speed).to({ y: '+10' }, time_up).start().easing(ease_func_up).onUpdate(() => {
				if (this.speed.y < 20) return;
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

	async create() {
		const { lights } = await this.warpSpeed('-ground', '-orbitControls')

		const { hemisphereLight, ambientLight, directionalLight } = lights
		const intensity = 0.65
		hemisphereLight.intensity = intensity
		ambientLight.intensity = intensity
		directionalLight.intensity = intensity

		// this.physics.debug.enable()

		const addCity = async () => {
			const object = await this.load.gltf('city')
			const scene = object.scenes[0]

			const city = new ExtendedObject3D()
			city.name = 'scene'
			city.add(scene)
			city.scale.set(10, 10, 10)
			city.position.set(100, -5, 500)
			this.add.existing(city)

			city.traverse(child => {
				if (child.isMesh) {
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
			// this.drone.rotateY(Math.PI + 0.1) // a hack
			this.drone.add(drone)
			//this.drone.add(new AxesHelper(5));
			this.drone.position.set(35, 1, 0)
			// add shadow
			this.drone.traverse(child => {
				if (child.isMesh) {
					child.castShadow = child.receiveShadow = true;
					// https://discourse.threejs.org/t/cant-export-material-from-blender-gltf/12258
					child.material.roughness = 1
					child.material.metalness = 0
				}
			})

			/**
			 * Add the player to the scene with a body
			 */
			this.add.existing(this.drone)
			this.physics.add.existing(this.drone, {
				shape: 'hull',
				mass: 1
			})

			this.drone.body.checkCollisions = true;

			this.drone.body.on.collision((otherObj, event) => {
				if (otherObj.name === "coin") {

				} else if (new Vector3(this.drone.body.velocity.x, this.drone.body.velocity.y, this.drone.body.velocity.z).length() > 5) {
					this.freefall = true;
					this.drone.body.setAngularFactor(1, 1, 1)
					this.drone.body.setGravity(0,-9.81,0)
					console.log('il drone è diventato matteo germano')
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

		addCity().then(() => {
			addDrone();
		});
		
		loadSounds()

	}

	update(time) {
		const delta = time - this.oldTime
		this.oldTime = time;
		if (this.drone && this.drone.body && this.thirdPersonCamera) {
			if(!this.gameStarted) {
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
						{strokeStyle: "#F03E3E", min: 0, max: 500}, 
						{strokeStyle: "#E0E0E0", min: 500, max: 3000},
					 ],
					
				  };
				  var target = document.getElementById('gauge'); 
				  var gauge = new Gauge(target).setOptions(opts); 
				  
				  gauge.maxValue = 3000; 
				  gauge.setMinValue(0);  
				  gauge.animationSpeed = 32;
				  this.gauge = gauge;
			}
			this.gameStarted = true;

			// fuel simulator
			this.gauge.set(this.fuel); 
			this.fuel -= 1;

			this.thirdPersonCamera.Update(delta, this.theta, this.phi);

			this.ang.y += this.ang_speed.y * delta;

			var d_ang = new Vector3(this.ang.x - this.old_ang.x, this.ang.y - this.old_ang.y, this.ang.z - this.old_ang.z)
			const d_speed_y = this.speed.y - this.old_speed_y;
			if (this.freefall) {
				d_ang = new Vector3(0,0,0);
				this.speed = new Vector3(0,0,0);
			}
			this.drone.body.setAngularVelocityY(d_ang.y / delta);


			let cos_rot_y, sin_rot_y;
			cos_rot_y = Math.cos(this.ang.y)
			sin_rot_y = Math.sin(this.drone.rotation.y);
			this.drone.body.setAngularVelocityX(cos_rot_y * d_ang.x / delta + sin_rot_y * d_ang.z / delta);
			this.drone.body.setAngularVelocityZ(cos_rot_y * d_ang.z / delta - sin_rot_y * d_ang.x / delta);

			this.drone.body.setVelocityX(cos_rot_y * this.speed.x + sin_rot_y * this.speed.z);
			this.drone.body.setVelocityZ(cos_rot_y * this.speed.z - sin_rot_y * this.speed.x);
			if (this.speed.y > 8) this.control = d_speed_y / delta;
			else this.control = -9.81 + this.speed.y
			if (!this.freefall) this.drone.body.setGravity(0, this.control, 0)
			//console.log(this.control);

			this.drone.body.needUpdate = true;
			this.old_ang.set(this.ang.x, this.ang.y, this.ang.z);
			this.old_speed_y = this.speed.y;

			TWEEN.update();

			document.getElementById("fps").innerHTML = "FPS: " + Math.round(1 / delta) + "<br> Flight Time: "+  Math.round(time) + "s";
		}
	}
}

window.addEventListener('load', () => {
	PhysicsLoader('./libs/ammo_new', () => {
		const project = new Project({ antialias: true, maxSubSteps: 10, fixedTimeStep: 1 / 120, scenes: [MainScene] })

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