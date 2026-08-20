/**
 * Абстрактный базовый класс для управления слоями
 */
 export class BaseLayerManager {
  layers = new Map();
  layersByType = new Map();
  renderOrder = [];
  scene = null;

  constructor(scene) {
    this.scene = scene;
  }

  async addLayer(layer, options = {}) {
    throw new Error('Method addLayer() must be implemented');
  }

  async removeLayer(layerId) {
    throw new Error('Method removeLayer() must be implemented');
  }

  getLayer(layerId) {
    return this.layers.get(layerId);
  }

  getLayersByType(type) {
    return this.layersByType.get(type) || [];
  }

  update(deltaTime) {
    throw new Error('Method update() must be implemented');
  }

  clear() {
    throw new Error('Method clear() must be implemented');
  }

  setLayerVisibility(layerId, visible) {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.visible = visible;
    }
  }

  setLayerOpacity(layerId, opacity) {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.opacity = Math.max(0, Math.min(1, opacity));
    }
  }

  getAllInteractiveObjects() {
    const objects = [];
    for (const layer of this.layers.values()) {
      if (layer.visible && layer.getInteractiveObjects) {
        objects.push(...layer.getInteractiveObjects());
      }
    }
    return objects;
  }

  hasLayer(layerId) {
    return this.layers.has(layerId);
  }

  getLayerCount() {
    return this.layers.size;
  }
}