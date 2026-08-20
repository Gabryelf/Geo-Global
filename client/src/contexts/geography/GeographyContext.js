import * as THREE from 'three';
import { ContextState } from '../../core/interfaces/IContext';
import { createLogger } from '../../utils/logger';
import { CityDataLoader } from './dataLoaders/CityDataLoader';
import { CityLayer } from './layers/CityLayer';

const logger = createLogger('GeographyContext');

export class GeographyContext {
  id = 'geography';
  name = 'Географический атлас';
  description = 'Изучение географических объектов и городов мира';
  version = '1.0.0';
  state = ContextState.UNINITIALIZED;

  layers = [];
  dataLoaders = new Map();
  cityLayer = null;
  cityLoader = null;

  async initialize(config) {
    this.state = ContextState.INITIALIZING;
    logger.info('Initializing Geography Context...');

    try {
      this.cityLoader = new CityDataLoader();
      this.dataLoaders.set('cities', this.cityLoader);

      this.cityLayer = new CityLayer();
      this.layers.push(this.cityLayer);

      // Показываем статус загрузки
      this.showStatus('🌍 Загрузка городов из API...');

      const cities = await this.cityLoader.load();
      
      if (cities && cities.length > 0) {
        await this.cityLayer.loadData(cities);
        this.state = ContextState.INITIALIZED;
        logger.info(`✅ Geography Context initialized with ${cities.length} cities from API`);
        this.showStatus(`✅ Загружено ${cities.length} городов`);
        setTimeout(() => this.hideStatus(), 2000);
      } else {
        throw new Error('No cities loaded from API');
      }
    } catch (error) {
      this.state = ContextState.ERROR;
      logger.error('Failed to initialize Geography Context', error);
      this.showStatus('❌ Ошибка загрузки данных');
      throw error;
    }
  }

  showStatus(message) {
    const panel = document.getElementById('info-panel');
    if (panel) {
      const title = panel.querySelector('.title');
      const subtitle = panel.querySelector('.subtitle');
      if (title) title.textContent = message;
      if (subtitle) subtitle.textContent = 'Подождите, идет загрузка...';
      panel.classList.add('visible');
    }
  }

  //метод для показа статуса кеша
  showCacheStatus(cities) {
    const panel = document.getElementById('info-panel');
    if (panel) {
      const title = panel.querySelector('.title');
      const subtitle = panel.querySelector('.subtitle');
      if (title) title.textContent = `🌍 Загружено ${cities.length} городов`;
      if (subtitle) subtitle.textContent = 'Данные из кеша (быстрая загрузка)';
      panel.classList.add('visible');
      setTimeout(() => this.hideStatus(), 2000);
    }
  }

  hideStatus() {
    const panel = document.getElementById('info-panel');
    if (panel) {
      panel.classList.remove('visible');
    }
  }

  async activate() {
    if (this.state === ContextState.UNINITIALIZED) {
      throw new Error('Context not initialized');
    }

    this.state = ContextState.ACTIVATING;
    logger.info('Activating Geography Context...');

    try {
      this.state = ContextState.ACTIVE;
      logger.info('Geography Context activated');
    } catch (error) {
      this.state = ContextState.ERROR;
      logger.error('Failed to activate Geography Context', error);
      throw error;
    }
  }

  async deactivate() {
    if (this.state !== ContextState.ACTIVE) {
      return;
    }

    this.state = ContextState.DEACTIVATING;
    logger.info('Deactivating Geography Context...');

    try {
      for (const layer of this.layers) {
        try {
          layer.clear();
          layer.remove();
        } catch (error) {
          logger.warn(`Error clearing layer ${layer.id}:`, error);
        }
      }
      this.state = ContextState.INITIALIZED;
      logger.info('Geography Context deactivated');
    } catch (error) {
      this.state = ContextState.ERROR;
      logger.error('Failed to deactivate Geography Context', error);
      throw error;
    }
  }

  async update(filters) {
    if (this.state !== ContextState.ACTIVE) {
      return;
    }
    logger.debug('Updating Geography Context with filters:', filters);
    
    if (filters && this.cityLoader) {
      const cities = await this.cityLoader.load(filters);
      if (this.cityLayer) {
        await this.cityLayer.updateData(cities);
      }
    }
  }

  async getData(query) {
    if (this.cityLoader) {
      return this.cityLoader.load(query);
    }
    return [];
  }

  getLayers() {
    return this.layers;
  }

  handleClick(object, position) {
    const city = this.cityLayer?.getCityFromObject(object);
    
    if (city) {
      const name = city.nameRu || city.name || 'Неизвестный город';
      const country = city.country || '';
      const population = city.population ? this.formatPopulation(city.population) : '—';
      
      logger.info(`Clicked on city: ${name} (${country})`, city);

      const panel = document.getElementById('info-panel');
      if (panel) {
        const title = panel.querySelector('.title');
        const subtitle = panel.querySelector('.subtitle');
        
        if (title) {
          title.textContent = `🏙️ ${name}${country ? `, ${country}` : ''}`;
        }
        if (subtitle) {
          const popText = population !== '—' ? `Население: ${population}` : '';
          const coordText = `📍 ${city.lat.toFixed(4)}, ${city.lon.toFixed(4)}`;
          subtitle.textContent = popText ? `${popText} | ${coordText}` : coordText;
        }
        
        panel.classList.add('visible');
        
        clearTimeout(panel._timeout);
        panel._timeout = setTimeout(() => {
          panel.classList.remove('visible');
        }, 5000);
      }
    }
  }

  handleHover(object, position) {
    const isCity = object && this.cityLayer?.getCityFromObject(object);
    document.body.style.cursor = isCity ? 'pointer' : 'default';

    if (isCity) {
      const city = this.cityLayer.getCityFromObject(object);
      if (city) {
        const panel = document.getElementById('info-panel');
        if (panel) {
          const title = panel.querySelector('.title');
          const subtitle = panel.querySelector('.subtitle');
          const name = city.nameRu || city.name;
          if (title) title.textContent = `🏙️ ${name}`;
          if (subtitle) subtitle.textContent = 'Нажмите для подробной информации';
          panel.classList.add('visible');
        }
      }
    }
  }

  formatPopulation(pop) {
    if (pop >= 1000000000) return `${(pop / 1000000000).toFixed(1)} млрд`;
    if (pop >= 1000000) return `${(pop / 1000000).toFixed(1)} млн`;
    if (pop >= 1000) return `${(pop / 1000).toFixed(1)} тыс`;
    return pop.toString();
  }

  dispose() {
    for (const layer of this.layers) {
      try {
        layer.clear();
        layer.remove();
      } catch (error) {
        logger.warn(`Error disposing layer ${layer.id}:`, error);
      }
    }
    this.layers = [];
    this.dataLoaders.clear();
    this.cityLayer = null;
    this.cityLoader = null;
    this.state = ContextState.UNINITIALIZED;
    logger.info('Geography Context disposed');
  }
}