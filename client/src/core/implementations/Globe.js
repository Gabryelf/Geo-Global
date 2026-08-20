import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BaseGlobe } from '../abstract/BaseGlobe';

/**
 * Реализация глобуса с использованием Three.js
 */
export class Globe extends BaseGlobe {
  /** @type {THREE.Points|null} */
  starField = null;
  /** @type {THREE.Mesh|null} */
  cloudMesh = null;
  /** @type {THREE.Raycaster} */
  raycaster = new THREE.Raycaster();
  /** @type {THREE.Vector2} */
  mouse = new THREE.Vector2();
  /** @type {ResizeObserver|null} */
  resizeObserver = null;

  constructor(container, config) {
    super(container, config);
  }

  initScene(container, config) {
    // Создание сцены
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(config.backgroundColor);

    // Создание камеры
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(
      config.camera.fov,
      aspect,
      config.camera.near,
      config.camera.far
    );
    this.camera.position.copy(config.camera.position);

    // Создание рендерера
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    // Создание контролов
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = config.controls.enableDamping;
    this.controls.dampingFactor = config.controls.dampingFactor;
    this.controls.minDistance = config.controls.minDistance;
    this.controls.maxDistance = config.controls.maxDistance;
    this.controls.rotateSpeed = config.controls.rotateSpeed;
    this.controls.zoomSpeed = config.controls.zoomSpeed;

    // Создание групп
    this.globeGroup = new THREE.Group();
    this._scene.add(this.globeGroup);

    // Создание компонентов
    this.createGlobe(config);
    this.createAtmosphere();
    this.createStarField();

    // Настройка обработчика изменения размера
    this.resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      this.resize(width, height);
    });
    this.resizeObserver.observe(container);

    // Логируем успешную инициализацию
    console.log('Globe initialized with scene:', this._scene);
    console.log('Renderer created:', this.renderer);
  }

  createGlobe(config) {
    // Создание сферы глобуса
    const geometry = new THREE.SphereGeometry(config.radius, config.segments, config.segments);

    // Загрузка текстуры
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(config.textureUrl);

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.5,
      metalness: 0.1,
      emissive: new THREE.Color(0x111122),
      emissiveIntensity: 0.1,
    });

    this.globeMesh = new THREE.Mesh(geometry, material);
    this.globeGroup.add(this.globeMesh);

    // Создание облаков
    if (config.cloudTextureUrl) {
      const cloudTexture = textureLoader.load(config.cloudTextureUrl);
      const cloudMaterial = new THREE.MeshStandardMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const cloudGeometry = new THREE.SphereGeometry(
        config.radius * 1.01,
        config.segments,
        config.segments
      );
      this.cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
      this.globeGroup.add(this.cloudMesh);
    }

    // Добавление освещения
    const ambientLight = new THREE.AmbientLight(0x444466, 0.5);
    this._scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffeedd, 1.5);
    sunLight.position.set(5, 3, 5);
    this._scene.add(sunLight);

    const backLight = new THREE.DirectionalLight(0x4488ff, 0.3);
    backLight.position.set(-5, -3, -5);
    this._scene.add(backLight);
  }

  createAtmosphere() {
    if (!this.config) {
      console.warn('Config not available for atmosphere creation');
      return;
    }

    const geometry = new THREE.SphereGeometry(
      this.config.radius + this.config.atmosphereHeight,
      48,
      48
    );

    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vPosition);
          float rim = 1.0 - max(0.0, dot(viewDir, vNormal));
          rim = pow(rim, 3.0);
          gl_FragColor = vec4(0.3, 0.6, 1.0, rim * 0.6);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false,
      wireframe: false,
    });

    this.atmosphere = new THREE.Mesh(geometry, material);
    this.globeGroup.add(this.atmosphere);
  }

  createStarField() {
    if (!this.config) {
      console.warn('Config not available for star field creation');
      return;
    }

    const starsCount = this.config.starDensity || 2000;
    const positions = new Float32Array(starsCount * 3);
    const colors = new Float32Array(starsCount * 3);
    const sizes = new Float32Array(starsCount);

    for (let i = 0; i < starsCount; i++) {
      const radius = 50 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const brightness = 0.5 + Math.random() * 0.5;
      colors[i * 3] = brightness;
      colors[i * 3 + 1] = brightness;
      colors[i * 3 + 2] = brightness * (0.8 + Math.random() * 0.2);

      sizes[i] = 0.5 + Math.random() * 1.5;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    this.starField = new THREE.Points(geometry, material);
    this._scene.add(this.starField);
  }

  update(deltaTime) {
    if (this.controls) {
      this.controls.update();
    }

    // Вращение облаков
    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += deltaTime * 0.02;
    }

    // Мерцание звезд
    if (this.starField) {
      const material = this.starField.material;
      material.opacity = 0.7 + Math.sin(Date.now() * 0.001) * 0.1;
    }

    // Обновление уровня зума
    if (this.camera && this.controls) {
      const distance = this.camera.position.length();
      this.zoomLevel = Math.max(
        this.MIN_ZOOM,
        Math.min(
          this.MAX_ZOOM,
          ((distance - this.controls.minDistance) /
            (this.controls.maxDistance - this.controls.minDistance)) * 100
        )
      );
    }

    // Явный рендеринг
    if (this.renderer && this._scene && this.camera) {
      this.renderer.render(this._scene, this.camera);
    }
  }

  setZoomLevel(level) {
    if (!this.camera || !this.controls) return;

    const clamped = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, level));
    const ratio = clamped / this.MAX_ZOOM;
    const distance = this.controls.minDistance +
      (this.controls.maxDistance - this.controls.minDistance) * ratio;

    const direction = this.camera.position.clone().normalize();
    this.camera.position.copy(direction.multiplyScalar(distance));
    this.controls.update();
  }

  getSurfaceCoordinates(mouseX, mouseY) {
    if (!this.globeMesh || !this.camera) return null;

    this.mouse.set(mouseX, mouseY);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObject(this.globeMesh);
    if (intersects.length > 0) {
      return intersects[0].point;
    }
    return null;
  }

  latLonToPosition(lat, lon, radius) {
    const r = radius || (this.config ? this.config.radius : 1);
    const phi = (90 - lat) * Math.PI / 180;
    const theta = lon * Math.PI / 180;

    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }

  dispose() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    super.dispose();
  }
}