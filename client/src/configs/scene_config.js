import * as THREE from 'three';

export const SceneConfig = {
  globe: {
    radius: 1,
    segments: 64,
    
    textures: {
      earth: 'https://unpkg.com/three-globe@2.24.8/example/img/earth-blue-marble.jpg',
      earthFallback: 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
      clouds: 'https://unpkg.com/three-globe@2.24.8/example/img/earth-water.png',
      night: 'https://unpkg.com/three-globe@2.24.8/example/img/earth-night.jpg',
      bump: 'https://unpkg.com/three-globe@2.24.8/example/img/earth-topology.png',
    },

    material: {
      roughness: 0.4,
      metalness: 0.05,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
      bumpScale: 0.02,
      normalScale: new THREE.Vector2(0.8, 0.8),
    },

    clouds: {
      opacity: 0.15,
      speed: 0.01,
      scale: 1.005,
      blending: THREE.AdditiveBlending,
    },

    atmosphere: {
      height: 0.025,
      color: new THREE.Color(0x4488ff),
      intensity: 0.4,
      rimPower: 3.0,
    },

    // НАСТРОЙКИ ТЕКСТУРЫ
    textureMapping: {
      // Смещение текстуры по оси U (долгота)
      offsetU: 0.25,
      offsetV: 0,
      rotation: 0,
      repeatU: 1,
      repeatV: 1,
      wrapU: THREE.RepeatWrapping,
      wrapV: THREE.RepeatWrapping,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    },

    // Управление слоями (каждый слой можно включать/выключать)
    layers: {
      earth: {
        enabled: true,
        opacity: 1,
        blending: THREE.NormalBlending,
      },
      clouds: {
        enabled: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        speed: 0.01,
      },
      atmosphere: {
        enabled: true,
        intensity: 0.4,
        color: '#4488ff',
      },
      night: {
        enabled: false,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
      },
    },
  },

  lighting: {
    ambient: { color: new THREE.Color(0x446688), intensity: 0.6 },
    sun: { color: new THREE.Color(0xffeedd), intensity: 1.5, position: new THREE.Vector3(5, 3, 5) },
    fill: { color: new THREE.Color(0x4488ff), intensity: 0.3, position: new THREE.Vector3(-3, -2, -5) },
    top: { color: new THREE.Color(0x8888ff), intensity: 0.2, position: new THREE.Vector3(0, 10, 0) },
    hemisphere: { skyColor: new THREE.Color(0x4488ff), groundColor: new THREE.Color(0x002244), intensity: 0.4 },
  },

  camera: {
    fov: 45,
    near: 0.1,
    far: 100,
    defaultPosition: new THREE.Vector3(0, 0, 3),
  },

  controls: {
    enableDamping: true,
    dampingFactor: 0.05,
    minDistance: 1.5,
    maxDistance: 10,
    rotateSpeed: 0.5,
    zoomSpeed: 1.0,
  },

  stars: {
    count: 3000,
    size: 0.08,
    opacity: 0.8,
    minRadius: 50,
    maxRadius: 100,
  },

  background: {
    color: new THREE.Color(0x000011),
  },

  performance: {
    pixelRatio: 2,
    antialias: true,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.2,
  },
};

export const ScenePresets = {
  day: {
    globe: {
      layers: {
        earth: { opacity: 1 },
        clouds: { opacity: 0.2, enabled: true },
        atmosphere: { intensity: 0.3 },
        night: { enabled: false },
      }
    },
    lighting: {
      ambient: { intensity: 0.8 },
      sun: { intensity: 1.8 },
      fill: { intensity: 0.5 },
    },
  },
  night: {
    globe: {
      layers: {
        earth: { opacity: 1 },
        clouds: { opacity: 0.05, enabled: true },
        atmosphere: { intensity: 0.6 },
        night: { enabled: true, opacity: 0.4 },
      }
    },
    lighting: {
      ambient: { intensity: 0.2 },
      sun: { intensity: 0.3 },
      fill: { intensity: 0.6 },
      top: { intensity: 0.1 },
    },
  },
  scientific: {
    globe: {
      layers: {
        earth: { opacity: 1 },
        clouds: { enabled: false },
        atmosphere: { enabled: false },
        night: { enabled: false },
      }
    },
    lighting: {
      ambient: { intensity: 0.7 },
      sun: { intensity: 1.2 },
      fill: { intensity: 0.4 },
    },
  },
};