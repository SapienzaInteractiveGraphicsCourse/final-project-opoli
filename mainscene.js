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
import { BoxGeometry, LineBasicMaterial, Mesh, MeshPhongMaterial } from './three.js-master/build/three.module.js';
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

class MainScene extends Scene3D {
  constructor() {
    super('MainScene')
  }

  init() {
    this.renderer.setPixelRatio(Math.max(1, window.devicePixelRatio / 2))

    this.canJump = true
    this.move = false

    this.moveTop = 0
    this.moveRight = 0
    // camera
    {
      this.camera = new THREE.PerspectiveCamera(60, this.camera.aspect, 0.1, 1000);

      this.radius = 15;
      this.theta = 0;
      this.phi = Math.PI / 6;

      // window.addEventListener('resize', () => {
      // 	width = window.innerWidth;
      // 	height = window.innerHeight;
      // 	camera.aspect = width / height;
      // 	camera.updateProjectionMatrix();
      // 	renderer.setSize(width, height);
      // 	max_mousemove = Math.pow(1580, Math.min(1 / camera.aspect, camera.aspect));
      // }, false);

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
          console.log(this.phi)
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
  }

  async preload() {
    /**
     * Medieval Fantasy Book by Pixel (https://sketchfab.com/stefan.lengyel1)
     * https://sketchfab.com/3d-models/medieval-fantasy-book-06d5a80a04fc4c5ab552759e9a97d91a
     * Attribution 4.0 International (CC BY 4.0)
     */
    const city = this.load.preload('city', './models/scene.gltf')

    /**
     * box_man.glb by Jan BlÃ¡ha
     * https://github.com/swift502/Sketchbook
     * CC-0 license 2018
     */
    // const drone = this.load.preload('drone', './models/drone.gltf')
    const drone = this.load.preload('drone', './models/drone.glb')

    await Promise.all([city, drone])
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
      this.drone.rotateY(Math.PI + 0.1) // a hack
      this.drone.add(drone)
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
       this.physics.add.existing(this.drone)
 
       this.drone.body.setFriction(0.8)
       this.drone.body.setAngularFactor(0, 0, 0)
 
       this.drone.body.setCcdMotionThreshold(1e-7)
       this.drone.body.setCcdSweptSphereRadius(0.25)
       this.thirdPersonCamera.SetTarget(this.drone);
 
      /**
       * Animations
       */
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
            new TWEEN.Tween(this.drone.body.velocity).to({ x: 1 }, transition_s).start().easing(ease_func_speed),
            new TWEEN.Tween(this.drone.rotation).to({ x: 0.2 }, transition).start().easing(ease_func)
          ];
          if (inputs.s) tweens.s = [
            new TWEEN.Tween(this.drone.body.velocity).to({ x: -1 }, transition_s).start().easing(ease_func_speed),
            new TWEEN.Tween(this.drone.rotation).to({ x: -0.2 }, transition).start().easing(ease_func)
          ];
          if (inputs.d) tweens.d = [
            new TWEEN.Tween(this.drone.body.velocity).to({ z: 1 }, transition_s).start().easing(ease_func_speed),
            new TWEEN.Tween(this.drone.rotation).to({ z: 0.2 }, transition).start().easing(ease_func)
          ];
          if (inputs.a) tweens.a = [
            new TWEEN.Tween(this.drone.body.velocity).to({ z: -1 }, transition_s).start().easing(ease_func_speed),
            new TWEEN.Tween(this.drone.rotation).to({ z: -0.2 }, transition).start().easing(ease_func)
          ];
          if (inputs.e) tweens.e = new TWEEN.Tween(this.drone.body.angularVelocity).to({ y: -Math.PI }, time_yaw).start().easing(ease_func_up);
          if (inputs.q) tweens.q = new TWEEN.Tween(this.drone.body.angularVelocity).to({ y: Math.PI }, time_yaw).start().easing(ease_func_up);
          if (throttle_control) return;
          if (inputs[" "] && acc.y < 12 && !tweens[" "]) {
            tweens[" "] = new TWEEN.Tween(this.drone.body.velocity).to({ y: '+1.2' }, time_up).start().easing(ease_func_up).onUpdate(() => {
              if (acc.y < 12) return;
              tweens[" "].stop();
              tweens[" "] = null;
            });
          }
          if (inputs["<"] && acc.y > 0 && !tweens["<"]) {
            tweens["<"] = new TWEEN.Tween(this.drone.body.velocity).to({ y: '-1.2' }, time_up).start().easing(ease_func_up).onUpdate(() => {
              if (acc.y > 0) return;
              tweens["<"].stop();
              tweens["<"] = null;
            });
          }
        }

        // event listeners
        document.addEventListener('keydown', function (event) {
          let key = event.key.toLowerCase();
          if (key === "h") console.log(this.drone.position)
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
            new TWEEN.Tween(this.drone.body.velocity).to({ x: 0 }, transition_s).start().easing(ease_func_speed);
            new TWEEN.Tween(this.drone.rotation).to({ x: 0 }, transition).start().easing(ease_func);
          };
          if (!(inputs.a || inputs.d)) {
            new TWEEN.Tween(this.drone.body.velocity).to({ z: 0 }, transition_s).start().easing(ease_func_speed);
            new TWEEN.Tween(this.drone.rotation).to({ z: 0 }, transition).start().easing(ease_func);
          };
          if (!(inputs.e || inputs.q)) new TWEEN.Tween(this.drone.body.angularVelocity).to({ y: 0 }, time_yaw).start().easing(ease_func_up);

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
      
      /**
       * Add 3rd Person Controls
       */

      /**
       * Add Pointer Lock and Pointer Drag
       */
      // if (!isTouchDevice) {
      //   let pl = new PointerLock(this.canvas)
      //   let pd = new PointerDrag(this.canvas)
      //   pd.onMove(delta => {
      //     if (pl.isLocked()) {
      //       this.moveTop = -delta.y
      //       this.moveRight = delta.x
      //     }
      //   })
      // }
    }

    addCity()
    addDrone()



    /**
     * Add Keys
     */
    this.keys = {
      w: { isDown: false },
      a: { isDown: false },
      s: { isDown: false },
      d: { isDown: false },
      space: { isDown: false }
    }

    const press = (e, isDown) => {
      e.preventDefault()
      const { keyCode } = e
      switch (keyCode) {
        case 87: // w
          this.keys.w.isDown = isDown
          break
        case 38: // arrow up
          this.keys.w.isDown = isDown
          break
        case 32: // space
          this.keys.space.isDown = isDown
          break
      }
    }

    document.addEventListener('keydown', e => press(e, true))
    document.addEventListener('keyup', e => press(e, false))

    // /**
    //  * Add joystick
    //  */
    // if (isTouchDevice) {
    //   const joystick = new JoyStick()
    //   const axis = joystick.add.axis({
    //     styles: { left: 20, bottom: 175, size: 100 }
    //   })
    //   axis.onMove(event => {
    //     /**
    //      * Update Camera
    //      */
    //     const { top, right } = event
    //     this.moveTop = top
    //     this.moveRight = right
    //   })
    //   const buttonA = joystick.add.button({
    //     letter: 'A',
    //     styles: { right: 20, bottom: 250, size: 80 }
    //   })
    //   buttonA.onClick(() => this.jump())
    //   const buttonB = joystick.add.button({
    //     letter: 'B',
    //     styles: { right: 95, bottom: 175, size: 80 }
    //   })
    //   buttonB.onClick(() => (this.move = true))
    //   buttonB.onRelease(() => (this.move = false))
    // }

    setTimeout(() => {
      const placeholder = document.getElementById('welcome-game-placeholder')
      if (placeholder) placeholder.remove()
    }, 500)
  }

  jump() {
    if (!this.drone || !this.canJump) return
    this.canJump = false
    this.drone.animation.play('jump_running', 500, false)
    setTimeout(() => {
      this.canJump = true
      this.drone.animation.play('idle', 500)
    }, 500)
    this.drone.body.applyForceY(6)
  }

  update(time, delta) {
    time *= 0.001;
    delta *= 0.001;
    this.thirdPersonCamera.Update(delta, this.theta, this.phi);
    if (this.drone && this.drone.body) {
      /**
       * Update Controls
       */
      // this.controls.update(this.moveRight * 3, -this.moveTop * 3)
      // if (!isTouchDevice) this.moveRight = this.moveTop = 0
      // /**
      //  * Player Turn
      //  */
      // const speed = 4
      // const v3 = new THREE.Vector3()

      // const rotation = this.camera.getWorldDirection(v3)
      // const theta = Math.atan2(rotation.x, rotation.z)
      // const rotationMan = this.drone.getWorldDirection(v3)
      // const thetaMan = Math.atan2(rotationMan.x, rotationMan.z)
      // this.drone.body.setAngularVelocityY(0)

      // const l = Math.abs(theta - thetaMan)
      // let rotationSpeed = isTouchDevice ? 2 : 4
      // let d = Math.PI / 24

      // if (l > d) {
      //   if (l > Math.PI - d) rotationSpeed *= -1
      //   if (theta < thetaMan) rotationSpeed *= -1
      //   this.drone.body.setAngularVelocityY(rotationSpeed)
      // }

      // /**
      //  * Player Move
      //  */
      // if (this.keys.w.isDown || this.move) {
      //   if (this.drone.animation.current === 'idle' && this.canJump) this.drone.animation.play('run')

      //   const x = Math.sin(theta) * speed,
      //     y = this.drone.body.velocity.y,
      //     z = Math.cos(theta) * speed

      //   this.drone.body.setVelocity(x, y, z)
      // } else {
      //   if (this.drone.animation.current === 'run' && this.canJump) this.drone.animation.play('idle')
      // }

      // /**
      //  * Player Jump
      //  */
      // if (this.keys.space.isDown && this.canJump) {
      //   this.jump()
      // }
    }
  }
}

window.addEventListener('load', () => {
  PhysicsLoader('./libs/ammo', () => {
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