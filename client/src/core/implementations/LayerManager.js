import { BaseLayerManager } from '../abstract/BaseLayerManager';

export class LayerManager extends BaseLayerManager {
  constructor(scene) {
    super(scene);
  }

  async addLayer(layer, options = {}) {
    if (this.layers.has(layer.id)) {
      throw new Error(`Layer ${layer.id} already exists`);
    }

    this.layers.set(layer.id, layer);

    if (!this.layersByType.has(layer.type)) {
      this.layersByType.set(layer.type, []);
    }
    this.layersByType.get(layer.type).push(layer);

    const position = options.position;
    if (position !== undefined) {
      this.renderOrder.splice(position, 0, layer.id);
    } else {
      this.renderOrder.push(layer.id);
    }

    // Передаем опции в render
    await layer.render(this.scene, options);
  }

  async removeLayer(layerId) {
    const layer = this.layers.get(layerId);
    if (!layer) {
      return;
    }

    layer.remove();
    this.layers.delete(layerId);

    const typeLayers = this.layersByType.get(layer.type);
    if (typeLayers) {
      const index = typeLayers.indexOf(layer);
      if (index > -1) {
        typeLayers.splice(index, 1);
      }
    }

    const orderIndex = this.renderOrder.indexOf(layerId);
    if (orderIndex > -1) {
      this.renderOrder.splice(orderIndex, 1);
    }
  }

  update(deltaTime) {
    for (const layer of this.layers.values()) {
      if (layer.visible && layer.update) {
        layer.update(deltaTime);
      }
    }
  }

  clear() {
    for (const layer of this.layers.values()) {
      try {
        layer.clear();
        layer.remove();
      } catch (error) {
        console.warn(`Error clearing layer ${layer.id}:`, error);
      }
    }
    this.layers.clear();
    this.layersByType.clear();
    this.renderOrder = [];
  }
}