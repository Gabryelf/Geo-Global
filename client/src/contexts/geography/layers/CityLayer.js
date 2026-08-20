import * as THREE from 'three';
import { LayerType } from '../../../core/interfaces/ILayer';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('CityLayer');

export class CityLayer {
  id = 'city-layer';
  name = 'Города мира';
  type = LayerType.MARKER;
  visible = true;
  opacity = 1;
  zIndex = 20;

  group = new THREE.Group();
  scene = null;
  cities = [];
  cityObjects = new Map();
  currentLOD = 'far';
  camera = null;
  dataLoaded = false;

  lodLevels = {
    far: { distance: 5, minPopulation: 10000000, maxCities: 20, label: 'Мегаполисы' },
    medium: { distance: 3.5, minPopulation: 5000000, maxCities: 40, label: 'Крупные города' },
    close: { distance: 2.2, minPopulation: 1000000, maxCities: 100, label: 'Большие города' },
    veryClose: { distance: 1.2, minPopulation: 500000, maxCities: 200, label: 'Средние города' },
    detailed: { distance: 0.6, minPopulation: 100000, maxCities: 500, label: 'Все города' }
  };

  config = {
    markerSize: 0.008,
    colors: {
      mega: 0xff4444,
      large: 0xff8844,
      medium: 0xffcc44,
      small: 0x44ccff,
      tiny: 0x88ddff
    }
  };

  async loadData(data) {
    this.cities = data;
    this.dataLoaded = true;
    logger.info(`Loaded ${this.cities.length} cities`);
  }

  async updateData(data) {
    this.cities = data;
    if (this.camera && this.group) {
      this.updateLOD(this.camera.position);
    }
  }

  async render(scene, options = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.camera = options.camera || null;

    if (this.camera) {
      this.updateLOD(this.camera.position);
    } else {
      this.updateCitiesForLOD('far');
    }

    scene.add(this.group);
    logger.info('City layer rendered');
  }

  updateLOD(cameraPosition) {
    if (!cameraPosition || !this.cities || this.cities.length === 0) return;
    
    const distance = cameraPosition.length();
    
    let currentLevel = 'far';
    for (const [level, config] of Object.entries(this.lodLevels)) {
      if (distance <= config.distance) {
        currentLevel = level;
      }
    }
    
    if (this.currentLOD !== currentLevel) {
      this.currentLOD = currentLevel;
      this.updateCitiesForLOD(currentLevel);
      logger.debug(`LOD: ${currentLevel} (${this.lodLevels[currentLevel].label}), distance: ${distance.toFixed(2)}`);
    }
  }

  updateCitiesForLOD(level) {
    const config = this.lodLevels[level];
    if (!config || !this.cities) return;
    
    const citiesToShow = this.cities
      .filter(city => (city.population || 0) >= config.minPopulation)
      .sort((a, b) => (b.population || 0) - (a.population || 0))
      .slice(0, config.maxCities);
    
    this.clearMarkers();
    for (const city of citiesToShow) {
      this.createCityMarker(city);
    }
    
    logger.debug(`LOD ${level}: ${citiesToShow.length} cities (min pop: ${config.minPopulation})`);
  }

  clearMarkers() {
    if (!this.group) return;
    
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
      this.group.remove(child);
    }
    this.cityObjects.clear();
  }

  createCityMarker(city) {
    const { lat, lon, name, population } = city;
    
    // ИСПРАВЛЕНО: правильное преобразование координат
    const position = this.latLonToPosition(lat, lon, 1.02);
    const color = this.getColorByPopulation(population);
    const size = this.getMarkerSize(population);

    const markerGroup = new THREE.Group();
    markerGroup.position.copy(position);
    markerGroup.userData = {
      type: 'city',
      cityId: city.id,
      city: city
    };

    const sphereGeom = new THREE.SphereGeometry(size, 8, 8);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9
    });
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    markerGroup.add(sphere);

    if (population >= 5000000) {
      const glowGeom = new THREE.SphereGeometry(size * 2, 8, 8);
      const glowMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.1
      });
      const glow = new THREE.Mesh(glowGeom, glowMat);
      markerGroup.add(glow);
    }

    this.group.add(markerGroup);
  }

  /**
   * ИСПРАВЛЕНО: правильное преобразование координат
   * В Three.js сцена: Y — вверх, X — вправо, Z — вперед
   * 
   * Для глобуса с центром в (0,0,0):
   * - Широта (lat): -90° (Юг) -> +90° (Север)
   * - Долгота (lon): -180° (Запад) -> +180° (Восток)
   * 
   * Правильная формула:
   * x = radius * cos(lat) * sin(lon)
   * y = radius * sin(lat)
   * z = radius * cos(lat) * cos(lon)
   */
  latLonToPosition(lat, lon, radius) {
    const latRad = lat * Math.PI / 180;
    const lonRad = lon * Math.PI / 180;
    
    return new THREE.Vector3(
      radius * Math.cos(latRad) * Math.sin(lonRad),  // X — восток-запад
      radius * Math.sin(latRad),                      // Y — север-юг
      radius * Math.cos(latRad) * Math.cos(lonRad)   // Z — продолжение
    );
  }

  getColorByPopulation(population) {
    if (population >= 10000000) return this.config.colors.mega;
    if (population >= 5000000) return this.config.colors.large;
    if (population >= 1000000) return this.config.colors.medium;
    if (population >= 500000) return this.config.colors.small;
    return this.config.colors.tiny;
  }

  getMarkerSize(population) {
    const base = this.config.markerSize;
    if (population >= 10000000) return base * 2.0;
    if (population >= 5000000) return base * 1.5;
    if (population >= 1000000) return base * 1.2;
    if (population >= 500000) return base * 1.0;
    return base;
  }

  update(deltaTime) {
    if (!this.visible || !this.group) return;

    const time = Date.now() / 1000;
    
    this.group.children.forEach(markerGroup => {
      if (markerGroup.userData?.animation) {
        const anim = markerGroup.userData.animation;
        const pulse = Math.sin(time * anim.speed + anim.phase) * 0.3 + 0.7;
        
        markerGroup.children.forEach(child => {
          if (child instanceof THREE.Mesh && child.material?.transparent) {
            if (child.geometry.parameters?.radius > this.config.markerSize * 1.5) {
              child.material.opacity = 0.1 * pulse;
            }
          }
        });
      }
    });

    if (this.camera) {
      this.updateLOD(this.camera.position);
    }
  }

  getCityFromObject(object) {
    let current = object;
    while (current) {
      if (current.userData?.type === 'city' && current.userData?.city) {
        return current.userData.city;
      }
      current = current.parent;
    }
    return null;
  }

  getInteractiveObjects() {
    const objects = [];
    if (!this.group) return objects;
    
    this.group.children.forEach(markerGroup => {
      markerGroup.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          objects.push(child);
        }
      });
    });
    return objects;
  }

  filter(predicate) {
    return this.cities.filter(predicate);
  }

  clear() {
    this.clearMarkers();
    this.cities = [];
    this.dataLoaded = false;
    logger.info('City layer cleared');
  }

  remove() {
    if (this.group && this.group.parent) {
      this.group.removeFromParent();
    }
  }

  isDataLoaded() {
    return this.dataLoaded || false;
  }
}