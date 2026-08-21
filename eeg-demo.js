import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const DURATION = 24;
const ONSET = 9.6;
const SPREAD = 13.4;
const CHANNELS = ["Fp1–F7", "F7–T7", "T7–P7", "P7–O1", "Fp2–F8", "F8–T8", "T8–P8", "P8–O2"];

const ANATOMY = {
  left_frontal: { layer: "cortex", color: 0x67c7cb, opacity: 0.12, label: "左额叶" },
  right_frontal: { layer: "cortex", color: 0x4f9ea6, opacity: 0.085, label: "右额叶" },
  left_temporal: { layer: "cortex", color: 0x769dbc, opacity: 0.16, label: "左颞叶" },
  right_temporal: { layer: "cortex", color: 0x607d9a, opacity: 0.09, label: "右颞叶" },
  left_parietal: { layer: "cortex", color: 0x70baa9, opacity: 0.11, label: "左顶叶" },
  right_parietal: { layer: "cortex", color: 0x568f83, opacity: 0.08, label: "右顶叶" },
  left_occipital: { layer: "cortex", color: 0x9987ad, opacity: 0.12, label: "左枕叶" },
  right_occipital: { layer: "cortex", color: 0x746783, opacity: 0.08, label: "右枕叶" },
  left_insula: { layer: "limbic", color: 0xc4a27d, opacity: 0.3, label: "左岛叶" },
  right_insula: { layer: "limbic", color: 0x9f8569, opacity: 0.24, label: "右岛叶" },
  left_limbic: { layer: "limbic", color: 0xbd8395, opacity: 0.35, label: "左边缘叶 / 海马" },
  right_limbic: { layer: "limbic", color: 0x946b79, opacity: 0.28, label: "右边缘叶 / 海马" },
  white_matter: { layer: "cortex", color: 0xb7d6dd, opacity: 0.045, label: "大脑白质" },
  ventricles: { layer: "ventricles", color: 0x5cbfd0, opacity: 0.48, label: "脑室系统" },
  cerebellum: { layer: "cerebellum", color: 0x5aa99c, opacity: 0.22, label: "小脑" },
  brainstem: { layer: "brainstem", color: 0x668dac, opacity: 0.38, label: "中脑 / 脑桥 / 延髓" },
  hypothalamus: { layer: "nuclei", color: 0xc1a26d, opacity: 0.5, label: "下丘脑" },
  pineal_habenula: { layer: "nuclei", color: 0xd0bd88, opacity: 0.54, label: "松果体 / 缰核" },
  corpus_callosum: { layer: "limbic", color: 0xc6d9dc, opacity: 0.27, label: "胼胝体" },
  amygdala: { layer: "nuclei", color: 0xc8707b, opacity: 0.56, label: "杏仁核" },
  caudate: { layer: "nuclei", color: 0x80b4c1, opacity: 0.48, label: "尾状核" },
  globus_pallidus: { layer: "nuclei", color: 0xc6ad6f, opacity: 0.5, label: "苍白球" },
  putamen: { layer: "nuclei", color: 0x78ad85, opacity: 0.5, label: "壳核" },
  thalamus: { layer: "nuclei", color: 0xbd8d72, opacity: 0.5, label: "丘脑" },
};

const dom = {
  brainCanvas: document.querySelector("[data-brain-canvas]"),
  brainStage: document.querySelector("[data-brain-stage]"),
  eegCanvas: document.querySelector("[data-eeg-canvas]"),
  play: document.querySelector("[data-play]"),
  playIcon: document.querySelector("[data-play-icon]"),
  reset: document.querySelector("[data-reset]"),
  scrubber: document.querySelector("[data-scrubber]"),
  currentTime: document.querySelector("[data-current-time]"),
  speed: document.querySelector("[data-speed]"),
  autoRotate: document.querySelector("[data-auto-rotate]"),
  viewButtons: [...document.querySelectorAll("[data-view]")],
  focusLabel: document.querySelector("[data-focus-label]"),
  focusValue: document.querySelector("[data-focus-value]"),
  networkState: document.querySelector("[data-network-state]"),
  networkDetail: document.querySelector("[data-network-detail]"),
  eventLine: document.querySelector("[data-event-line]"),
  frequency: document.querySelector("[data-frequency]"),
  amplitude: document.querySelector("[data-amplitude]"),
  rhythmicity: document.querySelector("[data-rhythmicity]"),
  classification: document.querySelector("[data-classification]"),
  classificationBlock: document.querySelector(".classification"),
  clock: document.querySelector("[data-clock]"),
  modelLoader: document.querySelector("[data-model-loader]"),
  layerButtons: [...document.querySelectorAll("[data-layer]")],
  chapterButtons: [...document.querySelectorAll("[data-jump]")],
  present: document.querySelector("[data-present]"),
  anatomyTooltip: document.querySelector("[data-anatomy-tooltip]"),
  anatomyName: document.querySelector("[data-anatomy-name]"),
  anatomyState: document.querySelector("[data-anatomy-state]"),
  anatomyDock: document.querySelector("[data-anatomy-dock]"),
  dockToggle: document.querySelector("[data-dock-toggle]"),
  phaseIndex: document.querySelector("[data-phase-index]"),
  nextEvent: document.querySelector("[data-next-event]"),
};

const state = {
  time: 0,
  playing: false,
  speed: 1,
  autoRotate: true,
  lastFrame: performance.now(),
};

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (min, max, value) => {
  const x = clamp((value - min) / (max - min));
  return x * x * (3 - 2 * x);
};

function seeded(index) {
  const x = Math.sin(index * 91.117 + 12.31) * 43758.5453;
  return x - Math.floor(x);
}

function formatTime(value) {
  const minutes = Math.floor(value / 60).toString().padStart(2, "0");
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  const hundredths = Math.floor((value % 1) * 100).toString().padStart(2, "0");
  return `${minutes}:${seconds}.${hundredths}`;
}

function seizureIntensity(time) {
  const attack = smoothstep(ONSET - 0.35, ONSET + 1.2, time);
  const settle = 1 - 0.22 * smoothstep(20, DURATION, time);
  return attack * settle;
}

function propagationIntensity(time) {
  return smoothstep(SPREAD - 0.5, SPREAD + 2.2, time);
}

class EEGRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  sample(channel, absoluteTime) {
    const phase = channel * 0.71;
    const baseline =
      Math.sin(absoluteTime * (5.4 + channel * 0.19) + phase) * 0.2 +
      Math.sin(absoluteTime * 11.7 + phase * 1.7) * 0.06 +
      Math.sin(absoluteTime * 31.1 + channel) * 0.025;

    const envelope = seizureIntensity(absoluteTime);
    const channelBias = channel < 4 ? 1 : 0.48;
    const spread = channel >= 4 ? propagationIntensity(absoluteTime) : 1;
    const spikePhase = absoluteTime * (16.5 + channel * 0.35) + phase;
    const spike = Math.pow(Math.abs(Math.sin(spikePhase)), 13) * Math.sign(Math.sin(spikePhase));
    const rhythmic = Math.sin(absoluteTime * 19.2 + channel * 0.3) * 0.38;
    const ictal = (spike * 1.2 + rhythmic) * envelope * channelBias * spread;

    return baseline + ictal;
  }

  draw(time) {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    const left = width < 520 ? 60 : 78;
    const right = 15;
    const top = 15;
    const rowHeight = (height - top * 2) / CHANNELS.length;
    const windowSeconds = 7.2;

    ctx.font = `${width < 520 ? 8 : 9}px "DM Mono", monospace`;
    ctx.textBaseline = "middle";

    CHANNELS.forEach((channel, channelIndex) => {
      const yBase = top + rowHeight * (channelIndex + 0.5);

      ctx.strokeStyle = "rgba(90, 137, 149, 0.13)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, yBase);
      ctx.lineTo(width - right, yBase);
      ctx.stroke();

      ctx.fillStyle = channelIndex < 4 ? "rgba(125, 211, 222, 0.74)" : "rgba(106, 141, 151, 0.76)";
      ctx.fillText(channel, 9, yBase);

      const samples = Math.max(300, Math.round(width * 0.95));
      ctx.beginPath();
      for (let i = 0; i < samples; i += 1) {
        const ratio = i / (samples - 1);
        const absoluteTime = time - windowSeconds * (1 - ratio);
        const value = this.sample(channelIndex, absoluteTime);
        const x = left + ratio * (width - left - right);
        const y = yBase - value * rowHeight * 0.37;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      const ictal = seizureIntensity(time);
      const glow = channelIndex < 4 ? ictal : ictal * propagationIntensity(time) * 0.65;
      ctx.lineWidth = 1 + glow * 0.45;
      ctx.strokeStyle = glow > 0.15
        ? `rgba(255, ${Math.round(194 - glow * 85)}, ${Math.round(116 - glow * 40)}, ${0.72 + glow * 0.2})`
        : `rgba(105, 225, 236, ${0.5 + channelIndex % 2 * 0.08})`;
      ctx.shadowBlur = 5 + glow * 8;
      ctx.shadowColor = glow > 0.15 ? "rgba(255, 90, 65, .65)" : "rgba(92, 231, 242, .38)";
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    ctx.fillStyle = "rgba(115, 144, 155, 0.55)";
    ctx.font = '7px "DM Mono", monospace';
    for (let i = 0; i <= 7; i += 1) {
      const x = left + (i / 7) * (width - left - right);
      ctx.fillText(`${(-7 + i).toFixed(0)}s`, x - 7, height - 5);
    }
  }
}

class BrainRenderer {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(8.7, 0.75, 3.1);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.minDistance = 6.4;
    this.controls.maxDistance = 12.5;
    this.controls.target.set(0, 0.05, 0);
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.28;

    this.brain = new THREE.Group();
    this.brain.rotation.set(0, 0, 0);
    this.scene.add(this.brain);

    this.focus = new THREE.Vector3(1.35, -0.35, 0.72);
    this.nodes = [];
    this.arcMaterials = [];
    this.pulses = [];
    this.anatomyMeshes = new Map();
    this.anatomyReady = false;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.hoveredMesh = null;
    this.viewAnimation = null;

    this.createLights();
    this.createShell();
    this.createAnatomicalBrain();
    this.createNeuralNetwork();
    this.createFocus();
    this.createArcs();
    this.bindAnatomyInspection();
    this.resize();
  }

  createLights() {
    this.scene.add(new THREE.HemisphereLight(0xa5f4f6, 0x04070d, 1.05));
    const key = new THREE.PointLight(0x6de6eb, 25, 20, 2);
    key.position.set(4, 4, 5);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x376fd3, 16, 18, 2);
    rim.position.set(-5, 0, -4);
    this.scene.add(rim);
    this.seizureLight = new THREE.PointLight(0xff5a3d, 0, 6, 2);
    this.seizureLight.position.copy(this.focus);
    this.brain.add(this.seizureLight);

    const fill = new THREE.DirectionalLight(0xc9f8f7, 1.15);
    fill.position.set(-2, 5, 3);
    this.scene.add(fill);
  }

  makeHemisphereGeometry(side) {
    const geometry = new THREE.SphereGeometry(2.05, 90, 72);
    const position = geometry.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i);
      const direction = vertex.clone().normalize();
      const theta = Math.atan2(direction.z, direction.x);
      const phi = Math.asin(direction.y);
      const folds =
        Math.sin(theta * 8.0 + Math.sin(phi * 5.0) * 1.7) * 0.07 +
        Math.sin(phi * 13.0 - theta * 2.2) * 0.045 +
        Math.sin((theta + phi) * 17.0) * 0.022;
      const scale = 1 + folds;
      vertex.multiplyScalar(scale);
      vertex.x *= 0.78;
      vertex.y *= 0.92;
      vertex.z *= 1.18;
      vertex.x += side * 0.62;
      vertex.z += 0.12;
      if (side * vertex.x < 0.12) vertex.x = side * (0.12 + Math.abs(vertex.x) * 0.14);
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    geometry.computeVertexNormals();
    return geometry;
  }

  createShell() {
    this.proceduralShell = new THREE.Group();
    this.brain.add(this.proceduralShell);

    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `;

    const fragmentShader = `
      uniform float uTime;
      uniform float uActivity;
      uniform vec3 uFocus;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      void main() {
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 2.15);
        float lattice = smoothstep(0.82, 1.0, abs(sin(vUv.y * 105.0 + sin(vUv.x * 25.0) * 2.0)));
        float scan = smoothstep(0.92, 1.0, sin((vWorldPosition.y + uTime * 0.23) * 18.0));
        float distanceToFocus = distance(vWorldPosition, uFocus);
        float focusGlow = exp(-distanceToFocus * distanceToFocus * 1.8) * uActivity;
        vec3 base = vec3(0.13, 0.72, 0.82);
        vec3 hot = vec3(1.0, 0.22, 0.08);
        vec3 color = mix(base, hot, clamp(focusGlow * 1.45, 0.0, 1.0));
        float alpha = 0.035 + fresnel * 0.34 + lattice * 0.035 + scan * 0.04 + focusGlow * 0.22;
        gl_FragColor = vec4(color, alpha);
      }
    `;

    this.shellUniforms = {
      uTime: { value: 0 },
      uActivity: { value: 0 },
      uFocus: { value: this.focus.clone() },
    };

    const shellMaterial = new THREE.ShaderMaterial({
      uniforms: this.shellUniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    [-1, 1].forEach((side) => {
      const geometry = this.makeHemisphereGeometry(side);
      const mesh = new THREE.Mesh(geometry, shellMaterial);
      this.proceduralShell.add(mesh);

      const wire = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: 0x55d9e8,
          wireframe: true,
          transparent: true,
          opacity: 0.028,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      wire.scale.setScalar(1.004);
      this.proceduralShell.add(wire);
    });
  }

  createAnatomicalBrain() {
    const loader = new GLTFLoader();
    loader.load(
      "assets/anatomy/brain-anatomy.glb",
      (gltf) => {
        this.anatomyRoot = gltf.scene;
        this.anatomyRoot.name = "BodyParts3D_anatomy";
        const meshes = [];
        this.anatomyRoot.traverse((object) => {
          if (object.isMesh) meshes.push(object);
        });

        meshes.forEach((mesh) => {
          const config = ANATOMY[mesh.name];
          if (!config) return;
          const color = new THREE.Color(config.color);
          const material = new THREE.MeshPhysicalMaterial({
            color,
            emissive: color.clone().multiplyScalar(0.11),
            emissiveIntensity: 0.24,
            metalness: config.layer === "cortex" ? 0.05 : 0.12,
            roughness: config.layer === "cortex" ? 0.32 : 0.26,
            transparent: true,
            opacity: config.opacity,
            depthWrite: false,
            side: THREE.DoubleSide,
            clearcoat: 0.62,
            clearcoatRoughness: 0.3,
          });
          mesh.material = material;
          mesh.renderOrder = config.layer === "cortex" ? 2 : 4;
          mesh.userData.layer = config.layer;
          mesh.userData.baseOpacity = config.opacity;
          mesh.userData.baseColor = color.clone();
          mesh.userData.label = config.label;
          mesh.frustumCulled = false;

          if (config.layer === "cortex") {
            const wireMaterial = new THREE.MeshBasicMaterial({
              color: color.clone().lerp(new THREE.Color(0xc9fcff), 0.42),
              wireframe: true,
              transparent: true,
              opacity: config.opacity * 0.24,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            });
            const wire = new THREE.Mesh(mesh.geometry, wireMaterial);
            wire.name = `${mesh.name}_wire`;
            wire.scale.setScalar(1.002);
            wire.userData.isAnatomyWire = true;
            mesh.add(wire);
            mesh.userData.wire = wire;
          }

          this.anatomyMeshes.set(mesh.name, mesh);
        });

        this.brain.add(this.anatomyRoot);
        this.proceduralShell.visible = false;
        this.anatomyReady = true;

        const temporal = this.anatomyMeshes.get("left_temporal");
        if (temporal) {
          const bounds = new THREE.Box3().setFromObject(temporal);
          const center = bounds.getCenter(new THREE.Vector3());
          center.x = THREE.MathUtils.lerp(center.x, bounds.max.x, 0.58);
          center.z = THREE.MathUtils.lerp(center.z, bounds.max.z, 0.22);
          this.updateFocusPosition(center);
        }

        dom.modelLoader.querySelector("span").textContent = `${this.anatomyMeshes.size} STRUCTURES ONLINE`;
        window.setTimeout(() => dom.modelLoader.classList.add("is-ready"), 500);
      },
      (event) => {
        if (!event.total) return;
        const progress = Math.round((event.loaded / event.total) * 100);
        dom.modelLoader.querySelector("span").textContent = `LOADING ANATOMICAL STRUCTURES · ${progress}%`;
      },
      (error) => {
        console.warn("Anatomical brain model unavailable; using procedural fallback", error);
        dom.modelLoader.querySelector("span").textContent = "PROCEDURAL FALLBACK ACTIVE";
        window.setTimeout(() => dom.modelLoader.classList.add("is-ready"), 900);
      },
    );
  }

  updateFocusPosition(position) {
    this.focus.copy(position);
    this.shellUniforms.uFocus.value.copy(position);
    this.seizureLight.position.copy(position);
    if (this.focusSprite) this.focusSprite.position.copy(position);
    this.pulses.forEach((ring) => ring.position.copy(position));
    if (this.arcLines?.length) this.createArcs();
  }

  setLayerVisibility(layer, visible) {
    this.anatomyMeshes.forEach((mesh) => {
      if (mesh.userData.layer === layer) mesh.visible = visible;
    });
  }

  bindAnatomyInspection() {
    const hideTooltip = () => {
      this.hoveredMesh = null;
      dom.anatomyTooltip.classList.remove("is-visible");
    };

    this.renderer.domElement.addEventListener("pointerleave", hideTooltip);
    this.renderer.domElement.addEventListener("pointermove", (event) => {
      if (!this.anatomyReady || event.pointerType === "touch") return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const targets = [...this.anatomyMeshes.values()].filter((mesh) => mesh.visible);
      const hit = this.raycaster.intersectObjects(targets, false)[0];
      if (!hit) {
        hideTooltip();
        return;
      }

      this.hoveredMesh = hit.object;
      const stageRect = dom.brainStage.getBoundingClientRect();
      const tooltipX = Math.min(event.clientX - stageRect.left, stageRect.width - 180);
      const tooltipY = Math.min(event.clientY - stageRect.top, stageRect.height - 82);
      dom.anatomyTooltip.style.left = `${Math.max(8, tooltipX)}px`;
      dom.anatomyTooltip.style.top = `${Math.max(100, tooltipY)}px`;
      dom.anatomyName.textContent = hit.object.userData.label;
      const layer = hit.object.userData.layer.toUpperCase();
      dom.anatomyState.textContent = state.time >= ONSET ? `ACTIVITY MAPPED · ${layer}` : `BASELINE · ${layer}`;
      dom.anatomyTooltip.classList.add("is-visible");
    });
  }

  randomInsideBrain(index) {
    const side = seeded(index + 3) > 0.5 ? 1 : -1;
    const radius = Math.cbrt(seeded(index * 4 + 1));
    const theta = seeded(index * 4 + 2) * Math.PI * 2;
    const phi = Math.acos(2 * seeded(index * 4 + 3) - 1);
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(
      x * 1.18 * radius + side * 0.36,
      y * 1.32 * radius,
      z * 1.7 * radius + 0.08,
    );
  }

  createNeuralNetwork() {
    const nodeCount = 104;
    const nodeGeometry = new THREE.IcosahedronGeometry(0.018, 1);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 });
    this.nodeMesh = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, nodeCount);
    this.nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.brain.add(this.nodeMesh);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < nodeCount; i += 1) {
      const position = this.randomInsideBrain(i);
      this.nodes.push(position);
      dummy.position.copy(position);
      dummy.scale.setScalar(0.72 + seeded(i + 1000) * 0.8);
      dummy.updateMatrix();
      this.nodeMesh.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.51, 0.82, 0.56 + seeded(i + 2000) * 0.24);
      this.nodeMesh.setColorAt(i, color);
    }
    this.nodeMesh.instanceColor.needsUpdate = true;

    const positions = [];
    for (let i = 0; i < nodeCount; i += 1) {
      const a = this.nodes[i];
      const candidates = [];
      for (let j = i + 1; j < nodeCount; j += 1) {
        const distance = a.distanceTo(this.nodes[j]);
        if (distance < 0.72) candidates.push({ j, distance });
      }
      candidates.sort((p, q) => p.distance - q.distance);
      candidates.slice(0, 2).forEach(({ j }) => {
        positions.push(a.x, a.y, a.z, this.nodes[j].x, this.nodes[j].y, this.nodes[j].z);
      });
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    this.networkMaterial = new THREE.LineBasicMaterial({
      color: 0x39cde1,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.network = new THREE.LineSegments(lineGeometry, this.networkMaterial);
    this.brain.add(this.network);
  }

  createRadialTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d");
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.12, "rgba(255,178,84,.95)");
    gradient.addColorStop(0.36, "rgba(255,67,39,.42)");
    gradient.addColorStop(1, "rgba(255,40,20,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }

  createFocus() {
    const spriteMaterial = new THREE.SpriteMaterial({
      map: this.createRadialTexture(),
      color: 0xff6a3d,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.focusSprite = new THREE.Sprite(spriteMaterial);
    this.focusSprite.position.copy(this.focus);
    this.focusSprite.scale.setScalar(1.25);
    this.brain.add(this.focusSprite);

    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.342, 64),
        new THREE.MeshBasicMaterial({
          color: i === 2 ? 0xff3c33 : 0xff8b4e,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      ring.position.copy(this.focus);
      ring.rotation.set(0.45, 0.25, 0.2);
      ring.userData.offset = i / 3;
      this.pulses.push(ring);
      this.brain.add(ring);
    }
  }

  createArcs() {
    if (this.arcLines) {
      this.arcLines.forEach((arc) => {
        this.brain.remove(arc);
        arc.geometry.dispose();
        arc.material.dispose();
      });
    }
    this.arcLines = [];
    this.arcMaterials = [];
    const targets = [
      new THREE.Vector3(-0.9, 0.72, -0.25),
      new THREE.Vector3(-0.35, 1.1, -0.85),
      new THREE.Vector3(0.75, 0.55, 0.15),
      new THREE.Vector3(1.05, -0.2, -0.8),
      new THREE.Vector3(0.4, 1.22, 0.8),
    ];

    targets.forEach((target, index) => {
      const middle = this.focus.clone().lerp(target, 0.5);
      middle.y += 0.5 + index * 0.08;
      middle.z += (index % 2 ? -1 : 1) * 0.2;
      const curve = new THREE.QuadraticBezierCurve3(this.focus, middle, target);
      const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(54));
      geometry.setDrawRange(0, 0);
      const material = new THREE.LineBasicMaterial({
        color: index < 2 ? 0xff9b54 : 0xff4b45,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const arc = new THREE.Line(geometry, material);
      arc.userData.index = index;
      this.arcLines.push(arc);
      this.arcMaterials.push(material);
      this.brain.add(arc);
    });
  }

  setView(name) {
    const positions = {
      lateral: new THREE.Vector3(9.35, 0.58, 0.9),
      superior: new THREE.Vector3(0.15, 9.65, 0.52),
      posterior: new THREE.Vector3(0.1, 0.6, -9.75),
    };
    this.viewAnimation = {
      from: this.camera.position.clone(),
      to: (positions[name] || positions.lateral).clone(),
      start: performance.now(),
    };
    this.controls.target.set(0, 0.05, 0);
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    this.camera.aspect = Math.max(width, 1) / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  update(time, delta) {
    const activity = seizureIntensity(time);
    const propagation = propagationIntensity(time);
    const pulse = 0.62 + Math.sin(time * 8.4) * 0.22 + Math.sin(time * 19.7) * 0.12;

    this.shellUniforms.uTime.value = time;
    this.shellUniforms.uActivity.value = activity * (0.78 + pulse * 0.3);
    this.focusSprite.material.opacity = activity * (0.42 + pulse * 0.25);
    this.focusSprite.scale.setScalar(0.95 + activity * (0.8 + pulse * 0.24));
    this.seizureLight.intensity = activity * (18 + pulse * 8);
    this.networkMaterial.opacity = 0.12 + activity * 0.12;

    if (this.anatomyReady) {
      const hotColor = new THREE.Color(0xff3d2f);
      this.anatomyMeshes.forEach((mesh, name) => {
        let recruitment = 0.08;
        if (name === "left_temporal") recruitment = 1;
        else if (["left_insula", "left_limbic", "amygdala"].includes(name)) recruitment = 0.82;
        else if (["thalamus", "putamen", "caudate", "globus_pallidus", "hypothalamus"].includes(name)) recruitment = 0.42 + propagation * 0.42;
        else if (["left_frontal", "left_parietal"].includes(name)) recruitment = propagation * 0.84;
        else if (["right_temporal", "right_frontal", "right_parietal"].includes(name)) recruitment = propagation * 0.42;
        else if (name === "corpus_callosum") recruitment = propagation * 0.68;
        else recruitment = propagation * 0.2;

        const localActivity = activity * recruitment * (0.82 + pulse * 0.18);
        mesh.material.emissive.copy(mesh.userData.baseColor).lerp(hotColor, localActivity);
        const hoverBoost = mesh === this.hoveredMesh ? 0.55 : 0;
        mesh.material.emissiveIntensity = 0.24 + localActivity * 3.6 + hoverBoost;
        mesh.material.opacity = Math.min(0.78, mesh.userData.baseOpacity + localActivity * 0.3 + hoverBoost * 0.08);

        const wire = mesh.userData.wire;
        if (wire) {
          wire.material.color.copy(mesh.userData.baseColor).lerp(hotColor, localActivity);
          wire.material.opacity = mesh.userData.baseOpacity * 0.22 + localActivity * 0.24 + hoverBoost * 0.08;
        }
      });
    }

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    this.nodes.forEach((position, index) => {
      const distance = position.distanceTo(this.focus);
      const localActivation = activity * Math.exp(-distance * distance * (0.75 + (1 - propagation) * 1.7));
      const flicker = 0.75 + 0.25 * Math.sin(time * (8 + seeded(index) * 13) + index);
      dummy.position.copy(position);
      dummy.scale.setScalar(0.72 + localActivation * flicker * 2.3 + seeded(index + 1000) * 0.45);
      dummy.updateMatrix();
      this.nodeMesh.setMatrixAt(index, dummy.matrix);
      color.setRGB(
        0.18 + localActivation * 0.82,
        0.74 - localActivation * 0.45,
        0.88 - localActivation * 0.7,
      );
      this.nodeMesh.setColorAt(index, color);
    });
    this.nodeMesh.instanceMatrix.needsUpdate = true;
    this.nodeMesh.instanceColor.needsUpdate = true;

    this.pulses.forEach((ring) => {
      const phase = (time * 0.62 + ring.userData.offset) % 1;
      const scale = 0.7 + phase * 3.2;
      ring.scale.setScalar(scale);
      ring.material.opacity = activity * (1 - phase) * 0.52;
      ring.lookAt(this.camera.position);
    });

    this.brain.children.forEach((child) => {
      if (!child.isLine || child === this.network) return;
      const index = child.userData.index;
      if (index === undefined) return;
      const delay = index * 0.4;
      const reveal = smoothstep(SPREAD + delay, SPREAD + delay + 1.2, time);
      const count = child.geometry.attributes.position.count;
      child.geometry.setDrawRange(0, Math.max(0, Math.floor(count * reveal)));
      child.material.opacity = reveal * (0.25 + Math.abs(Math.sin(time * 7 + index)) * 0.65);
    });

    if (this.viewAnimation) {
      const progress = clamp((performance.now() - this.viewAnimation.start) / 720);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.camera.position.lerpVectors(this.viewAnimation.from, this.viewAnimation.to, eased);
      if (progress >= 1) this.viewAnimation = null;
    }

    this.controls.autoRotate = state.autoRotate && !this.viewAnimation;
    this.controls.autoRotateSpeed = activity > 0.1 ? 0.16 : 0.28;
    this.controls.update(delta);
    this.renderer.render(this.scene, this.camera);
  }
}

let eeg;
let brain;

function updateReadouts() {
  const ictal = seizureIntensity(state.time);
  const spread = propagationIntensity(state.time);
  const frequency = 9.4 + ictal * 8.8 + Math.sin(state.time * 0.8) * 0.3;
  const amplitude = 42 + ictal * 176 + Math.sin(state.time * 1.2) * 2;
  const rhythmicity = 0.18 + ictal * 0.68;

  dom.currentTime.textContent = formatTime(state.time);
  dom.scrubber.value = state.time.toFixed(2);
  dom.frequency.innerHTML = `${frequency.toFixed(1)} <small>Hz</small>`;
  dom.amplitude.innerHTML = `${Math.round(amplitude)} <small>µV</small>`;
  dom.rhythmicity.textContent = rhythmicity.toFixed(2);
  dom.focusValue.textContent = `ACTIVATION ${ictal.toFixed(2)}`;
  dom.focusLabel.classList.toggle("is-visible", ictal > 0.04);
  dom.eventLine.classList.toggle("is-visible", ictal > 0.05);
  dom.classificationBlock.classList.toggle("is-ictal", ictal > 0.14);
  const activeChapter = state.time < ONSET ? 0 : state.time < SPREAD ? 1 : 2;
  dom.phaseIndex.textContent = `0${activeChapter + 1} / 03`;
  dom.chapterButtons.forEach((button, index) => {
    button.classList.toggle("is-active", index === activeChapter);
    button.setAttribute("aria-current", index === activeChapter ? "step" : "false");
  });

  if (ictal < 0.14) {
    dom.classification.textContent = "INTERICTAL";
    dom.networkState.textContent = "BASELINE COHERENCE";
    dom.networkDetail.textContent = "自发性皮层活动处于稳定基线";
    if (dom.nextEvent.dataset.phase !== "baseline") {
      dom.nextEvent.dataset.phase = "baseline";
      dom.nextEvent.innerHTML = 'NEXT: ONSET <span>→</span>';
    }
  } else if (spread < 0.25) {
    dom.classification.textContent = "FOCAL ICTAL";
    dom.networkState.textContent = "FOCAL HYPERSYNCHRONY";
    dom.networkDetail.textContent = "左颞叶起始区出现局灶性超同步活动";
    if (dom.nextEvent.dataset.phase !== "onset") {
      dom.nextEvent.dataset.phase = "onset";
      dom.nextEvent.innerHTML = 'NEXT: SPREAD <span>→</span>';
    }
  } else {
    dom.classification.textContent = "ICTAL PROPAGATION";
    dom.networkState.textContent = "NETWORK RECRUITMENT";
    dom.networkDetail.textContent = "异常活动经深部网络向额顶叶募集传播";
    if (dom.nextEvent.dataset.phase !== "spread") {
      dom.nextEvent.dataset.phase = "spread";
      dom.nextEvent.innerHTML = 'RESTART <span>↺</span>';
    }
  }
}

function setPlaying(playing) {
  state.playing = playing;
  dom.playIcon.textContent = playing ? "Ⅱ" : "▶";
  dom.play.setAttribute("aria-label", playing ? "暂停" : "播放");
}

function bindInteractions() {
  dom.play.addEventListener("click", () => {
    if (state.time >= DURATION) state.time = 0;
    setPlaying(!state.playing);
  });

  dom.reset.addEventListener("click", () => {
    state.time = 0;
    setPlaying(false);
    updateReadouts();
  });

  dom.scrubber.addEventListener("input", () => {
    state.time = Number(dom.scrubber.value);
    updateReadouts();
    eeg.draw(state.time);
  });

  dom.speed.addEventListener("click", () => {
    const speeds = [0.5, 1, 2];
    state.speed = speeds[(speeds.indexOf(state.speed) + 1) % speeds.length];
    dom.speed.textContent = `${state.speed.toFixed(1)}×`;
  });

  dom.autoRotate.addEventListener("click", () => {
    state.autoRotate = !state.autoRotate;
    dom.autoRotate.setAttribute("aria-pressed", String(state.autoRotate));
  });

  dom.viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      dom.viewButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      brain.setView(button.dataset.view);
    });
  });

  dom.layerButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const visible = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(visible));
      button.classList.toggle("is-active", visible);
      brain.setLayerVisibility(button.dataset.layer, visible);
    });
  });

  const setDockCollapsed = (collapsed) => {
    dom.anatomyDock.classList.toggle("is-collapsed", collapsed);
    dom.dockToggle.textContent = collapsed ? "+" : "−";
    dom.dockToggle.setAttribute("aria-expanded", String(!collapsed));
    dom.dockToggle.setAttribute("aria-label", collapsed ? "展开解剖层级控制" : "收起解剖层级控制");
  };

  setDockCollapsed(window.matchMedia("(max-width: 1500px)").matches);
  dom.dockToggle.addEventListener("click", () => {
    setDockCollapsed(!dom.anatomyDock.classList.contains("is-collapsed"));
  });

  dom.chapterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.time = Number(button.dataset.jump);
      setPlaying(false);
      updateReadouts();
      eeg.draw(state.time);
    });
  });

  dom.nextEvent.addEventListener("click", () => {
    const nextTime = state.time < ONSET ? 10.8 : state.time < SPREAD ? 15.2 : 0;
    state.time = nextTime;
    setPlaying(false);
    updateReadouts();
    eeg.draw(state.time);
  });

  const togglePresentation = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) {
      console.warn("Presentation mode unavailable", error);
    }
  };

  dom.present.addEventListener("click", togglePresentation);
  document.addEventListener("fullscreenchange", () => {
    dom.present.textContent = document.fullscreenElement ? "EXIT" : "PRESENT";
  });

  window.addEventListener("keydown", (event) => {
    if (["INPUT", "BUTTON"].includes(document.activeElement?.tagName)) return;
    if (event.code === "Space") {
      event.preventDefault();
      dom.play.click();
    } else if (["Digit1", "Digit2", "Digit3"].includes(event.code)) {
      dom.chapterButtons[Number(event.code.at(-1)) - 1]?.click();
    } else if (event.key.toLowerCase() === "f") {
      togglePresentation();
    }
  });

  const observer = new ResizeObserver(() => {
    eeg.resize();
    brain.resize();
  });
  observer.observe(dom.eegCanvas.parentElement);
  observer.observe(dom.brainCanvas);
}

function updateClock() {
  dom.clock.textContent = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function animate(now) {
  const delta = Math.min((now - state.lastFrame) / 1000, 0.05);
  state.lastFrame = now;

  if (state.playing) {
    state.time += delta * state.speed;
    if (state.time >= DURATION) {
      state.time = DURATION;
      setPlaying(false);
    }
  }

  eeg.draw(state.time);
  brain.update(state.time, delta);
  updateReadouts();
  requestAnimationFrame(animate);
}

function init() {
  try {
    eeg = new EEGRenderer(dom.eegCanvas);
    brain = new BrainRenderer(dom.brainCanvas);
    bindInteractions();
    updateClock();
    window.setInterval(updateClock, 1000);
    updateReadouts();
    requestAnimationFrame(animate);
  } catch (error) {
    console.error("NeuroTrace initialization failed", error);
    dom.brainCanvas.innerHTML = '<p style="padding:40px;color:#ff8c52;font:12px monospace">3D RENDERER UNAVAILABLE</p>';
  }
}

init();
