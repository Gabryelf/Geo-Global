// client/src/contexts/geography/dataLoaders/CityDataLoader.js
import { BaseDataLoader } from '../../../core/abstract/BaseDataLoader';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('CityDataLoader');

export class CityDataLoader extends BaseDataLoader {
    constructor() {
        super(null, 3600000);
        this.apiUrl = `${window.location.origin}/api/cities`;
        this.cachedData = null;
        this.isLoading = false;
        this.serverAvailable = false;
        this.serverStatus = null;
        this.storageKey = 'geo_global_cities_cache';
        this.lastServerCheck = 0;
        this.serverCheckInterval = 60000;
        // Проверяем сервер при создании
        this.checkServerAvailability();
        logger.info('CityDataLoader initialized');
    }

    async checkServerAvailability() {
        const now = Date.now();
        if (now - this.lastServerCheck < this.serverCheckInterval) {
            return this.serverAvailable;
        }
        this.lastServerCheck = now;
        
        try {
            const response = await fetch(`${window.location.origin}/api/status`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(3000)
            });
            if (response.ok) {
                this.serverStatus = await response.json();
                this.serverAvailable = true;
                logger.debug('✅ Server available:', this.serverStatus);
                return true;
            } else {
                this.serverAvailable = false;
                logger.warn(`Server returned ${response.status}`);
                return false;
            }
        } catch (error) {
            this.serverAvailable = false;
            logger.debug('Server not available:', error.message);
            return false;
        }
    }

    async load(query = {}) {
        const cacheKey = this.getCacheKey(query);
        
        logger.info(`Loading cities with query:`, query);
        
        // Проверяем кеш в памяти
        if (this.isCacheValid(cacheKey) && this.cachedData && this.cachedData.length > 0) {
            logger.debug(`Returning ${this.cachedData.length} cities from memory cache`);
            return this.cachedData;
        }
        
        // Проверяем localStorage
        const storedData = this.loadFromStorage();
        if (storedData && this.isStorageValid(storedData) && storedData.cities && storedData.cities.length > 0) {
            logger.info(`✅ Loading ${storedData.cities.length} cities from localStorage cache`);
            this.cachedData = storedData.cities;
            this.cache.set(cacheKey, storedData.cities);
            this.lastUpdated = new Date(storedData.timestamp);
            return storedData.cities;
        }
        
        // Загружаем с сервера
        try {
            const serverAvailable = await this.checkServerAvailability();
            if (!serverAvailable) {
                logger.warn('Server not available, using stale cache if exists');
                if (storedData && storedData.cities) {
                    logger.info(`Using stale cache (${storedData.cities.length} cities)`);
                    return storedData.cities;
                }
                // Если нет данных - возвращаем пустой массив, но не выбрасываем ошибку
                logger.warn('No data available');
                return [];
            }
            
            this.isLoading = true;
            logger.info('Fetching fresh data from server...');
            const data = await this.fetchFresh(query);
            
            if (data && data.length > 0) {
                this.cachedData = data;
                this.cache.set(cacheKey, data);
                this.lastUpdated = new Date();
                this.saveToStorage(data);
                logger.info(`✅ Loaded ${data.length} cities from server`);
                return data;
            } else {
                logger.warn('Server returned empty data');
                // Если есть старый кеш - используем его
                if (storedData && storedData.cities) {
                    logger.info(`Using stale cache (${storedData.cities.length} cities)`);
                    return storedData.cities;
                }
                return [];
            }
        } catch (error) {
            logger.error('Failed to load cities from server:', error);
            if (storedData && storedData.cities) {
                logger.info(`⚠️ Using stale cache (${storedData.cities.length} cities)`);
                return storedData.cities;
            }
            return [];
        } finally {
            this.isLoading = false;
        }
    }

    async fetchFresh(query = {}) {
        const params = new URLSearchParams();
        
        params.append('limit', query.limit || 5000);
        if (query.minPopulation !== undefined) params.append('minPopulation', query.minPopulation);
        if (query.maxPopulation !== undefined) params.append('maxPopulation', query.maxPopulation);
        if (query.country) params.append('country', query.country);
        if (query.continent) params.append('continent', query.continent);
        if (query.search) params.append('search', query.search);
        if (query.isCapital !== undefined) params.append('isCapital', query.isCapital);
        if (query.onlyMajor !== undefined) params.append('onlyMajor', query.onlyMajor);
        if (query.sortBy) params.append('sortBy', query.sortBy);
        
        if (query.bounds) {
            const bounds = query.bounds;
            if (typeof bounds === 'object') {
                params.append('bounds', JSON.stringify(bounds));
            } else if (typeof bounds === 'string') {
                params.append('bounds', bounds);
            }
        }

        const url = `${this.apiUrl}?${params.toString()}`;
        logger.info(`Fetching cities from: ${url}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000)
        });
        
        if (!response.ok) {
            let errorData = {};
            try {
                errorData = await response.json();
            } catch {}
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to load cities');
        }
        
        logger.info(`Server returned ${result.data?.length || 0} cities`);
        return result.data || [];
    }

    saveToStorage(cities) {
        try {
            const data = {
                timestamp: Date.now(),
                cities: cities,
                version: '1.0.0',
                total: cities.length
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            logger.debug(`💾 Saved ${cities.length} cities to localStorage`);
        } catch (error) {
            logger.warn('Failed to save to localStorage:', error);
        }
    }

    loadFromStorage() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data.cities || !data.timestamp) return null;
            logger.debug(`Found ${data.cities.length} cities in localStorage`);
            return data;
        } catch (error) {
            logger.warn('Failed to load from localStorage:', error);
            return null;
        }
    }

    isStorageValid(storedData) {
        if (!storedData || !storedData.timestamp) return false;
        const age = Date.now() - storedData.timestamp;
        return age < 7 * 24 * 60 * 60 * 1000; // 7 дней
    }

    clearCache() {
        super.clearCache();
        this.cachedData = null;
        logger.info('Memory cache cleared');
    }

    clearAllCache() {
        this.clearCache();
        localStorage.removeItem(this.storageKey);
        logger.info('All cache cleared (including localStorage)');
    }

    async refreshCache() {
        logger.info('🔄 Forcing cache refresh...');
        this.clearAllCache();
        try {
            const response = await fetch(`${window.location.origin}/api/refresh`, {
                method: 'POST',
                signal: AbortSignal.timeout(5000)
            });
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            const result = await response.json();
            logger.info('Refresh request sent:', result);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return this.load();
        } catch (error) {
            logger.error('Failed to refresh cache:', error);
            return this.load();
        }
    }

    async healthCheck() {
        return this.checkServerAvailability();
    }

    getMetadata() {
        return {
            source: 'Geo-Global Server',
            sourceUrl: window.location.origin,
            lastUpdated: this.lastUpdated || new Date(),
            cached: this.cachedData !== null,
            total: this.cachedData?.length || 0,
            serverAvailable: this.serverAvailable,
            serverStatus: this.serverStatus
        };
    }

    processData(data) {
        if (!data || !Array.isArray(data)) return [];
        return data.map(item => ({
            ...item,
            id: item.id || `city-${Math.random()}`,
            name: item.name || 'Unknown',
            nameRu: item.nameRu || item.name || 'Unknown',
            country: item.country || 'Unknown',
            lat: parseFloat(item.lat) || 0,
            lon: parseFloat(item.lon) || 0,
            population: parseInt(item.population) || 0,
            isCapital: item.isCapital || false,
            importance: item.importance || 0,
            continent: item.continent || ''
        }));
    }

    getLoadStatus() {
        return {
            isLoading: this.isLoading,
            lastUpdated: this.lastUpdated,
            cacheSize: this.cache.size,
            serverAvailable: this.serverAvailable,
            cachedDataCount: this.cachedData?.length || 0,
            storageDataCount: this.loadFromStorage()?.cities?.length || 0
        };
    }
}

export default CityDataLoader;