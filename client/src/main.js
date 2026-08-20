import * as THREE from 'three';
import { AppController } from './core/core/AppController';
import { createLogger } from './utils/logger';
import { GeographyContext } from './contexts/geography/GeographyContext';
import { Globe } from './core/implementations/Globe';
import { LayerManager } from './core/implementations/LayerManager';
import { SceneConfig, ScenePresets } from './configs/scene_config';

const logger = createLogger('Main');

(async function main() {
  try {
    logger.info('Starting application...');
    
    const container = document.getElementById('globe-container');
    if (!container) {
      throw new Error('Container element not found');
    }
    
    logger.info('Container found:', container);
    
    // Используем конфиг из scene_config.js
    const globeConfig = {
      radius: SceneConfig.globe.radius,
      segments: SceneConfig.globe.segments,
      textureUrl: SceneConfig.globe.textures.earth,
      cloudTextureUrl: SceneConfig.globe.textures.clouds,
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
      // Передаем полный конфиг для дополнительных настроек
      material: SceneConfig.globe.material,
      clouds: SceneConfig.globe.clouds,
      atmosphere: SceneConfig.globe.atmosphere,
      lighting: SceneConfig.lighting,
      stars: SceneConfig.stars,
      performance: SceneConfig.performance,
      textures: SceneConfig.globe.textures,
    };
    
    const app = new AppController();
    
    const config = {
      globeConfig,
      globeCreator: (container, config) => {
        logger.info('Creating globe...');
        return new Globe(container, config);
      },
      layerManagerCreator: (scene) => {
        logger.info('Creating layer manager...');
        return new LayerManager(scene);
      },
      contexts: [
        new GeographyContext(),
      ]
    };
    
    await app.initialize(container, config);
    logger.info('App initialized');
    
    // Сохраняем ссылку на глобус для управления
    window.__globe = app.globe;
    
    // Добавляем горячие клавиши для смены режимов (для тестирования)
    document.addEventListener('keydown', (e) => {
      if (e.key === '1') {
        app.globe?.setPreset('day');
        logger.info('Switched to Day mode');
      } else if (e.key === '2') {
        app.globe?.setPreset('night');
        logger.info('Switched to Night mode');
      } else if (e.key === '3') {
        app.globe?.setPreset('scientific');
        logger.info('Switched to Scientific mode');
      }
    });
    
    const loading = document.getElementById('loading');
    if (loading) {
      loading.classList.add('hidden');
      setTimeout(() => {
        loading.style.display = 'none';
      }, 800);
    }
    
    const buttons = document.querySelectorAll('.context-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const contextId = btn.getAttribute('data-context');
        if (!contextId) return;
        
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        try {
          await app.switchContext(contextId);
          logger.info(`Switched to context: ${contextId}`);
        } catch (error) {
          logger.error(`Failed to switch to ${contextId}`, error);
        }
      });
    });
    
    let lastTime = 0;
    let frameCount = 0;
    
    function render(time) {
      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;
      app.update(deltaTime);
      
      frameCount++;
      if (frameCount % 60 === 0) {
        logger.debug(`Rendering frame ${frameCount}`);
      }
      
      requestAnimationFrame(render);
    }
    
    container.addEventListener('click', (event) => {
      app.handleMouseEvent(event);
    });
    
    container.addEventListener('mousemove', (event) => {
      app.handleMouseEvent(event);
    });
    
    window.addEventListener('resize', () => {
      const rect = container.getBoundingClientRect();
      const globe = app.globe;
      if (globe) {
        globe.resize(rect.width, rect.height);
      }
    });
    
    logger.info('Application is ready!');
    logger.info('Press 1=Day, 2=Night, 3=Scientific mode');
    render(0);
    
    setTimeout(() => {
      const canvas = container.querySelector('canvas');
      if (canvas) {
        logger.info('Canvas found, rendering should work');
        logger.info('Canvas size:', canvas.width, 'x', canvas.height);
      } else {
        logger.warn('Canvas not found in container');
      }
    }, 1000);
    
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    const errorMsg = document.getElementById('error-message');
    if (errorMsg) {
      errorMsg.textContent = `❌ Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`;
      errorMsg.style.display = 'block';
    }
    const loading = document.getElementById('loading');
    if (loading) {
      loading.classList.add('hidden');
    }
  }
})();