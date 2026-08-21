/*
 * Anatomical renderer adapted from NeuroTrace EEG Digital Twin.
 * Original application code: Copyright (c) 2026 Atham-He, MIT License.
 * Anatomical asset: BodyParts3D, CC BY-SA 2.1 Japan.
 * See THIRD_PARTY_NOTICES.md and assets/anatomy/LICENSE.md.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const ANATOMY = {
  left_frontal: { layer: "cortex", color: 0x67c7cb, opacity: 0.2, label: "左额叶" },
  right_frontal: { layer: "cortex", color: 0x4f9ea6, opacity: 0.13, label: "右额叶" },
  left_temporal: { layer: "cortex", color: 0x769dbc, opacity: 0.24, label: "左颞叶" },
  right_temporal: { layer: "cortex", color: 0x607d9a, opacity: 0.14, label: "右颞叶" },
  left_parietal: { layer: "cortex", color: 0x70baa9, opacity: 0.18, label: "左顶叶" },
  right_parietal: { layer: "cortex", color: 0x568f83, opacity: 0.12, label: "右顶叶" },
  left_occipital: { layer: "cortex", color: 0x9987ad, opacity: 0.18, label: "左枕叶" },
  right_occipital: { layer: "cortex", color: 0x746783, opacity: 0.12, label: "右枕叶" },
  left_insula: { layer: "regions", color: 0xc4a27d, opacity: 0.34, label: "左岛叶" },
  right_insula: { layer: "regions", color: 0x9f8569, opacity: 0.27, label: "右岛叶" },
  left_limbic: { layer: "regions", color: 0xbd8395, opacity: 0.39, label: "左边缘叶 / 海马" },
  right_limbic: { layer: "regions", color: 0x946b79, opacity: 0.31, label: "右边缘叶 / 海马" },
  white_matter: { layer: "cortex", color: 0xb7d6dd, opacity: 0.07, label: "大脑白质" },
  ventricles: { layer: "regions", color: 0x5cbfd0, opacity: 0.5, label: "脑室系统" },
  cerebellum: { layer: "regions", color: 0x5aa99c, opacity: 0.26, label: "小脑" },
  brainstem: { layer: "regions", color: 0x668dac, opacity: 0.4, label: "脑干" },
  hypothalamus: { layer: "regions", color: 0xc1a26d, opacity: 0.52, label: "下丘脑" },
  pineal_habenula: { layer: "regions", color: 0xd0bd88, opacity: 0.56, label: "松果体 / 缰核" },
  corpus_callosum: { layer: "regions", color: 0xc6d9dc, opacity: 0.3, label: "胼胝体" },
  amygdala: { layer: "regions", color: 0xc8707b, opacity: 0.58, label: "杏仁核" },
  caudate: { layer: "regions", color: 0x80b4c1, opacity: 0.5, label: "尾状核" },
  globus_pallidus: { layer: "regions", color: 0xc6ad6f, opacity: 0.52, label: "苍白球" },
  putamen: { layer: "regions", color: 0x78ad85, opacity: 0.52, label: "壳核" },
  thalamus: { layer: "regions", color: 0xbd8d72, opacity: 0.52, label: "丘脑" },
};

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
const smoothStep = (value) => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};

function seeded(index) {
  const value = Math.sin(index * 91.117 + 12.31) * 43758.5453;
  return value - Math.floor(value);
}

class BrainRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ready = false;
    this.anatomyReady = false;
    this.anatomyMeshes = new Map();
    this.nodes = [];
    this.pulses = [];
    this.arcs = [];
    this.electrodeSignature = "";

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.04;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      this.camera.position.set(0, 0.12, 8.75);
      this.camera.lookAt(0, 0.04, 0);

      this.brain = new THREE.Group();
      this.scene.add(this.brain);
      this.focus = new THREE.Vector3(1.35, -0.35, 0.72);

      this.createLights();
      this.createProceduralShell();
      this.createNeuralNetwork();
      this.createFocusEffects();
      this.createPropagationArcs();
      this.electrodeRoot = new THREE.Group();
      this.brain.add(this.electrodeRoot);
      this.loadAnatomy();
      this.ready = true;
    } catch (error) {
      console.error("Three.js anatomical brain initialization failed", error);
      this.ready = false;
    }
  }

  createLights() {
    this.scene.add(new THREE.HemisphereLight(0xa5f4f6, 0x03070d, 1.2));
    const key = new THREE.PointLight(0x6de6eb, 28, 20, 2);
    key.position.set(4, 4, 5);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x376fd3, 17, 18, 2);
    rim.position.set(-5, 0, -4);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xc9f8f7, 1.25);
    fill.position.set(-2, 5, 3);
    this.scene.add(fill);
    this.seizureLight = new THREE.PointLight(0xff5a3d, 0, 6, 2);
    this.seizureLight.position.copy(this.focus);
    this.brain.add(this.seizureLight);
  }

  makeHemisphereGeometry(side) {
    const geometry = new THREE.SphereGeometry(2.05, 88, 70);
    const positions = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    for (let index = 0; index < positions.count; index += 1) {
      vertex.fromBufferAttribute(positions, index);
      const direction = vertex.clone().normalize();
      const theta = Math.atan2(direction.z, direction.x);
      const phi = Math.asin(direction.y);
      const folds =
        Math.sin(theta * 8 + Math.sin(phi * 5) * 1.7) * 0.07
        + Math.sin(phi * 13 - theta * 2.2) * 0.045
        + Math.sin((theta + phi) * 17) * 0.022;
      vertex.multiplyScalar(1 + folds);
      vertex.x *= 0.78;
      vertex.y *= 0.92;
      vertex.z *= 1.18;
      vertex.x += side * 0.62;
      vertex.z += 0.12;
      if (side * vertex.x < 0.12) vertex.x = side * (0.12 + Math.abs(vertex.x) * 0.14);
      positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  createProceduralShell() {
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
        vec3 color = mix(vec3(0.13, 0.72, 0.82), vec3(1.0, 0.22, 0.08), clamp(focusGlow * 1.45, 0.0, 1.0));
        float alpha = 0.055 + fresnel * 0.42 + lattice * 0.04 + scan * 0.04 + focusGlow * 0.22;
        gl_FragColor = vec4(color, alpha);
      }
    `;
    this.shellUniforms = {
      uTime: { value: 0 },
      uActivity: { value: 0 },
      uFocus: { value: this.focus.clone() },
    };
    const material = new THREE.ShaderMaterial({
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
      this.proceduralShell.add(new THREE.Mesh(geometry, material));
      const wire = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color: 0x55d9e8,
        wireframe: true,
        transparent: true,
        opacity: 0.035,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      wire.scale.setScalar(1.004);
      this.proceduralShell.add(wire);
    });
  }

  loadAnatomy() {
    const loaderLabel = document.getElementById("brain-model-loader");
    new GLTFLoader().load(
      "./assets/anatomy/brain-anatomy.glb",
      (gltf) => {
        this.anatomyRoot = gltf.scene;
        const meshes = [];
        this.anatomyRoot.traverse((object) => {
          if (object.isMesh) meshes.push(object);
        });
        meshes.forEach((mesh) => {
          const config = ANATOMY[mesh.name];
          if (!config) return;
          const color = new THREE.Color(config.color);
          mesh.material = new THREE.MeshPhysicalMaterial({
            color,
            emissive: color.clone().multiplyScalar(0.11),
            emissiveIntensity: 0.32,
            metalness: config.layer === "cortex" ? 0.05 : 0.12,
            roughness: config.layer === "cortex" ? 0.3 : 0.25,
            transparent: true,
            opacity: config.opacity,
            depthWrite: false,
            side: THREE.DoubleSide,
            clearcoat: 0.68,
            clearcoatRoughness: 0.28,
          });
          mesh.renderOrder = config.layer === "cortex" ? 2 : 4;
          mesh.userData.layer = config.layer;
          mesh.userData.baseOpacity = config.opacity;
          mesh.userData.baseColor = color.clone();
          mesh.userData.label = config.label;
          mesh.frustumCulled = false;
          if (config.layer === "cortex") {
            const wire = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({
              color: color.clone().lerp(new THREE.Color(0xc9fcff), 0.45),
              wireframe: true,
              transparent: true,
              opacity: config.opacity * 0.3,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            }));
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
        if (loaderLabel) {
          loaderLabel.textContent = `${this.anatomyMeshes.size} ANATOMICAL STRUCTURES ONLINE`;
          loaderLabel.closest(".brain-model-loader")?.classList.add("ready");
        }
      },
      (event) => {
        if (!loaderLabel || !event.total) return;
        loaderLabel.textContent = `LOADING ANATOMY · ${Math.round((event.loaded / event.total) * 100)}%`;
      },
      (error) => {
        console.warn("Anatomical GLB unavailable; procedural fallback remains active", error);
        if (loaderLabel) {
          loaderLabel.textContent = "PROCEDURAL FALLBACK ACTIVE";
          window.setTimeout(() => loaderLabel.closest(".brain-model-loader")?.classList.add("ready"), 900);
        }
      },
    );
  }

  randomInsideBrain(index) {
    const side = seeded(index + 3) > 0.5 ? 1 : -1;
    const radius = Math.cbrt(seeded(index * 4 + 1));
    const theta = seeded(index * 4 + 2) * Math.PI * 2;
    const phi = Math.acos(2 * seeded(index * 4 + 3) - 1);
    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * 1.18 * radius + side * 0.36,
      Math.cos(phi) * 1.32 * radius,
      Math.sin(phi) * Math.sin(theta) * 1.7 * radius + 0.08,
    );
  }

  createNeuralNetwork() {
    const count = 116;
    const geometry = new THREE.IcosahedronGeometry(0.019, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.86 });
    this.nodeMesh = new THREE.InstancedMesh(geometry, material, count);
    this.nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.brain.add(this.nodeMesh);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let index = 0; index < count; index += 1) {
      const position = this.randomInsideBrain(index);
      this.nodes.push(position);
      dummy.position.copy(position);
      dummy.scale.setScalar(0.72 + seeded(index + 1000) * 0.8);
      dummy.updateMatrix();
      this.nodeMesh.setMatrixAt(index, dummy.matrix);
      color.setHSL(0.51, 0.82, 0.56 + seeded(index + 2000) * 0.24);
      this.nodeMesh.setColorAt(index, color);
    }
    const points = [];
    for (let index = 0; index < count; index += 1) {
      const origin = this.nodes[index];
      const nearest = [];
      for (let target = index + 1; target < count; target += 1) {
        const distance = origin.distanceTo(this.nodes[target]);
        if (distance < 0.72) nearest.push({ target, distance });
      }
      nearest.sort((a, b) => a.distance - b.distance).slice(0, 2).forEach(({ target }) => {
        const destination = this.nodes[target];
        points.push(origin.x, origin.y, origin.z, destination.x, destination.y, destination.z);
      });
    }
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    this.networkMaterial = new THREE.LineBasicMaterial({
      color: 0x39cde1,
      transparent: true,
      opacity: 0.12,
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

  createFocusEffects() {
    this.focusSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.createRadialTexture(),
      color: 0xff6a3d,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.focusSprite.position.copy(this.focus);
    this.focusSprite.scale.setScalar(1.25);
    this.brain.add(this.focusSprite);
    for (let index = 0; index < 3; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.342, 64),
        new THREE.MeshBasicMaterial({
          color: index === 2 ? 0xff3c33 : 0xff8b4e,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      ring.position.copy(this.focus);
      ring.userData.offset = index / 3;
      this.pulses.push(ring);
      this.brain.add(ring);
    }
  }

  createPropagationArcs() {
    this.arcs.forEach((arc) => {
      this.brain.remove(arc);
      arc.geometry.dispose();
      arc.material.dispose();
    });
    this.arcs = [];
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
      const geometry = new THREE.BufferGeometry().setFromPoints(
        new THREE.QuadraticBezierCurve3(this.focus, middle, target).getPoints(54),
      );
      geometry.setDrawRange(0, 0);
      const arc = new THREE.Line(geometry, new THREE.LineBasicMaterial({
        color: index < 2 ? 0xff9b54 : 0xff4b45,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      arc.userData.index = index;
      this.arcs.push(arc);
      this.brain.add(arc);
    });
  }

  updateFocusPosition(position) {
    this.focus.copy(position);
    this.shellUniforms.uFocus.value.copy(position);
    this.seizureLight.position.copy(position);
    this.focusSprite.position.copy(position);
    this.pulses.forEach((ring) => ring.position.copy(position));
    this.createPropagationArcs();
  }

  rebuildElectrodes(channels, threshold) {
    const signature = channels.map((channel) => `${channel.name}:${Math.round(channel.quality)}`).join("|");
    if (signature === this.electrodeSignature) return;
    this.electrodeSignature = signature;
    while (this.electrodeRoot.children.length) {
      const child = this.electrodeRoot.children.pop();
      child.geometry.dispose();
      child.material.dispose();
    }
    channels.forEach((channel) => {
      if (!channel.brain) return;
      const normalizedX = clamp(channel.brain[0], -1, 1);
      const normalizedZ = clamp(channel.brain[2], -1, 1);
      const radial = Math.min(1, normalizedX * normalizedX * 0.72 + normalizedZ * normalizedZ * 0.72);
      const y = 0.34 + Math.sqrt(Math.max(0, 1 - radial)) * 1.42;
      const excellent = channel.quality >= threshold;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.038, 12, 10),
        new THREE.MeshBasicMaterial({
          color: excellent ? 0x42ff79 : 0x6b5d59,
          transparent: true,
          opacity: excellent ? 0.94 : 0.34,
        }),
      );
      mesh.position.set(normalizedX * 1.72, y, normalizedZ * 2.04);
      mesh.userData.channel = channel;
      this.electrodeRoot.add(mesh);
    });
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    if (this.renderWidth !== width || this.renderHeight !== height || this.renderPixelRatio !== pixelRatio) {
      this.renderWidth = width;
      this.renderHeight = height;
      this.renderPixelRatio = pixelRatio;
      this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(width, height, false);
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(options) {
    if (!this.ready) return false;
    this.resize();
    const intensity = options.blocked ? 0 : options.intensity || 0;
    const propagation = options.spread || 0;
    const time = options.time || 0;
    const pulse = 0.62 + Math.sin(time * 8.4) * 0.22 + Math.sin(time * 19.7) * 0.12;
    const layers = options.layers || {};

    this.brain.rotation.x = options.pitch || 0;
    this.brain.rotation.y = options.yaw || 0;
    this.brain.scale.setScalar((options.scale || 1) * 0.9);
    this.proceduralShell.visible = !this.anatomyReady && layers.cortex !== false;
    this.shellUniforms.uTime.value = time;
    this.shellUniforms.uActivity.value = intensity * (0.78 + pulse * 0.3);

    const hotColor = new THREE.Color(options.phaseKey === "recovery" ? 0xffa545 : 0xff3d2f);
    const blockedColor = new THREE.Color(0x5a6667);
    this.anatomyMeshes.forEach((mesh, name) => {
      const visibleByLayer = mesh.userData.layer === "cortex" ? layers.cortex !== false : layers.regions !== false;
      mesh.visible = visibleByLayer;
      let recruitment = 0.06;
      if (name === "left_temporal") recruitment = 1;
      else if (["left_insula", "left_limbic", "amygdala"].includes(name)) recruitment = 0.82;
      else if (["thalamus", "putamen", "caudate", "globus_pallidus", "hypothalamus"].includes(name)) recruitment = 0.3 + propagation * 0.52;
      else if (["left_frontal", "left_parietal"].includes(name)) recruitment = propagation * 0.84;
      else if (["right_temporal", "right_frontal", "right_parietal"].includes(name)) recruitment = propagation * 0.3;
      else if (name === "corpus_callosum") recruitment = propagation * 0.68;
      else recruitment = propagation * 0.18;
      const localActivity = intensity * recruitment * (0.82 + pulse * 0.18);
      const baseColor = mesh.userData.baseColor;
      mesh.material.color.copy(options.blocked ? blockedColor : baseColor);
      mesh.material.emissive.copy(options.blocked ? blockedColor : baseColor).lerp(hotColor, localActivity);
      mesh.material.emissiveIntensity = options.blocked ? 0.08 : 0.3 + localActivity * 3.8;
      mesh.material.opacity = options.blocked
        ? Math.min(0.12, mesh.userData.baseOpacity)
        : Math.min(0.82, mesh.userData.baseOpacity + localActivity * 0.36);
      if (mesh.userData.wire) {
        mesh.userData.wire.visible = visibleByLayer;
        mesh.userData.wire.material.color.copy(baseColor).lerp(hotColor, localActivity);
        mesh.userData.wire.material.opacity = options.blocked ? 0.02 : mesh.userData.baseOpacity * 0.28 + localActivity * 0.28;
      }
    });

    const showActivity = layers.particles !== false && !options.blocked;
    this.nodeMesh.visible = showActivity;
    this.network.visible = showActivity;
    this.focusSprite.visible = showActivity;
    this.pulses.forEach((ring) => { ring.visible = showActivity; });
    this.arcs.forEach((arc) => { arc.visible = showActivity; });
    this.networkMaterial.opacity = 0.11 + intensity * 0.16;
    this.focusSprite.material.opacity = intensity * (0.44 + pulse * 0.27);
    this.focusSprite.scale.setScalar(0.95 + intensity * (0.86 + pulse * 0.24));
    this.seizureLight.intensity = intensity * (18 + pulse * 8);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    this.nodes.forEach((position, index) => {
      const distance = position.distanceTo(this.focus);
      const activation = intensity * Math.exp(-distance * distance * (0.72 + (1 - propagation) * 1.75));
      const synchrony = clamp(activation * 1.4);
      const flickerPhase = time * (8 + seeded(index) * 13 * (1 - synchrony)) + index * (1 - synchrony);
      const flicker = 0.74 + Math.sin(flickerPhase) * (0.15 + synchrony * 0.11);
      dummy.position.copy(position);
      dummy.scale.setScalar(0.72 + activation * flicker * 2.5 + seeded(index + 1000) * 0.45);
      dummy.updateMatrix();
      this.nodeMesh.setMatrixAt(index, dummy.matrix);
      color.setRGB(0.18 + activation * 0.82, 0.78 - activation * 0.48, 0.9 - activation * 0.72);
      this.nodeMesh.setColorAt(index, color);
    });
    this.nodeMesh.instanceMatrix.needsUpdate = true;
    this.nodeMesh.instanceColor.needsUpdate = true;

    this.pulses.forEach((ring) => {
      const phase = (time * 0.62 + ring.userData.offset) % 1;
      ring.scale.setScalar(0.7 + phase * 3.2);
      ring.material.opacity = intensity * (1 - phase) * 0.54;
      ring.lookAt(this.camera.position);
    });
    this.arcs.forEach((arc) => {
      const reveal = smoothStep((propagation - arc.userData.index * 0.11) / 0.62);
      const count = arc.geometry.attributes.position.count;
      arc.geometry.setDrawRange(0, Math.floor(count * reveal));
      arc.material.opacity = reveal * (0.34 + Math.abs(Math.sin(time * 7 + arc.userData.index)) * 0.5);
    });

    this.rebuildElectrodes(options.channels || [], options.qualityThreshold || 85);
    this.electrodeRoot.visible = layers.electrodes !== false;
    this.electrodeRoot.children.forEach((electrode) => {
      const channel = electrode.userData.channel;
      const relevant = intensity > 0.12 && channel.relevance > 0.6 && channel.quality >= (options.qualityThreshold || 85);
      electrode.material.color.setHex(relevant ? 0xff8b43 : channel.quality >= (options.qualityThreshold || 85) ? 0x42ff79 : 0x6b5d59);
      electrode.scale.setScalar(relevant ? 1.28 + pulse * 0.16 : 1);
    });

    this.renderer.render(this.scene, this.camera);
    return true;
  }
}

window.BrainRenderer = BrainRenderer;
