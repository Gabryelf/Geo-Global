/**
 * Абстрактный базовый класс для управления слоями
 */
export class BaseLayerManager {
  /** @type {Map<string, ILayer>} */
  layers = new Map();
  /** @type {Map<string, ILayer[]>} */
  layersByType = new Map();
  /** @type {string[]} */
  renderOrder = [];
  /** @type {THREE.Scene} */
  scene = null;

  /**
   * Конструктор менеджера слоев
   * @param {THREE.Scene} scene - Сцена Three.js
   */
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Добавление слоя
   * @param {ILayer} layer - Слой для добавления
   * @param {number} position - Позиция в порядке отрисовки (опционально)
   * @returns {Promise<void>}
   */
  async addLayer(layer, position) {
    throw new Error('Method addLayer() must be implemented');
  }

  /**
   * Удаление слоя
   * @param {string} layerId - ID слоя
   * @returns {Promise<void>}
   */
  async removeLayer(layerId) {
    throw new Error('Method removeLayer() must be implemented');
  }

  /**
   * Получение слоя по ID
   * @param {string} layerId - ID слоя
   * @returns {ILayer|undefined}
   */
  getLayer(layerId) {
    return this.layers.get(layerId);
  }

  /**
   * Получение всех слоев определенного типа
   * @param {string} type - Тип слоя
   * @returns {ILayer[]}
   */
  getLayersByType(type) {
    return this.layersByType.get(type) || [];
  }

  /**
   * Обновление всех слоев
   * @param {number} deltaTime - Время с последнего обновления
   */
  update(deltaTime) {
    throw new Error('Method update() must be implemented');
  }

  /**
   * Очистка всех слоев
   */
  clear() {
    throw new Error('Method clear() must be implemented');
  }

  /**
   * Изменение видимости слоя
   * @param {string} layerId - ID слоя
   * @param {boolean} visible - Видимость
   */
  setLayerVisibility(layerId, visible) {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.visible = visible;
    }
  }

  /**
   * Изменение прозрачности слоя
   * @param {string} layerId - ID слоя
   * @param {number} opacity - Прозрачность (0-1)
   */
  setLayerOpacity(layerId, opacity) {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.opacity = Math.max(0, Math.min(1, opacity));
    }
  }

  /**
   * Получение всех интерактивных объектов со всех слоев
   * @returns {THREE.Object3D[]}
   */
  getAllInteractiveObjects() {
    const objects = [];
    for (const layer of this.layers.values()) {
      if (layer.visible) {
        objects.push(...layer.getInteractiveObjects());
      }
    }
    return objects;
  }

  /**
   * Проверка наличия слоя
   * @param {string} layerId - ID слоя
   * @returns {boolean}
   */
  hasLayer(layerId) {
    return this.layers.has(layerId);
  }

  /**
   * Получение количества слоев
   * @returns {number}
   */
  getLayerCount() {
    return this.layers.size;
  }
}