// client/src/contexts/geography/GeographyContext.js
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
    isActive = false;
    cachedData = null;

    async initialize(config) {
        this.state = ContextState.INITIALIZING;
        logger.info('Initializing Geography Context...');

        try {
            // Создаем загрузчик
            this.cityLoader = new CityDataLoader();
            this.dataLoaders.set('cities', this.cityLoader);

            // Создаем слой
            this.cityLayer = new CityLayer();
            this.cityLayer.setDataLoader(this.cityLoader);
            this.layers.push(this.cityLayer);

            // Показываем статус
            this.showStatus('🌍 Загрузка данных о городах...');

            // ПРИНУДИТЕЛЬНО загружаем данные с сервера
            // Используем load() который сам проверит кеш и сервер
            const cities = await this.cityLoader.load({
                limit: 5000,
                minPopulation: 0
            });

            logger.info(`Loaded ${cities.length} cities from loader`);

            if (cities && cities.length > 0) {
                this.cachedData = cities;
                await this.cityLayer.loadData(cities);
                this.state = ContextState.INITIALIZED;
                logger.info(`✅ Geography Context initialized with ${cities.length} cities`);
                this.showStatus(`✅ Загружено ${cities.length} городов`);
                setTimeout(() => this.hideStatus(), 3000);
            } else {
                // Если данных нет - пробуем еще раз с принудительным обновлением
                logger.warn('No cities loaded, trying force refresh...');
                const refreshed = await this.cityLoader.refreshCache();
                if (refreshed && refreshed.length > 0) {
                    this.cachedData = refreshed;
                    await this.cityLayer.loadData(refreshed);
                    this.state = ContextState.INITIALIZED;
                    logger.info(`✅ Geography Context initialized with ${refreshed.length} cities (after refresh)`);
                    this.showStatus(`✅ Загружено ${refreshed.length} городов`);
                    setTimeout(() => this.hideStatus(), 3000);
                } else {
                    throw new Error('No cities loaded from server');
                }
            }
        } catch (error) {
            this.state = ContextState.ERROR;
            logger.error('Failed to initialize Geography Context:', error);
            this.showStatus('❌ Ошибка загрузки данных: ' + error.message);
            throw error;
        }
    }

    showStatus(message) {
        const panel = document.getElementById('info-panel');
        if (panel) {
            const title = panel.querySelector('.title');
            const subtitle = panel.querySelector('.subtitle');
            if (title) title.textContent = message;
            if (subtitle) subtitle.textContent = 'Подождите...';
            panel.classList.add('visible');
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
            if (this.cityLayer) {
                // Если данных нет - загружаем
                if (!this.cityLayer.isDataLoaded() || this.cityLayer.allCities.length === 0) {
                    logger.info('No data in layer, loading from server...');
                    const cities = await this.cityLoader.load({
                        limit: 5000,
                        minPopulation: 0
                    });
                    if (cities && cities.length > 0) {
                        this.cachedData = cities;
                        await this.cityLayer.loadData(cities);
                    }
                }
                this.cityLayer.activate();
            }

            this.isActive = true;
            this.state = ContextState.ACTIVE;
            logger.info('Geography Context activated');
            
            const count = this.cityLayer?.filteredCities?.length || this.cityLayer?.allCities?.length || 0;
            this.showStatus(`🌍 ${count} городов на карте`);
            setTimeout(() => this.hideStatus(), 2000);

        } catch (error) {
            this.state = ContextState.ERROR;
            logger.error('Failed to activate Geography Context:', error);
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
            if (this.cityLayer) {
                this.cityLayer.deactivate();
            }
            this.isActive = false;
            this.state = ContextState.INITIALIZED;
            logger.info('Geography Context deactivated');
        } catch (error) {
            this.state = ContextState.ERROR;
            logger.error('Failed to deactivate Geography Context:', error);
            throw error;
        }
    }

    async update(filters) {
        if (this.state !== ContextState.ACTIVE) {
            return;
        }

        logger.debug('Updating Geography Context with filters:', filters);

        if (filters && this.cityLayer) {
            for (const [key, value] of Object.entries(filters)) {
                this.cityLayer.setFilter(key, value);
            }
        }
    }

    toggleLens(lensId) {
        if (this.cityLayer) {
            this.cityLayer.toggleLens(lensId);
        }
    }

    getLenses() {
        return this.cityLayer?.getLenses() || [];
    }

    getActiveLenses() {
        return this.cityLayer?.getActiveLenses() || [];
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
        if (!this.isActive) return;
        
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
                    const capitalMark = city.isCapital ? '👑 ' : '🏙️ ';
                    const popMark = (city.population || 0) >= 10000000 ? '🌟 ' : '';
                    title.textContent = `${capitalMark}${popMark}${name}${country ? `, ${country}` : ''}`;
                }
                
                if (subtitle) {
                    const popText = population !== '—' ? `👥 ${population}` : '';
                    const coordText = `📍 ${city.lat.toFixed(4)}, ${city.lon.toFixed(4)}`;
                    const areaText = city.area ? `📐 ${Math.round(city.area)} км²` : '';
                    const densityText = city.density ? `📊 ${Math.round(city.density)} чел/км²` : '';
                    const parts = [popText, areaText, densityText, coordText].filter(Boolean);
                    subtitle.textContent = parts.join(' | ');
                }
                
                panel.classList.add('visible');
                clearTimeout(panel._timeout);
                panel._timeout = setTimeout(() => {
                    panel.classList.remove('visible');
                }, 8000);
            }
        }
    }

    handleHover(object, position) {
        if (!this.isActive) {
            document.body.style.cursor = 'default';
            return;
        }

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
                    
                    if (title) {
                        const icon = city.isCapital ? '👑' : '🏙️';
                        title.textContent = `${icon} ${name}`;
                    }
                    if (subtitle) {
                        const pop = this.formatPopulation(city.population);
                        subtitle.textContent = `👥 ${pop} | ${city.country}`;
                    }
                    panel.classList.add('visible');
                }
            }
        }
    }

    formatPopulation(pop) {
        if (!pop) return '—';
        if (pop >= 1000000000) return `${(pop / 1000000000).toFixed(1)} млрд`;
        if (pop >= 1000000) return `${(pop / 1000000).toFixed(1)} млн`;
        if (pop >= 1000) return `${(pop / 1000).toFixed(1)} тыс`;
        return pop.toString();
    }

    async refreshData() {
        if (!this.cityLoader) {
            logger.warn('CityLoader not available');
            return;
        }
        
        try {
            this.showStatus('🔄 Обновление данных...');
            const cities = await this.cityLoader.refreshCache();
            
            if (cities && cities.length > 0 && this.cityLayer) {
                this.cachedData = cities;
                await this.cityLayer.loadData(cities);
                this.showStatus(`✅ Данные обновлены: ${cities.length} городов`);
                setTimeout(() => this.hideStatus(), 2000);
                logger.info(`Data refreshed: ${cities.length} cities`);
            }
        } catch (error) {
            logger.error('Failed to refresh data:', error);
            this.showStatus('❌ Ошибка обновления данных');
            setTimeout(() => this.hideStatus(), 3000);
        }
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
        this.cachedData = null;
        this.isActive = false;
        this.state = ContextState.UNINITIALIZED;
        logger.info('Geography Context disposed');
    }
}