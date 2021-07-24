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

import { EffectComposer } from './three.js-master/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './three.js-master/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from './three.js-master/examples/jsm/postprocessing/ShaderPass.js';
import { OutlinePass } from './three.js-master/examples/jsm/postprocessing/OutlinePass.js';
import { FXAAShader } from './three.js-master/examples/jsm/shaders/FXAAShader.js';

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

var listener, sound, droneSound, helperSound, rainSound, rainMustPlay = false;
var soundsLoaded = false;
const sounds = {
	background: { url: './sounds/music.mp3' },
	drone: { url: './sounds/drone.m4a' },
	death: { url: './sounds/death.wav' },
	win: { url: './sounds/win.wav' },
	consumable: { url: './sounds/consumable.wav' },
	rain: { url: './sounds/rain.wav' },
	hit: { url: './sounds/hit.wav' },
}

const droneColors = ["red", "black", "blue", "green", "white"];
var chosenColors = [3, 4]; //1st drone, 2nd propellers
var difficulty = 3; //easy 0, medium 1, hard 2
var dayTime = 0; // 0 day, 1 twilight, 2 night
const targetCoins = [3, 5, 10, 0];
var quadricopter = false; // false if normal drone, true if quadricopter

function colorToHex(color) {
	if (color == "red") {
		return 0xff0000;
	} else if (color == "black") {
		return 0x000000;
	} else if (color == "blue") {
		return 0x0000ff;
	} else if (color == "green") {
		return 0x00ff00;
	} else if (color == "white") {
		return 0xffffff;
	}
}

function loadSounds() {
	const soundsLoaderMngr = new THREE.LoadingManager();
	soundsLoaderMngr.onLoad = () => {
		soundsLoaded = true;
	};
	const audioLoader = new THREE.AudioLoader(soundsLoaderMngr);
	for (const sound of Object.values(sounds)) {
		audioLoader.load(sound.url, function (buffer) {
			sound.sound = buffer;
		});
	}
}



function playSoundTrack() {
	if (!soundsLoaded) return;
	if (sound.isPlaying) {
		document.getElementById("musicbutton").src = './menu/soundoff.png';
		sound.pause();
		droneSound.pause();
		if(rainSound.isPlaying) rainSound.stop();
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
		droneSound.setVolume(0.2);
		droneSound.play();
		playRainMusic();
	}
}

function playDeathMusic() {
	if (sound.isPlaying) {
		playSoundTrack();
		helperSound.isPlaying = false;
		helperSound.setBuffer(sounds.death.sound);
		helperSound.setLoop(false);
		helperSound.setVolume(0.3);
		helperSound.play();
	}
}

function playWinMusic() {
	if (sound.isPlaying) {
		playSoundTrack();
		helperSound.isPlaying = false;
		helperSound.setBuffer(sounds.win.sound);
		helperSound.setLoop(false);
		helperSound.setVolume(0.3);
		helperSound.play();
	}
}

function playConsumableMusic() {
	if (sound.isPlaying) {
		helperSound.isPlaying = false;
		helperSound.setBuffer(sounds.consumable.sound);
		helperSound.setLoop(false);
		helperSound.setVolume(0.3);
		helperSound.play();
	}
}

function playRainMusic() {
	if (sound.isPlaying) {
		if(!rainMustPlay) {
			if(rainSound.isPlaying) rainSound.stop()
		} else {
			rainSound.isPlaying = false;
			rainSound.setBuffer(sounds.rain.sound);
			rainSound.setLoop(false);
			rainSound.setVolume(0.45);
			rainSound.play();
		}	
	} 
}

function playHitMusic() {
	if (sound.isPlaying) {
		helperSound.isPlaying = false;
		helperSound.setBuffer(sounds.hit.sound);
		helperSound.setLoop(false);
		helperSound.setVolume(0.3);
		helperSound.play();
	}
}


var context;
var controls
class MainScene extends Scene3D {
	constructor() {
		super('MainScene')
	}

	init() {
		context = this;
		this.renderer.setPixelRatio(Math.max(1, window.devicePixelRatio / 2))
		this.imageLoader = new TextureLoader();

		// camera
		{
			this.camera = new THREE.PerspectiveCamera(60, this.camera.aspect, 0.1, 1000);




			this.radius = 10;
			this.theta = 0;
			this.phi = Math.PI / 6;


			controls = new PointerLockControls(this.camera, document.body);

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


			var max_mousemove = Math.pow(1580, 1 / this.camera.aspect);;
			document.addEventListener('mousemove', (event) => {
				if (controls.isLocked) {
					var dx = Math.max(-max_mousemove, Math.min(event.movementX, max_mousemove)) * 0.001;
					var dy = Math.max(-max_mousemove, Math.min(event.movementY, max_mousemove)) * 0.001;

					this.theta += dx * Math.PI / 2;
					this.phi += dy * Math.PI / 2;
					if (Math.abs(this.phi) > Math.PI / 2) {
						this.phi = this.phi > 0 ? Math.PI / 2 - 0.001 : -Math.PI / 2 + 0.001;
					}
					this.phi -= Math.abs(this.phi) > 2 * Math.PI ? this.phi < 0 ? -2 * Math.PI : 2 * Math.PI : 0;
					this.theta -= Math.abs(this.theta) > 2 * Math.PI ? this.theta < 0 ? -2 * Math.PI : 2 * Math.PI : 0;

				}
			})
			controls.addEventListener('unlock', () => {
				document.getElementById("commands").style.display = 'block';
			})
			document.getElementById("musicbutton").addEventListener("click", playSoundTrack);

		}

		//sounds
		{
			listener = new THREE.AudioListener();
			this.camera.add(listener);
			sound = new THREE.Audio(listener);
			droneSound = new THREE.Audio(listener);
			helperSound = new THREE.Audio(listener);
			rainSound = new THREE.Audio(listener);
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

		// postprocessing

		this.composer = new EffectComposer(this.renderer);

		const renderPass = new RenderPass(this.scene, this.camera);
		this.composer.addPass(renderPass);

		this.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera);
		this.outlinePass.edgeStrength = 4.0;
		this.outlinePass.edgeGlow = 1.0;
		this.outlinePass.edgeThickness = 4.0;
		this.outlinePass.pulsePeriod = 0;
		this.outlinePass.visibleEdgeColor.set('#196e41');
		this.outlinePass.hiddenEdgeColor.set('#196e41');
		// this.composer.addPass(this.outlinePass);

		let effectFXAA = new ShaderPass(FXAAShader);
		effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
		this.composer.addPass(effectFXAA);
	}

	async preload() {
		const city = this.load.preload('city', './models/scene.gltf')

		const drone = this.load.preload('drone', './models/drone.glb')

		const drone2 = this.load.preload('drone2', './models/rc_quadcopter/scene4.gltf')

		const bitcoin = this.load.preload('bitcoin', './models/bitcoin/scene.gltf')

		const tank = this.load.preload('tank', './models/tank/scene.gltf')

		const heart = this.load.preload('heart', './models/heart/scene.gltf')

		await Promise.all([city, drone, bitcoin, tank, heart, drone2])
	}

	speed = new Vector3(0, 0, 0);
	ang = new Vector3(0, 0, 0);
	acc = new Vector3(0, 0, 0);
	ang_speed = new Vector3(0, 0, 0);
	freefall = false;
	gameStarted = false;
	gameStart = false;
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


	started = false;
	async create() {
		const { lights } = await this.warpSpeed('-ground', '-orbitControls')

		let sky = this.scene.children[1]

		// daytime colors
		const nightColors = {
			bottomColor: [0, 0, 0],
			topColor: [0, 0, 62 / 255]
		}
		const twilightColors = {
			bottomColor: [220 / 255, 84 / 255, 12 / 255],
			topColor: [41 / 255, 132 / 255, 209 / 255]
		}
		const dayColors = {
			bottomColor: [0.9294117647058824, 0.9607843137254902, 1],
			topColor: [0, 0.4666666666666667, 1]
		}
		const rainNightColors = {
			bottomColor: [0, 0, 0],
			topColor: [62 / 255 * 0.2, 62 / 255 * 0.2, 62 / 255 * 0.3]
		}
		const rainTwilightColors = {
			bottomColor: [220 / 255 * 0.3, 84 / 255 * 0.3, 12 / 255 * 0.3],
			topColor: [92 / 255 * 0.5, 69 / 255 * 0.5, 57 / 255 * 0.5]
		}
		const rainDayColors = {
			bottomColor: [96 / 255 * 0.5, 96 / 255 * 0.5, 106 / 255 * 0.5],
			topColor: [96 / 255, 96 / 255, 106 / 255]
		}
		this.dayTimeColors = {
			0: dayColors,
			1: twilightColors,
			2: nightColors
		}
		this.rainColors = {
			0: rainDayColors,
			1: rainTwilightColors,
			2: rainNightColors
		}

		sky.material.uniforms.bottomColor.value.setRGB(...this.dayTimeColors[dayTime].bottomColor)
		sky.material.uniforms.topColor.value.setRGB(...this.dayTimeColors[dayTime].topColor)

		this.physics.add.existing(sky, {
			shape: 'concave',
			collisionFlags: 1,
			mass: 0
		})
		this.sky = sky

		const { hemisphereLight, ambientLight, directionalLight } = lights
		this.intensity = 0.65
		this.hemIntensity = 0.2
		hemisphereLight.intensity = this.hemIntensity
		ambientLight.intensity = this.intensity
		directionalLight.intensity = this.intensity
		this.directional = directionalLight
		this.lightsController = lights
		this.lightColors = {
			0: {
				hem: this.dayTimeColors[0].bottomColor,
				amb: this.dayTimeColors[0].bottomColor,
				dir: this.dayTimeColors[0].bottomColor
			},
			1: {
				hem: this.dayTimeColors[1].topColor,
				amb: this.dayTimeColors[1].bottomColor,
				dir: this.dayTimeColors[1].topColor
			},
			2: {
				hem: [0.1, 0.1, 0.1],
				amb: [0.05, 0.05, 0.15],
				dir: [0.1, 0.1, 0.1]
			},
		}
		directionalLight.color.setRGB(...this.lightColors[dayTime].dir)
		ambientLight.color.setRGB(...this.lightColors[dayTime].amb)
		hemisphereLight.color.setRGB(...this.lightColors[dayTime].hem)

		// rainlight
		// this.flash = new THREE.PointLight(0x062d89, 30, 750, 1.7);
		this.flash = new THREE.PointLight(0xb9fae8, 30, 750, 1.7);
		this.flash.position.set(800, 800, 800);
		this.scene.add(this.flash);
		this.flash.visible = false;



		// ground
		this.ground = new ExtendedObject3D()
		this.ground.add(new Mesh(new PlaneGeometry(1000, 1000), new MeshPhongMaterial({ color: 0xff0000 })));
		this.ground.rotation.x = -Math.PI / 2
		this.ground.position.setY(-0.9)
		this.ground.visible = false;

		this.add.existing(this.ground)
		this.physics.add.existing(this.ground, {
			collisionFlags: 1,
			mass: 0
		})

		

		const addCity = async () => {
			var tex_map, tex_normal_map;


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
						this.imageLoader.load('./textures/grass.jpeg', (texture) => {
							tex_map = texture
							tex_map.wrapS = THREE.RepeatWrapping;
							tex_map.wrapT = THREE.RepeatWrapping;

							tex_map.repeat.set(0.5, 0.5);

							tex_map.anisotropy = 4;

							child.material.map = tex_map;
							child.material.map.needsUpdate = true

						});
						this.imageLoader.load('./textures/grasslight-big-nm.jpg', (texture) => {
							tex_normal_map = texture
							tex_normal_map.wrapS = THREE.RepeatWrapping;
							tex_normal_map.wrapT = THREE.RepeatWrapping;

							tex_normal_map.repeat.set(0.5, 0.5);

							tex_normal_map.anisotropy = 4;

							child.material.normalMap = tex_normal_map;
							child.material.normalMap.needsUpdate = true
						});

						child.material.color.setHex(0xffffff);

					} else if (child.name.includes("Pink") || child.name.includes("Magenta")) {

					} else if (child.name.includes("Cyan")) {
						/*
						var water = new Water(child.geometry, {
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
						water.matrixAutoUpdate = false;
						water.rotationAutoUpdate = false;
						water.parent = child.parent;
						water.updateMatrix();
						const p = child.parent;
						for (let i = 0; i < p.children.length; i++) {
							const ch = p.children[i];
							if (ch.name === child.name) {
								p.remove(ch);
								p.add(water);
							}
						}
						*/
					} else if (child.material.color && child.material.color.r === 0.5684522089150544) {
						child.material.color.setRGB(0.752941, 0.752941, 0.752941)
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
			this.city = city
		}
		const addDrone = async () => {
			var object;
			if(quadricopter) {
				object = await this.load.gltf('drone2') 
			}
			else {
				object = await this.load.gltf('drone')
			}

			const drone = object.scene.children[0]

			this.drone = new ExtendedObject3D()
			this.drone.name = 'drone'
			this.drone.add(drone)
			this.drone.position.set(35, 1, 0)
			if(quadricopter) this.drone.scale.set(0.7, 0.7, 0.7);
			// add shadow
			this.drone.traverse(child => {
				if (child.isMesh) {
					child.castShadow = child.receiveShadow = true;
					child.material.roughness = 1
					child.material.metalness = 0
					if (child.name === "PropellerFR") {
						this.droneElements.propellerFR = child;
					}
					if (child.name === "PropellerFL") {
						this.droneElements.propellerFL = child;
					}
					if (child.name === "PropellerBR") {
						this.droneElements.propellerBR = child;
					}
					if (child.name === "PropellerBL") {
						this.droneElements.propellerBL = child;
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
			this.tooFast = false;
			this.drone.body.on.collision((otherObj, event) => {
				if (otherObj.name.includes("CONSUMABLE")) {
					this.physics.destroy(otherObj.body)
					otherObj.parent.remove(otherObj)
					console.log('CONSUMABILE HITTATO ' + otherObj.name)
					playConsumableMusic();
					if (otherObj.name.includes("heart")) {
						this.lives++;
						this.hearts--;
					} else if (otherObj.name.includes("coin")) {
						this.collected_coins++;
						this.coins--;

						if (this.collected_coins >= targetCoins[difficulty]) {
							let difficulty_msg = "It was too easy, right? Retry with MEDIUM!";
							if (difficulty == 1) {
								difficulty_msg = "Good job, but you can do better. Try HARD!";
							} else if (difficulty == 2) {
								difficulty_msg = "WOW. You're a master of drones! You deserve to be a honored citizen of OPOLI."
							}
							new Noty({
								type: 'success',
								layout: 'center',
								theme: 'nest',
								text: 'You won. ' + difficulty_msg,
								timeout: '10000',
								progressBar: true,
								closeWith: ['click'],
								killer: "winqueue",
							}).show();
							playWinMusic();
							setTimeout(() => { location.reload() }, 10000)
						}
					} else if (otherObj.name.includes("tank")) {
						this.tanks--;
						this.fuel += 1000;
						if (this.fuel > 3000) this.fuel = 3000;
					}

				} else if (this.tooFast) {
					if (event != "start") return;
					this.collisionDrone();
					console.log('COLLISIONE FORTE')

					if (this.lives > 0) {
						context.drone.body.setCollisionFlags(2);
						context.drone.position.setY(100);
						context.drone.body.needUpdate = true;
						context.drone.body.once.update(() => {
							context.drone.body.setCollisionFlags(0);
							context.drone.body.setVelocity(0, 0, 0);
						})
					} else if (this.lives == 0) {
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


			
			document.addEventListener('keydown', function (event) {
				let key = event.key.toLowerCase();
				if (context.freefall || !context.gameStart) return;
				if (key === "h") console.log(context.drone.position)
				/*if (key === "g") {
					context.drone.body.setCollisionFlags(2);
					context.drone.position.setY(100);
					context.drone.body.needUpdate = true;
					context.drone.body.once.update(() => {
						context.drone.body.setCollisionFlags(0);
						context.drone.body.setVelocity(0, 0, 0);
					})
				}
				if (key === "t") {
					context.drone.body.setCollisionFlags(2);
					// context.drone.position.set(78.16771697998047, 33.26953125, 87.68900299072266);
					context.drone.position.set(250, 100, 250);
					context.drone.body.needUpdate = true;
					context.drone.body.once.update(() => {
						context.drone.body.setCollisionFlags(0);
						context.drone.body.setVelocity(0, 0, 0);
					})
				}*/
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

			document.addEventListener('keyup', function (event) {
				let key = event.key.toLowerCase();
				if (context.freefall || !context.gameStart) return;
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

			const spotLight = new THREE.SpotLight(0xff0000);

			spotLight.angle = Math.PI / 4;
			spotLight.penumbra = 0.1;
			spotLight.decay = 2;
			spotLight.distance = 50;

			spotLight.castShadow = true;
			spotLight.shadow.mapSize.width = 512;
			spotLight.shadow.mapSize.height = 512;
			spotLight.shadow.camera.near = 10;
			spotLight.shadow.camera.far = 50;
			spotLight.shadow.focus = 1;

			this.drone.add(spotLight);
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

		const addBitCoin = async () => {
			const object = await this.load.gltf('bitcoin')
			const scene = object.scenes[0]
			var i = 0;
			this.coins = 0
			setInterval(() => {
				if (this.coins >= 50) return;
				i++
				this.coins++

				const x = Math.random() * (369 + 418) - 418,
					y = 100,
					z = Math.random() * (250 + 253) - 253
				const bitcoin = new ExtendedObject3D()
				bitcoin.name = 'CONSUMABLE coin ' + i
				bitcoin.add(scene.clone())
				bitcoin.traverse(ch => {
					if (ch.isMesh) {
						ch.material.metalness = 0.5
						ch.material.roughness = 1
						if (dayTime == 2) {
							ch.material.emissive.setHex(0xbbbb00)
						}
					}
				})
				bitcoin.scale.set(0.07, 0.07, 0.07)
				bitcoin.position.set(x, y, z)
				bitcoin.visible = false;
				this.add.existing(bitcoin)
				this.physics.add.existing(bitcoin, {
					addChildren: false,
					shape: 'convexMesh'
				})
				bitcoin.body.setAngularFactor(0, 0, 0)
				bitcoin.body.on.collision((otherObj) => {
					if (otherObj.name != "drone" && !otherObj.name.includes("CONSUMABLE")) {
						bitcoin.body.setCollisionFlags(2)
						bitcoin.position.setY(Math.min(bitcoin.position.y + Math.random() * 25, 90))
						bitcoin.body.needUpdate = true;
						bitcoin.body.once.update(() => {
							bitcoin.visible = true;
							bitcoin.body.setCollisionFlags(0)
							bitcoin.body.setLinearFactor(0, 0, 0);
							bitcoin.body.setVelocity(0, 0, 0);
							bitcoin.body.setAngularVelocityY(2.5)
						})
					}
				})
			}, 2000)
		}
		const addTank = async () => {
			const object = await this.load.gltf('tank')
			const scene = object.scenes[0]
			var i = 0;
			this.tanks = 0
			setInterval(() => {
				if (this.tanks >= 10) return;
				i++
				this.tanks++

				const x = Math.random() * (369 + 418) - 418,
					y = 100,
					z = Math.random() * (250 + 253) - 253
				const tank = new ExtendedObject3D()
				tank.name = 'CONSUMABLE tank ' + i
				tank.add(scene.clone())
				tank.traverse(ch => {
					if (ch.isMesh) {
						ch.material.metalness = 0
						ch.material.roughness = 1
						ch.material.map = null
						ch.material.color.setHex(0x00ff00)
						if (dayTime == 2) {
							ch.material.emissive.setHex(0x00bb00)
						}
					}
				})
				tank.scale.set(0.1, 0.1, 0.1)
				tank.position.set(x, y, z)
				tank.visible = false;
				this.add.existing(tank)
				this.physics.add.existing(tank, {
					addChildren: false,
					shape: 'convexMesh'
				})
				tank.body.setAngularFactor(0, 0, 0)
				tank.body.on.collision((otherObj) => {
					if (otherObj.name != "drone" && !otherObj.name.includes("CONSUMABLE")) {
						tank.body.setCollisionFlags(2)
						tank.position.setY(Math.min(tank.position.y + Math.random() * 25, 90))
						tank.body.needUpdate = true;
						tank.body.once.update(() => {
							tank.visible = true;
							tank.body.setCollisionFlags(0)
							tank.body.setLinearFactor(0, 0, 0);
							tank.body.setVelocity(0, 0, 0);
							tank.body.setAngularVelocityY(2.5)
						})
					}
				})
			}, 10000)
		}
		const addHearts = async () => {
			const object = await this.load.gltf('heart')
			const scene = object.scenes[0]
			var i = 0;
			this.hearts = 0
			setInterval(() => {
				if (this.hearts >= 10) return;
				i++
				this.hearts++

				const x = Math.random() * (369 + 418) - 418,
					y = 100,
					z = Math.random() * (250 + 253) - 253
				const heart = new ExtendedObject3D()
				heart.name = 'CONSUMABLE heart ' + i
				heart.add(scene.clone())
				heart.traverse(ch => {
					if (ch.isMesh) {
						ch.material.metalness = 0
						ch.material.roughness = 1
						ch.material.map = null
						ch.material.color.setHex(0xff0000)
						if (dayTime == 2) {
							ch.material.emissive.setHex(0xbb0000)
						}
					}
				})
				heart.scale.set(0.07, 0.07, 0.07)
				heart.position.set(x, y, z)
				heart.visible = false;
				this.add.existing(heart)
				this.physics.add.existing(heart, {
					addChildren: false,
					shape: 'convexMesh'
				})
				heart.body.setAngularFactor(0, 0, 0)
				heart.body.on.collision((otherObj) => {
					if (otherObj.name != "drone" && !otherObj.name.includes("CONSUMABLE")) {
						heart.body.setCollisionFlags(2)
						heart.position.setY(Math.min(heart.position.y + Math.random() * 25, 90))
						heart.body.needUpdate = true;
						heart.body.once.update(() => {
							heart.visible = true;
							heart.body.setCollisionFlags(0)
							heart.body.setLinearFactor(0, 0, 0);
							heart.body.setVelocity(0, 0, 0);
							heart.body.setAngularVelocityY(2.5)
						})
					}
				})
			}, 20000)
		}

		// event listeners
		document.getElementById("startbutton").addEventListener("click", () => {
			this.gameStart = true;
			this.shiftRain(false);
			playSoundTrack();
			document.getElementById("gameloader").style.display = 'none';
			chosenColors[0] = droneColors.indexOf(document.getElementById("startbutton").getAttribute("data-drone-color"))
			chosenColors[1] = droneColors.indexOf(document.getElementById("startbutton").getAttribute("data-propeller-color"))
			let n_difficulty = document.getElementById("startbutton").getAttribute("data-difficulty")
			if (n_difficulty == "easy") {
				difficulty = 0;
			} else if (n_difficulty == "medium") {
				difficulty = 1;
			} else {
				difficulty = 2;
			}
			let n_day = document.getElementById("startbutton").getAttribute("data-day")
			if (n_day == "day") {
				dayTime = 0;
			} else if (n_day == "afternoon") {
				dayTime = 1;
			} else {
				dayTime = 2;
			}

			if(document.getElementById("startbutton").getAttribute("data-quadricopter") == "true") quadricopter = true;

			this.lightsController.directionalLight.color.setRGB(...this.lightColors[dayTime].dir)
			this.lightsController.ambientLight.color.setRGB(...this.lightColors[dayTime].amb)
			this.lightsController.hemisphereLight.color.setRGB(...this.lightColors[dayTime].hem)
			this.sky.material.uniforms.bottomColor.value.setRGB(...this.dayTimeColors[dayTime].bottomColor)
			this.sky.material.uniforms.topColor.value.setRGB(...this.dayTimeColors[dayTime].topColor)
			this.sky.material.uniforms.uniformsNeedUpdate = true;

			addDrone().then( () => {
				context.drone.traverse(child => {
					if (child.isMesh) {
						if (child.name != 'Mesh_5')
							child.material.color.setHex(colorToHex(droneColors[chosenColors[0]]))
					}
				})
				context.droneElements.propellerFR.material.color.setHex(colorToHex(droneColors[chosenColors[1]]))
				context.droneElements.propellerFL.material.color.setHex(colorToHex(droneColors[chosenColors[1]]))
				context.droneElements.propellerBR.material.color.setHex(colorToHex(droneColors[chosenColors[1]]))
				context.droneElements.propellerBL.material.color.setHex(colorToHex(droneColors[chosenColors[1]]))

				addBitCoin();
				addTank();
				addHearts();
			});

			context.started = true;
			controls.lock();
			document.getElementById("joystickbutton").addEventListener("click", () => {
				document.getElementById("commands").style.display = 'none';
				setTimeout(() => {
					controls.lock()
				}, 1000);
			}, false);
		});

		addWater().then(() => {
			addCity().then(() => {
				//
			})
		})

		loadSounds()
	}

	blink_color = 0x000000;
	lives = 3;
	collected_coins = 0;
	isRaining = false;
	collisionDrone() {
		function changeColor(context, times, color) {
			if (times == 0) return;
			context.drone.visible = color == 1 ? true : false

			if (color == 1) {
				setTimeout(function () { changeColor(context, times - 1, 0) }, 500);
			} else {
				setTimeout(function () { changeColor(context, times - 1, 1) }, 500);
			}
		}

		this.lives -= 1;
		if (this.lives > 0) {
			this.fuel = 3000;
			var context = this;
			setTimeout(function () { changeColor(context, 6, 0x000000) }, 500);
			playHitMusic();

			new Noty({
				type: 'warning',
				layout: 'topRight',
				theme: 'nest',
				text: 'You lost 1 life!',
				timeout: '3000',
				progressBar: true,
				closeWith: ['click'],
				killer: true,
			}).show();
		} else {
			this.lives = 0
			new Noty({
				type: 'error',
				layout: 'center',
				theme: 'nest',
				text: 'You died. Retry in 5 seconds...',
				timeout: '5000',
				progressBar: true,
				closeWith: ['click'],
				killer: true,
			}).show();
			playDeathMusic();
			setTimeout(() => { location.reload() }, 5000)
		}

	}

	shiftRain(isRaining) {
		if (isRaining) {
			this.rain.material.opacity = 1
		} else {
			this.rain.material.opacity = 0
		}
		this.isRaining = isRaining;
		rainMustPlay = isRaining;
		playRainMusic();

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

		setTimeout(function () { context.shiftRain(!isRaining) }, Math.random() * (30000 - 15000) + 15000)
	}

	p_speed_p = new THREE.Vector4(0, 0, 0, 0);
	p_speed_r = new THREE.Vector4(0, 0, 0, 0);
	p_speed_y = new THREE.Vector4(0, 0, 0, 0);
	update(time) {
		const delta = time - this.oldTime
		this.oldTime = time;
		if (delta >= project.projectConfig.maxSubSteps * project.projectConfig.fixedTimeStep) {
			project.projectConfig.maxSubSteps *= 2
			project.projectConfig.fixedTimeStep *= 2
		} else if (delta < project.projectConfig.maxSubSteps * project.projectConfig.fixedTimeStep / 8) {
			project.projectConfig.maxSubSteps /= 2
			project.projectConfig.fixedTimeStep /= 2
		}
		if(this.city) {
			if (!this.gameStarted) {
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
				this.gameStarted = true;
				document.getElementById('startbutton').disabled = false;
			}
		}
		if (this.drone && this.drone.body && this.thirdPersonCamera) {
			if (this.water) {

				this.water.material.uniforms.time.value += 0.5 * delta;

			}

			// fuel simulator
			if (this.gameStart) {
				this.gauge.set(this.fuel);
				this.fuel -= (5 + difficulty * difficulty * 3) * delta;
				if (this.fuel <= 0) this.collisionDrone()
			}

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
				this.drone.body.applyForceY(p_speed * delta / 10 + d_speed_y * 2 - this.drone.body.velocity.y * 0.001)
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

			if(quadricopter) {
				this.droneElements.propellerFR.rotation.z -= (p_speed + d_speed_y * 2 + this.p_speed_p.x + this.p_speed_r.x + this.p_speed_y.x) * delta;
				this.droneElements.propellerFL.rotation.z += (p_speed + d_speed_y * 2 + this.p_speed_p.y + this.p_speed_r.y + this.p_speed_y.y) * delta;
				this.droneElements.propellerBR.rotation.z += (p_speed + d_speed_y * 2 + this.p_speed_p.z + this.p_speed_r.z + this.p_speed_y.z) * delta;
				this.droneElements.propellerBL.rotation.z -= (p_speed + d_speed_y * 2 + this.p_speed_p.w + this.p_speed_r.w + this.p_speed_y.w) * delta;
			} else {
				this.droneElements.propellerFR.rotation.y -= (p_speed + d_speed_y * 2 + this.p_speed_p.x + this.p_speed_r.x + this.p_speed_y.x) * delta;
				this.droneElements.propellerFL.rotation.y -= (p_speed + d_speed_y * 2 + this.p_speed_p.y + this.p_speed_r.y + this.p_speed_y.y) * delta;
				this.droneElements.propellerBR.rotation.y -= (p_speed + d_speed_y * 2 + this.p_speed_p.z + this.p_speed_r.z + this.p_speed_y.z) * delta;
				this.droneElements.propellerBL.rotation.y -= (p_speed + d_speed_y * 2 + this.p_speed_p.w + this.p_speed_r.w + this.p_speed_y.w) * delta;
			}
			

			this.tooFast = new Vector3(this.drone.body.velocity.x, this.drone.body.velocity.y, this.drone.body.velocity.z).length() > 9
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

				// Lightening Animation
				if (this.flash.visible == false) {
					let tColors = { bottomColor: [this.sky.material.uniforms.bottomColor.value.r, this.sky.material.uniforms.bottomColor.value.g, this.sky.material.uniforms.bottomColor.value.b], topColor: [this.sky.material.uniforms.topColor.value.r, this.sky.material.uniforms.topColor.value.g, this.sky.material.uniforms.topColor.value.b] }
					new TWEEN.Tween({ int: this.intensity, hemInt: this.hemIntensity, colors: tColors }).to({ int: 0.3, hemInt: 0, colors: this.rainColors[dayTime] }, 3000).start().onUpdate((obj) => {
						this.lightsController.directionalLight.intensity = obj.int
						this.lightsController.ambientLight.intensity = obj.int
						this.lightsController.hemisphereLight.intensity = obj.hemInt

						this.sky.material.uniforms.bottomColor.value.setRGB(...obj.colors.bottomColor)
						this.sky.material.uniforms.topColor.value.setRGB(...obj.colors.topColor)
						this.sky.material.uniforms.uniformsNeedUpdate = true;
					})
				}
				this.flash.visible = true
				if (Math.random() > 0.96 || this.flash.power > 100) {
					if (this.flash.power < 100) {
						this.flash.position.set(
							Math.random() * 400,
							300 + Math.random() * 200,
							100
						);
					}
					this.flash.power = 50 + Math.random() * 500;
				}
			} else {
				if (this.flash.visible == true) {
					let tColors = { bottomColor: [this.sky.material.uniforms.bottomColor.value.r, this.sky.material.uniforms.bottomColor.value.g, this.sky.material.uniforms.bottomColor.value.b], topColor: [this.sky.material.uniforms.topColor.value.r, this.sky.material.uniforms.topColor.value.g, this.sky.material.uniforms.topColor.value.b] }
					new TWEEN.Tween({ int: this.intensity, hemInt: this.hemIntensity, colors: tColors }).to({ int: 0.65, hemInt: 0.2, colors: this.dayTimeColors[dayTime] }, 3000).start().onUpdate((obj) => {
						this.lightsController.directionalLight.intensity = obj.int
						this.lightsController.ambientLight.intensity = obj.int
						this.lightsController.hemisphereLight.intensity = obj.hemInt

						this.sky.material.uniforms.bottomColor.value.setRGB(...obj.colors.bottomColor)
						this.sky.material.uniforms.topColor.value.setRGB(...obj.colors.topColor)
						this.sky.material.uniforms.uniformsNeedUpdate = true;
					})
				}
				this.flash.visible = false
			}

			TWEEN.update();

			let difficultyString = "<span style='color: green'>Easy</span>";
			if (difficulty == 1) {
				difficultyString = "<span style='color: orange'>Medium</span>";
			} else if (difficulty == 2) {
				difficultyString = "<span style='color: red'>Hard</span>";
			} else if (difficulty == 3) {
				difficultyString = "<span style='color: black'>choosing...</span>";
			}
			document.getElementById("fps").innerHTML = "FPS: " + Math.round(1 / delta) + "<br> Play Time: " + Math.round(time) + "s <br>" + "Lives: <span style='color: red'>" + "♥".repeat(this.lives) + "</span><br>Difficulty: " + difficultyString + "<br>🏅 " + this.collected_coins + " / " + targetCoins[difficulty];

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