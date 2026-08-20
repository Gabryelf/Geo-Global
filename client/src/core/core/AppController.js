import * as THREE from 'three';
import { EventBus } from './EventBus';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AppController');

export const AppState = {
  INITIALIZING: 'initializing',
  INITIALIZED: 'initialized',
  RUNNING: 'running',
  PAUSED: 'paused',
  ERROR: 'error',
  DISPOSED: 'disposed'
};

export class AppController {
  activeContext = null;
  contexts = new Map();
  eventBus = null;
  globeInstance = null;
  layerManager = null;
  state = AppState.INITIALIZING;
  isFirstContextSwitch = true;

  constructor() {
    this.eventBus = new EventBus();
    this.setupEventHandlers();
  }

  get globe() {
    return this.globeInstance;
  }

  async initialize(container, config) {
    this.state = AppState.INITIALIZING;

    try {
      logger.info('Initializing application...');

      this.globeInstance = config.globeCreator(container, config.globeConfig);
      this.layerManager = config.layerManagerCreator(this.globeInstance.scene);

      for (const context of config.contexts) {
        this.contexts.set(context.id, context);
        await context.initialize();
        logger.info(`Context registered: ${context.id}`);
      }

      if (this.contexts.size > 0) {
        const firstContext = this.contexts.values().next().value;
        await this.switchContext(firstContext.id);
      }

      this.state = AppState.INITIALIZED;
      this.eventBus.emit('system:ready', {
        timestamp: Date.now(),
        contextCount: this.contexts.size
      });

      logger.info('Application initialized successfully');
    } catch (error) {
      this.state = AppState.ERROR;
      logger.error('Failed to initialize application', error);
      this.eventBus.emit('system:error', {
        module: 'AppController',
        error: error,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  async switchContext(contextId) {
    const newContext = this.contexts.get(contextId);
    if (!newContext) {
      throw new Error(`Context ${contextId} not found`);
    }

    const oldContextId = this.activeContext?.id || null;
    logger.info(`Switching context from ${oldContextId} to ${contextId}`);

    if (this.activeContext) {
      await this.activeContext.deactivate();
    }

    this.activeContext = newContext;
    await newContext.activate();

    if (this.layerManager) {
      this.layerManager.clear();

      const layers = newContext.getLayers();
      logger.info(`Adding ${layers.length} layers from context ${contextId}`);

      for (const layer of layers) {
        try {
          // Передаем камеру в слой для LOD
          if (this.globeInstance?.camera) {
            await this.layerManager.addLayer(layer, { camera: this.globeInstance.camera });
          } else {
            await this.layerManager.addLayer(layer);
          }
          logger.info(`Layer added: ${layer.id}`);
        } catch (error) {
          logger.warn(`Error adding layer ${layer.id}:`, error);
        }
      }
    }

    this.eventBus.emit('context:change', {
      from: oldContextId || 'none',
      to: contextId,
      timestamp: Date.now()
    });

    logger.info(`Context switched to: ${contextId}`);
  }

  getActiveContext() {
    return this.activeContext;
  }

  getContexts() {
    return Array.from(this.contexts.values());
  }

  getContext(contextId) {
    return this.contexts.get(contextId);
  }

  update(deltaTime) {
    if (this.globeInstance) {
      this.globeInstance.update(deltaTime);
      
      // Передаем позицию камеры в слои для LOD
      if (this.layerManager && this.globeInstance.camera) {
        const cameraPos = this.globeInstance.camera.position.clone();
        for (const layer of this.layerManager.layers.values()) {
          if (layer.updateLOD) {
            layer.updateLOD(cameraPos);
          }
        }
      }
    }
    if (this.layerManager) {
      this.layerManager.update(deltaTime);
    }
  }

  handleMouseEvent(event) {
    if (!this.globeInstance || !this.activeContext) {
      return;
    }

    const target = event.target;
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const position = this.globeInstance.getSurfaceCoordinates(x, y);
    if (!position) {
      return;
    }

    const objects = this.layerManager?.getAllInteractiveObjects() || [];
    let hitObject = null;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(x, y);

    const camera = this.globeInstance.camera;
    if (!camera) {
      return;
    }

    raycaster.setFromCamera(mouse, camera);

    if (objects.length > 0) {
      const intersects = raycaster.intersectObjects(objects, false);
      if (intersects.length > 0) {
        hitObject = intersects[0].object;
      }
    }

    if (event.type === 'click') {
      if (hitObject) {
        this.activeContext.handleClick(hitObject, position);
      }
    } else if (event.type === 'mousemove') {
      this.activeContext.handleHover(hitObject, position);
    }
  }

  setupEventHandlers() {
    this.eventBus.on('system:error', (data) => {
      logger.error(`[${data.module}] Error:`, data.error);
    });

    this.eventBus.on('context:change', (data) => {
      logger.info(`Context changed: ${data.from} -> ${data.to}`);
    });
  }

  dispose() {
    if (this.activeContext) {
      this.activeContext.deactivate();
    }

    for (const context of this.contexts.values()) {
      context.dispose();
    }
    this.contexts.clear();

    if (this.layerManager) {
      this.layerManager.clear();
    }

    if (this.globeInstance) {
      this.globeInstance.dispose();
    }

    this.eventBus.clear();
    this.state = AppState.DISPOSED;
    logger.info('Application disposed');
  }

  getEventBus() {
    return this.eventBus;
  }
}