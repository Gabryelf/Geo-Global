import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Абстрактный базовый класс для управления земным шаром
 */
export class BaseGlobe {
  _scene = null;
  camera = null;
  renderer = null;
  controls = null;
  globeGroup = null;
  globeMesh = null;
  atmosphere = null;
  zoomLevel = 0;
  MIN_ZOOM = 0;
  MAX_ZOOM = 100;
  config = null;
  container = null;

  constructor(container, config) {
    this.container = container;
    this.config = config;
    this.initScene(container, config);
  }

  initScene(container, config) {
    throw new Error('Method initScene() must be implemented');
  }

  createGlobe(config) {
    throw new Error('Method createGlobe() must be implemented');
  }

  createAtmosphere() {
    throw new Error('Method createAtmosphere() must be implemented');
  }

  createStarField() {
    throw new Error('Method createStarField() must be implemented');
  }

  update(deltaTime) {
    throw new Error('Method update() must be implemented');
  }

  setZoomLevel(level) {
    throw new Error('Method setZoomLevel() must be implemented');
  }

  getZoomLevel() {
    return this.zoomLevel;
  }

  getSurfaceCoordinates(mouseX, mouseY) {
    throw new Error('Method getSurfaceCoordinates() must be implemented');
  }

  latLonToPosition(lat, lon, radius) {
    throw new Error('Method latLonToPosition() must be implemented');
  }

  getCameraState() {
    return {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      zoom: this.zoomLevel
    };
  }

  dispose() {
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.controls) {
      this.controls.dispose();
    }
    if (this._scene) {
      this._scene.clear();
    }
  }

  resize(width, height) {
    if (this.camera && this.renderer) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  get scene() {
    return this._scene;
  }
}