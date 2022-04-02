import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { Clock } from 'three'
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer";
import * as dat from 'dat.gui'

import vertexShader from './shaders/test/vertex.glsl'
import fragmentShader from './shaders/test/fragment.glsl'
import fragmentSimulationShader from './shaders/simulation/fragment.glsl'

const WIDTH = 128 //number of particles

let mouse = new THREE.Vector2(0, 0)
const clock = new Clock()

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}

const background = document.querySelector('.curtain')
const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.01, 1000)
camera.position.set(0, 1, 2)
scene.add(camera)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true //плавность вращения камеры

const renderer = new THREE.WebGLRenderer({
  canvas: canvas
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) //ограничение кол-ва рендеров в завис-ти от плотности пикселей
renderer.setClearColor('#111111', 1)
renderer.physicallyCorrectLights = true;
renderer.outputEncoding = THREE.sRGBEncoding;

window.addEventListener('resize', () => {
  //update sizes
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight

  //update camera
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()

  //update renderer
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

window.addEventListener('mousemove', (event) => {
  mouse = {
    x: event.clientX / window.innerWidth - 0.5,
    y: event.clientY / window.innerHeight - 0.5,
  }
})

//------------------------------------------------------------------------------------------------------
const fillParticlesPositions = (texture) => {
  let textureData = texture.image.data
  for (let i = 0; i < textureData.length; i+=4) {
    textureData[i] = Math.random()/199 //x
    textureData[i+1] = Math.random() //y
    textureData[i+2] = Math.random() //z
    textureData[i+3] = 1 //w
  }
}
let gpuCompute
let positionVariable

const initGPGPU = () => {
  gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer)
  const dtPosition = gpuCompute.createTexture()
  fillParticlesPositions(dtPosition)

  positionVariable = gpuCompute.addVariable('texturePosition', fragmentSimulationShader, dtPosition)
  positionVariable.material.uniforms['time'] = {value: 0}

  positionVariable.wrapS = THREE.RepeatWrapping
  positionVariable.wrapT = THREE.RepeatWrapping

  gpuCompute.init()
}
initGPGPU()

// const sphereGeometry = new THREE.SphereBufferGeometry(1, 128, 128)
const sphereGeometry = new THREE.IcosahedronBufferGeometry(1, 150)

const geometry = new THREE.BufferGeometry()
const positions = new Float32Array(WIDTH*WIDTH*3)
const reference = new Float32Array(WIDTH*WIDTH*2)
for (let i = 0; i < WIDTH*WIDTH; ++i) {
  let x = Math.random()
  let y = Math.random()
  let z = Math.random()

  let xx = (i%WIDTH)/WIDTH
  let yy = ~~(i/WIDTH)/WIDTH

  positions.set([x,y,z], i*3)
  reference.set([xx,yy], i*2)
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
geometry.setAttribute('reference', new THREE.BufferAttribute(reference, 2))

const material = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: vertexShader,
  fragmentShader: fragmentShader,
  uniforms: {
    time: {value: 0},
    mouse: {value: new THREE.Vector2(mouse.x, mouse.y)},
    positionTexture: {value: new THREE.Vector4()}
  }
})

const particle = new THREE.Points(sphereGeometry, material)
scene.add(particle)

//---------------------------------------------------------------------------------------------------------

const tick = () => {
  const elapsedTime = clock.getElapsedTime()
  gpuCompute.compute()
  material.uniforms.time.value = elapsedTime
  positionVariable.material.uniforms['time'].value = elapsedTime
  material.uniforms.positionTexture.value = gpuCompute.getCurrentRenderTarget(positionVariable).texture

  background.style.height = `${(mouse.y + 0.5)*100}%`
  //Update controls
  controls.update() //если включён Damping для камеры необходимо её обновлять в каждом кадре

  renderer.render(scene, camera)
  window.requestAnimationFrame(tick)
}

tick()