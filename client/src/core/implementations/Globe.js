import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BaseGlobe } from '../abstract/BaseGlobe';
import { SceneConfig, ScenePresets } from '../../configs/scene_config';

export class Globe extends BaseGlobe {
  starField = null;
  cloudMesh = null;
  nightMesh = null;
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  resizeObserver = null;
  textureLoader = null;
  config = null;
  
  // Храним ссылки на все слои - инициализируем в конструкторе
  layers = null;

  constructor(container, config) {
    const mergedConfig = Globe.mergeConfig(config);
    super(container, mergedConfig);
    this.config = mergedConfig;
    this.textureLoader = new THREE.TextureLoader();
    // Инициализируем layers здесь, после super()
    this.layers = {
      earth: null,
      clouds: null,
      atmosphere: null,
      night: null,
    };
  }

  static mergeConfig(userConfig) {
    const defaultConfig = {
      radius: SceneConfig.globe.radius,
      segments: SceneConfig.globe.segments,
      textureUrl: SceneConfig.globe.textures.earth,
      cloudTextureUrl: SceneConfig.globe.textures.clouds,
      nightTextureUrl: SceneConfig.globe.textures.night,
      atmosphereHeight: SceneConfig.globe.atmosphere.height,
      starDensity: SceneConfig.stars.count,
      backgroundColor: SceneConfig.background.color,
      camera: {
        position: SceneConfig.camera.defaultPosition.clone(),
        fov: SceneConfig.camera.fov,
        near: SceneConfig.camera.near,
        far: SceneConfig.camera.far,
      },
      controls: {
        enableDamping: SceneConfig.controls.enableDamping,
        dampingFactor: SceneConfig.controls.dampingFactor,
        minDistance: SceneConfig.controls.minDistance,
        maxDistance: SceneConfig.controls.maxDistance,
        rotateSpeed: SceneConfig.controls.rotateSpeed,
        zoomSpeed: SceneConfig.controls.zoomSpeed,
      },
      material: SceneConfig.globe.material,
      clouds: SceneConfig.globe.clouds,
      atmosphere: SceneConfig.globe.atmosphere,
      lighting: SceneConfig.lighting,
      stars: SceneConfig.stars,
      performance: SceneConfig.performance,
      textures: SceneConfig.globe.textures,
      textureMapping: SceneConfig.globe.textureMapping,
      layers: SceneConfig.globe.layers,
    };
    return { ...defaultConfig, ...userConfig };
  }

  initScene(container, config) {
    if (!this.textureLoader) {
      this.textureLoader = new THREE.TextureLoader();
    }
    
    // Убеждаемся что layers инициализирован
    if (!this.layers) {
      this.layers = {
        earth: null,
        clouds: null,
        atmosphere: null,
        night: null,
      };
    }

    this._scene = new THREE.Scene();
    const bgColor = config.backgroundColor instanceof THREE.Color
      ? config.backgroundColor
      : new THREE.Color(config.backgroundColor);
    this._scene.background = bgColor;

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(
      config.camera.fov,
      aspect,
      config.camera.near,
      config.camera.far
    );
    this.camera.position.copy(config.camera.position);

    this.renderer = new THREE.WebGLRenderer({
      antialias: config.performance.antialias,
      alpha: true
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, config.performance.pixelRatio || 2));
    this.renderer.toneMapping = config.performance.toneMapping || THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = config.performance.toneMappingExposure || 1.2;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = config.controls.enableDamping;
    this.controls.dampingFactor = config.controls.dampingFactor;
    this.controls.minDistance = config.controls.minDistance;
    this.controls.maxDistance = config.controls.maxDistance;
    this.controls.rotateSpeed = config.controls.rotateSpeed;
    this.controls.zoomSpeed = config.controls.zoomSpeed;

    this.globeGroup = new THREE.Group();
    this._scene.add(this.globeGroup);

    // Создаем все слои
    this.createGlobe(config);
    this.createClouds(config);
    this.createNightLayer(config);
    this.createAtmosphere();
    this.createStarField();
    this.setupLighting(config);

    // Применяем настройки слоев
    this.applyLayerSettings(config);

    this.resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      this.resize(width, height);
    });
    this.resizeObserver.observe(container);

    console.log('Globe initialized with config:', config);
  }

  createGlobe(config) {
    const geometry = new THREE.SphereGeometry(config.radius, config.segments, config.segments);
    const textureUrl = config.textureUrl || config.textures?.earth;

    const texture = this.textureLoader.load(
      textureUrl,
      () => console.log('Earth texture loaded'),
      undefined,
      (error) => {
        console.warn('Failed to load main texture, using fallback:', error);
        if (config.textures?.earthFallback) {
          this.textureLoader.load(config.textures.earthFallback, (fallbackTex) => {
            if (this.layers && this.layers.earth) {
              this.applyTextureSettings(fallbackTex, config);
              this.layers.earth.material.map = fallbackTex;
              this.layers.earth.material.needsUpdate = true;
            }
          });
        }
      }
    );

    this.applyTextureSettings(texture, config);

    const materialConfig = config.material || {};
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: materialConfig.roughness || 0.4,
      metalness: materialConfig.metalness || 0.05,
      emissive: materialConfig.emissive || new THREE.Color(0x000000),
      emissiveIntensity: materialConfig.emissiveIntensity || 0,
      bumpMap: null,
      bumpScale: materialConfig.bumpScale || 0.02,
      normalMap: null,
      normalScale: materialConfig.normalScale || new THREE.Vector2(0.8, 0.8),
      roughnessMap: null,
      metalnessMap: null,
      envMap: null,
      envMapIntensity: 0.5,
      flatShading: false,
      side: THREE.FrontSide,
      transparent: false,
      opacity: 1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.globeGroup.add(mesh);
    
    // Убеждаемся что layers существует
    if (this.layers) {
      this.layers.earth = mesh;
    }
    this.globeMesh = mesh;
  }

  createClouds(config) {
    if (!config.cloudTextureUrl && !config.textures?.clouds) return;

    const cloudTextureUrl = config.cloudTextureUrl || config.textures.clouds;
    const cloudTexture = this.textureLoader.load(
      cloudTextureUrl,
      () => console.log('Clouds texture loaded'),
      undefined,
      (error) => console.warn('Failed to load clouds texture:', error)
    );

    this.applyTextureSettings(cloudTexture, config);

    const cloudConfig = config.clouds || SceneConfig.globe.clouds;
    const cloudMaterial = new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: cloudConfig.opacity || 0.15,
      blending: cloudConfig.blending || THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 0.2,
      metalness: 0,
    });

    const cloudGeometry = new THREE.SphereGeometry(
      config.radius * (cloudConfig.scale || 1.005),
      config.segments,
      config.segments
    );

    const mesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    mesh.rotation.x = 0.1;
    this.globeGroup.add(mesh);
    
    if (this.layers) {
      this.layers.clouds = mesh;
    }
    this.cloudMesh = mesh;
  }

  createNightLayer(config) {
    if (!config.nightTextureUrl && !config.textures?.night) return;

    const nightTextureUrl = config.nightTextureUrl || config.textures.night;
    const nightTexture = this.textureLoader.load(
      nightTextureUrl,
      () => console.log('Night texture loaded'),
      undefined,
      (error) => console.warn('Failed to load night texture:', error)
    );

    this.applyTextureSettings(nightTexture, config);

    const nightMaterial = new THREE.MeshBasicMaterial({
      map: nightTexture,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    const nightGeometry = new THREE.SphereGeometry(
      config.radius * 1.003,
      config.segments,
      config.segments
    );

    const mesh = new THREE.Mesh(nightGeometry, nightMaterial);
    this.globeGroup.add(mesh);
    
    if (this.layers) {
      this.layers.night = mesh;
    }
    this.nightMesh = mesh;
  }

  applyLayerSettings(config) {
    const layersConfig = config.layers || SceneConfig.globe.layers;

    // Земля
    if (this.layers && this.layers.earth && layersConfig.earth) {
      this.layers.earth.material.opacity = layersConfig.earth.opacity || 1;
      this.layers.earth.visible = layersConfig.earth.enabled !== false;
    }

    // Облака
    if (this.layers && this.layers.clouds && layersConfig.clouds) {
      this.layers.clouds.material.opacity = layersConfig.clouds.opacity || 0.15;
      this.layers.clouds.visible = layersConfig.clouds.enabled !== false;
    }

    // Ночной слой
    if (this.layers && this.layers.night && layersConfig.night) {
      this.layers.night.material.opacity = layersConfig.night.opacity || 0;
      this.layers.night.visible = layersConfig.night.enabled || false;
    }

    // Атмосфера
    if (this.layers && this.layers.atmosphere && layersConfig.atmosphere) {
      this.layers.atmosphere.visible = layersConfig.atmosphere.enabled !== false;
      if (this.layers.atmosphere.material.uniforms) {
        this.layers.atmosphere.material.uniforms.uIntensity.value = layersConfig.atmosphere.intensity || 0.4;
      }
    }
  }

  applyTextureSettings(texture, config) {
    const mapping = config.textureMapping || SceneConfig.globe.textureMapping;

    if (texture) {
      texture.offset.x = mapping.offsetU || 0;
      texture.offset.y = mapping.offsetV || 0;
      texture.rotation = mapping.rotation || 0;
      texture.repeat.x = mapping.repeatU || 1;
      texture.repeat.y = mapping.repeatV || 1;

      texture.wrapS = mapping.wrapU || THREE.RepeatWrapping;
      texture.wrapT = mapping.wrapV || THREE.RepeatWrapping;

      texture.minFilter = mapping.minFilter || THREE.LinearMipmapLinearFilter;
      texture.magFilter = mapping.magFilter || THREE.LinearFilter;

      texture.needsUpdate = true;

      console.log('Texture settings applied:', {
        offset: texture.offset,
        repeat: texture.repeat,
        rotation: texture.rotation,
      });
    }
  }

  adjustTexture(settings) {
    const layerNames = ['earth', 'clouds', 'night'];
    
    for (const name of layerNames) {
      if (!this.layers) continue;
      const layer = this.layers[name];
      if (!layer || !layer.material || !layer.material.map) continue;
      
      const texture = layer.material.map;
      
      if (settings.offsetU !== undefined) texture.offset.x = settings.offsetU;
      if (settings.offsetV !== undefined) texture.offset.y = settings.offsetV;
      if (settings.rotation !== undefined) texture.rotation = settings.rotation;
      if (settings.repeatU !== undefined) texture.repeat.x = settings.repeatU;
      if (settings.repeatV !== undefined) texture.repeat.y = settings.repeatV;
      
      texture.needsUpdate = true;
    }

    if (settings.offsetU !== undefined) this.config.textureMapping.offsetU = settings.offsetU;
    if (settings.offsetV !== undefined) this.config.textureMapping.offsetV = settings.offsetV;
    if (settings.rotation !== undefined) this.config.textureMapping.rotation = settings.rotation;

    console.log('All textures adjusted:', settings);
  }

  setLayer(name, settings) {
    if (!this.layers) {
      console.warn('Layers not initialized');
      return;
    }
    
    const layer = this.layers[name];
    if (!layer) {
      console.warn(`Layer "${name}" not found`);
      return;
    }

    if (settings.opacity !== undefined) {
      layer.material.opacity = settings.opacity;
    }
    if (settings.enabled !== undefined) {
      layer.visible = settings.enabled;
    }
    if (settings.blending !== undefined) {
      layer.material.blending = settings.blending;
    }

    layer.material.needsUpdate = true;
    console.log(`Layer "${name}" updated:`, settings);
  }

  setupLighting(config) {
    const lighting = config.lighting || SceneConfig.lighting;

    const ambientLight = new THREE.AmbientLight(
      lighting.ambient.color,
      lighting.ambient.intensity
    );
    this._scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(
      lighting.sun.color,
      lighting.sun.intensity
    );
    sunLight.position.copy(lighting.sun.position);
    sunLight.castShadow = false;
    this._scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(
      lighting.fill.color,
      lighting.fill.intensity
    );
    fillLight.position.copy(lighting.fill.position);
    this._scene.add(fillLight);

    const topLight = new THREE.DirectionalLight(
      lighting.top.color,
      lighting.top.intensity
    );
    topLight.position.copy(lighting.top.position);
    this._scene.add(topLight);

    const hemiLight = new THREE.HemisphereLight(
      lighting.hemisphere.skyColor,
      lighting.hemisphere.groundColor,
      lighting.hemisphere.intensity
    );
    this._scene.add(hemiLight);
  }

  createAtmosphere() {
    if (!this.config) {
      console.warn('Config not available for atmosphere creation');
      return;
    }

    const atmConfig = this.config.atmosphere || SceneConfig.globe.atmosphere;
    const geometry = new THREE.SphereGeometry(
      this.config.radius + (atmConfig.height || 0.025),
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
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uRimPower;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vPosition);
          float rim = 1.0 - max(0.0, dot(viewDir, vNormal));
          rim = pow(rim, uRimPower);
          gl_FragColor = vec4(uColor, rim * uIntensity);
        }
      `,
      uniforms: {
        uColor: { value: atmConfig.color || new THREE.Color(0x4488ff) },
        uIntensity: { value: atmConfig.intensity || 0.4 },
        uRimPower: { value: atmConfig.rimPower || 3.0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false,
      wireframe: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.globeGroup.add(mesh);
    
    if (this.layers) {
      this.layers.atmosphere = mesh;
    }
    this.atmosphere = mesh;
  }

  createStarField() {
    if (!this.config) {
      console.warn('Config not available for star field creation');
      return;
    }

    const starsConfig = this.config.stars || SceneConfig.stars;
    const starsCount = starsConfig.count || 3000;
    const positions = new Float32Array(starsCount * 3);
    const colors = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount; i++) {
      const radius = (starsConfig.minRadius || 50) + Math.random() * (starsConfig.maxRadius - starsConfig.minRadius || 50);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const brightness = 0.5 + Math.random() * 0.5;
      colors[i * 3] = brightness;
      colors[i * 3 + 1] = brightness;
      colors[i * 3 + 2] = brightness * (0.8 + Math.random() * 0.2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: starsConfig.size || 0.08,
      vertexColors: true,
      transparent: true,
      opacity: starsConfig.opacity || 0.8,
      sizeAttenuation: true,
    });

    this.starField = new THREE.Points(geometry, material);
    this._scene.add(this.starField);
  }

  update(deltaTime) {
    if (this.controls) {
      this.controls.update();
    }

    if (this.layers && this.layers.clouds && this.layers.clouds.visible) {
      this.layers.clouds.rotation.y += deltaTime * (SceneConfig.globe.clouds.speed || 0.01);
    }

    if (this.starField) {
      const material = this.starField.material;
      material.opacity = 0.7 + Math.sin(Date.now() * 0.0005) * 0.1;
    }

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
    const r = radius || this.config.radius || 1;
    const latRad = lat * Math.PI / 180;
    const lonRad = lon * Math.PI / 180;
    return new THREE.Vector3(
      r * Math.cos(latRad) * Math.sin(lonRad),
      r * Math.sin(latRad),
      r * Math.cos(latRad) * Math.cos(lonRad)
    );
  }

  setTexture(textureUrl, settings = {}) {
    if (!this.globeMesh) return;
    this.textureLoader.load(textureUrl, (texture) => {
      if (settings.offsetU !== undefined || settings.offsetV !== undefined) {
        this.adjustTexture(settings);
      }
      this.globeMesh.material.map = texture;
      this.globeMesh.material.needsUpdate = true;
      console.log('Texture updated:', textureUrl);
    });
  }

  setPreset(presetName) {
    const presets = {
      day: ScenePresets.day,
      night: ScenePresets.night,
      scientific: ScenePresets.scientific,
    };

    const preset = presets[presetName];
    if (!preset) return;

    if (preset.globe?.layers) {
      for (const [name, settings] of Object.entries(preset.globe.layers)) {
        this.setLayer(name, settings);
      }
    }

    if (preset.lighting) {
      this._scene.children.forEach(child => {
        if (child.isAmbientLight && preset.lighting.ambient) {
          child.intensity = preset.lighting.ambient.intensity || child.intensity;
        }
        if (child.isDirectionalLight && child.position.x > 0 && preset.lighting.sun) {
          child.intensity = preset.lighting.sun.intensity || child.intensity;
        }
      });
    }

    console.log(`Preset changed to: ${presetName}`);
  }

  dispose() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    super.dispose();
  }
}