import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Абстрактный базовый класс для управления земным шаром
 */
export class BaseGlobe {
  /** @type {THREE.Scene} */
  _scene = null;
  /** @type {THREE.PerspectiveCamera} */
  camera = null;
  /** @type {THREE.WebGLRenderer} */
  renderer = null;
  /** @type {OrbitControls} */
  controls = null;
  /** @type {THREE.Group} */
  globeGroup = null;
  /** @type {THREE.Mesh} */
  globeMesh = null;
  /** @type {THREE.Mesh} */
  atmosphere = null;
  /** @type {number} */
  zoomLevel = 0;
  /** @type {number} */
  MIN_ZOOM = 0;
  /** @type {number} */
  MAX_ZOOM = 100;
  /** @type {Object} */
  config = null;
  /** @type {HTMLElement} */
  container = null;

  /**
   * Конструктор базового глобуса
   * @param {HTMLElement} container - DOM элемент для рендеринга
   * @param {Object} config - Конфигурация глобуса
   */
  constructor(container, config) {
    this.container = container;
    this.config = config;
    this.initScene(container, config);
  }

  /**
   * Инициализация сцены
   * @param {HTMLElement} container - DOM элемент
   * @param {Object} config - Конфигурация
   */
  initScene(container, config) {
    throw new Error('Method initScene() must be implemented');
  }

  /**
   * Создание сферы глобуса
   * @param {Object} config - Конфигурация
   */
  createGlobe(config) {
    throw new Error('Method createGlobe() must be implemented');
  }

  /**
   * Создание атмосферы
   */
  createAtmosphere() {
    throw new Error('Method createAtmosphere() must be implemented');
  }

  /**
   * Создание звездного фона
   */
  createStarField() {
    throw new Error('Method createStarField() must be implemented');
  }

  /**
   * Обновление состояния глобуса
   * @param {number} deltaTime - Время с последнего обновления
   */
  update(deltaTime) {
    throw new Error('Method update() must be implemented');
  }

  /**
   * Изменение уровня зума
   * @param {number} level - Новый уровень зума
   */
  setZoomLevel(level) {
    throw new Error('Method setZoomLevel() must be implemented');
  }

  /**
   * Получение текущего уровня зума
   * @returns {number}
   */
  getZoomLevel() {
    return this.zoomLevel;
  }

  /**
   * Получение координат на поверхности глобуса по позиции мыши
   * @param {number} mouseX - X координата мыши (нормализованная)
   * @param {number} mouseY - Y координата мыши (нормализованная)
   * @returns {THREE.Vector3|null}
   */
  getSurfaceCoordinates(mouseX, mouseY) {
    throw new Error('Method getSurfaceCoordinates() must be implemented');
  }

  /**
   * Преобразование географических координат в 3D позицию
   * @param {number} lat - Широта
   * @param {number} lon - Долгота
   * @param {number} radius - Радиус сферы
   * @returns {THREE.Vector3}
   */
  latLonToPosition(lat, lon, radius) {
    throw new Error('Method latLonToPosition() must be implemented');
  }

  /**
   * Получение текущего состояния камеры
   * @returns {Object}
   */
  getCameraState() {
    return {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      zoom: this.zoomLevel
    };
  }

  /**
   * Очистка ресурсов глобуса
   */
  dispose() {
    this.renderer.dispose();
    this.controls.dispose();
    this._scene.clear();
  }

  /**
   * Изменение размера окна
   * @param {number} width - Новая ширина
   * @param {number} height - Новая высота
   */
  resize(width, height) {
    if (this.camera && this.renderer) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  /**
   * Получение сцены
   * @returns {THREE.Scene}
   */
  get scene() {
    return this._scene;
  }
}