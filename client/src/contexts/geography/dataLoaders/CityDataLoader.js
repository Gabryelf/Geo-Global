import { BaseDataLoader } from '../../../core/abstract/BaseDataLoader';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('CityDataLoader');

/**
 * Загрузчик данных о городах с кешированием на клиенте
 * Данные загружаются с сервера Geo-Global, который кеширует их и обновляет раз в сутки
 */
export class CityDataLoader extends BaseDataLoader {
    constructor() {
        super(null, 3600000); // Кеш в памяти на 1 час
        this.apiUrl = `${window.location.origin}/api/cities`;
        this.cachedData = null;
        this.isLoading = false;
        this.serverAvailable = false;
        this.serverStatus = null;
        this.storageKey = 'geo_global_cities_cache';
        this.lastServerCheck = 0;
        this.serverCheckInterval = 60000; // Проверяем сервер раз в минуту
        
        // Проверяем сервер при создании
        this.checkServerAvailability();
        
        logger.info('CityDataLoader initialized');
    }

    /**
     * Проверка доступности сервера
     */
    async checkServerAvailability() {
        const now = Date.now();
        // Не проверяем слишком часто
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
            } else {
                this.serverAvailable = false;
            }
        } catch (error) {
            this.serverAvailable = false;
            logger.debug('Server not available:', error.message);
        }
        
        return this.serverAvailable;
    }

    /**
     * Основной метод загрузки данных
     */
    async load(query = {}) {
        const cacheKey = this.getCacheKey(query);
        
        // 1. Проверяем кеш в памяти
        if (this.isCacheValid(cacheKey) && this.cachedData) {
            logger.debug('Returning cached cities from memory');
            return this.cachedData;
        }
        
        // 2. Проверяем localStorage (для офлайн режима)
        const storedData = this.loadFromStorage();
        if (storedData && this.isStorageValid(storedData)) {
            logger.info(`✅ Loading ${storedData.cities.length} cities from localStorage cache`);
            this.cachedData = storedData.cities;
            this.cache.set(cacheKey, storedData.cities);
            this.lastUpdated = new Date(storedData.timestamp);
            return storedData.cities;
        }
        
        // 3. Загружаем с сервера
        try {
            // Проверяем доступность сервера
            const serverAvailable = await this.checkServerAvailability();
            
            if (!serverAvailable) {
                logger.warn('Server not available, using stale cache if exists');
                if (storedData) {
                    logger.info('Using stale cache from localStorage');
                    return storedData.cities;
                }
                // Если нет кеша — возвращаем пустой массив
                return [];
            }
            
            this.isLoading = true;
            const data = await this.fetchFresh(query);
            
            if (data && data.length > 0) {
                this.cachedData = data;
                this.cache.set(cacheKey, data);
                this.lastUpdated = new Date();
                // Сохраняем в localStorage для офлайн режима
                this.saveToStorage(data);
                logger.info(`✅ Loaded ${data.length} cities from server`);
            }
            return data;
            
        } catch (error) {
            logger.error('Failed to load cities from server:', error);
            // Если есть сохраненные данные — возвращаем их даже если устарели
            if (storedData) {
                logger.info('⚠️ Using stale cache from localStorage');
                return storedData.cities;
            }
            return [];
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Загрузка свежих данных с сервера
     */
    async fetchFresh(query = {}) {
        const params = new URLSearchParams();
        
        // Базовые параметры
        if (query.limit) params.append('limit', query.limit);
        if (query.minPopulation) params.append('minPopulation', query.minPopulation);
        if (query.maxPopulation) params.append('maxPopulation', query.maxPopulation);
        if (query.country) params.append('country', query.country);
        if (query.continent) params.append('continent', query.continent);
        if (query.search) params.append('search', query.search);
        if (query.isCapital !== undefined) params.append('isCapital', query.isCapital);
        if (query.onlyMajor !== undefined) params.append('onlyMajor', query.onlyMajor);
        if (query.sortBy) params.append('sortBy', query.sortBy);
        
        // Географические границы (bbox)
        if (query.bounds) {
            const bounds = query.bounds;
            if (typeof bounds === 'object') {
                params.append('bounds', JSON.stringify(bounds));
            } else if (typeof bounds === 'string') {
                params.append('bounds', bounds);
            }
        }
        
        const url = `${this.apiUrl}?${params.toString()}`;
        logger.debug(`Fetching cities: ${url}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000) // 15 секунд таймаут
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to load cities');
        }
        
        // Добавляем метаданные к результату
        result._meta = {
            timestamp: result.timestamp,
            total: result.total,
            filters: result.filters
        };
        
        return result.data || [];
    }

    /**
     * Загрузка данных по географическим границам (для приближения)
     */
    async loadByBounds(bounds, limit = 1000) {
        return this.load({
            bounds,
            limit,
            minPopulation: 100000
        });
    }

    /**
     * Загрузка данных с учетом уровня детализации (LOD)
     */
    async loadByLOD(distance) {
        let minPopulation = 0;
        let limit = 5000;
        let onlyMajor = false;
        
        if (distance > 8) {
            // Далекий обзор — только мегаполисы
            minPopulation = 5000000;
            limit = 50;
            onlyMajor = true;
        } else if (distance > 5) {
            minPopulation = 1000000;
            limit = 200;
            onlyMajor = true;
        } else if (distance > 3.5) {
            minPopulation = 500000;
            limit = 500;
        } else if (distance > 2.2) {
            minPopulation = 100000;
            limit = 800;
        } else if (distance > 1.2) {
            minPopulation = 50000;
            limit = 1500;
        } else {
            // Близкий зум — все города
            minPopulation = 0;
            limit = 3000;
        }
        
        logger.debug(`LOD loading: distance=${distance.toFixed(2)}, minPop=${minPopulation}, limit=${limit}`);
        
        return this.load({
            minPopulation,
            limit,
            onlyMajor
        });
    }

    /**
     * Поиск городов по имени
     */
    async searchByName(name, limit = 20) {
        if (!name || name.length < 2) {
            return [];
        }
        
        const params = new URLSearchParams({
            q: name,
            limit: limit.toString()
        });
        
        try {
            const response = await fetch(`${window.location.origin}/api/cities/search?${params}`, {
                signal: AbortSignal.timeout(5000)
            });
            
            if (!response.ok) {
                throw new Error(`Search error: ${response.status}`);
            }
            
            const result = await response.json();
            return result.data || [];
        } catch (error) {
            logger.error('Search failed:', error);
            // Если сервер не доступен — ищем в локальном кеше
            if (this.cachedData) {
                const searchLower = name.toLowerCase();
                return this.cachedData
                    .filter(c => 
                        c.name?.toLowerCase().includes(searchLower) ||
                        c.nameRu?.toLowerCase().includes(searchLower) ||
                        c.country?.toLowerCase().includes(searchLower)
                    )
                    .slice(0, limit);
            }
            return [];
        }
    }

    /**
     * Получение города по ID
     */
    async getCityById(id) {
        if (!id) return null;
        
        try {
            const response = await fetch(`${window.location.origin}/api/cities/${id}`, {
                signal: AbortSignal.timeout(5000)
            });
            
            if (response.status === 404) {
                return null;
            }
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const result = await response.json();
            return result.data || null;
        } catch (error) {
            logger.error('Failed to get city by ID:', error);
            // Ищем в локальном кеше
            if (this.cachedData) {
                return this.cachedData.find(c => c.id === id) || null;
            }
            return null;
        }
    }

    /**
     * Получение списка стран (для фильтров)
     */
    async getCountries() {
        try {
            const response = await fetch(`${window.location.origin}/api/countries`, {
                signal: AbortSignal.timeout(5000)
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const result = await response.json();
            return result.data || [];
        } catch (error) {
            logger.error('Failed to get countries:', error);
            // Извлекаем из локального кеша
            if (this.cachedData) {
                const countries = new Map();
                for (const city of this.cachedData) {
                    if (city.country && !countries.has(city.country)) {
                        countries.set(city.country, {
                            name: city.country,
                            code: city.countryCode || '',
                            count: 0
                        });
                    }
                    if (city.country) {
                        countries.get(city.country).count++;
                    }
                }
                return Array.from(countries.values())
                    .sort((a, b) => b.count - a.count);
            }
            return [];
        }
    }

    /**
     * Получение списка континентов (для фильтров)
     */
    async getContinents() {
        try {
            const response = await fetch(`${window.location.origin}/api/continents`, {
                signal: AbortSignal.timeout(5000)
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const result = await response.json();
            return result.data || [];
        } catch (error) {
            logger.error('Failed to get continents:', error);
            // Извлекаем из локального кеша
            if (this.cachedData) {
                const continents = new Set();
                for (const city of this.cachedData) {
                    if (city.continent) {
                        continents.add(city.continent);
                    }
                }
                return Array.from(continents).sort();
            }
            return [];
        }
    }

    /**
     * Получение статистики по городам
     */
    async getStats() {
        try {
            const response = await fetch(`${window.location.origin}/api/stats`, {
                signal: AbortSignal.timeout(5000)
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const result = await response.json();
            return result.data || null;
        } catch (error) {
            logger.error('Failed to get stats:', error);
            return null;
        }
    }

    /**
     * Принудительное обновление кеша
     */
    async refreshCache() {
        logger.info('🔄 Forcing cache refresh...');
        this.clearCache();
        this.cachedData = null;
        localStorage.removeItem(this.storageKey);
        
        try {
            // Запрашиваем обновление на сервере
            const response = await fetch(`${window.location.origin}/api/refresh`, {
                method: 'POST',
                signal: AbortSignal.timeout(5000)
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const result = await response.json();
            logger.info('Refresh request sent:', result);
            
            // Ждем немного и загружаем свежие данные
            await new Promise(resolve => setTimeout(resolve, 2000));
            return this.load();
        } catch (error) {
            logger.error('Failed to refresh cache:', error);
            // Пробуем загрузить без обновления
            return this.load();
        }
    }

    /**
     * Проверка доступности провайдера
     */
    async healthCheck() {
        return this.checkServerAvailability();
    }

    /**
     * Получение метаданных
     */
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

    /**
     * Сохранение данных в localStorage
     */
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

    /**
     * Загрузка данных из localStorage
     */
    loadFromStorage() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return null;
            
            const data = JSON.parse(raw);
            if (!data.cities || !data.timestamp) return null;
            
            return data;
        } catch (error) {
            logger.warn('Failed to load from localStorage:', error);
            return null;
        }
    }

    /**
     * Проверка актуальности данных в localStorage
     */
    isStorageValid(storedData) {
        if (!storedData || !storedData.timestamp) return false;
        const age = Date.now() - storedData.timestamp;
        // Кеш в localStorage хранится 7 дней (для офлайн режима)
        return age < 7 * 24 * 60 * 60 * 1000;
    }

    /**
     * Очистка кеша
     */
    clearCache() {
        super.clearCache();
        this.cachedData = null;
        // Не удаляем localStorage, чтобы оставить возможность офлайн работы
        // localStorage.removeItem(this.storageKey);
        logger.info('Cache cleared (localStorage kept for offline)');
    }

    /**
     * Полный сброс кеша (включая localStorage)
     */
    clearAllCache() {
        this.clearCache();
        localStorage.removeItem(this.storageKey);
        logger.info('All cache cleared (including localStorage)');
    }

    /**
     * Обработка данных (преобразование)
     */
    processData(data) {
        if (!data || !Array.isArray(data)) return [];
        
        return data.map(item => ({
            ...item,
            // Гарантируем наличие необходимых полей
            id: item.id || `city-${Math.random()}`,
            name: item.name || 'Unknown',
            nameRu: item.nameRu || item.name || 'Unknown',
            country: item.country || 'Unknown',
            lat: parseFloat(item.lat) || 0,
            lon: parseFloat(item.lon) || 0,
            population: parseInt(item.population) || 0,
            isCapital: item.isCapital || false,
            importance: item.importance || 0,
            continent: item.continent || '',
            displayName: item.displayName || `${item.name || 'Unknown'}, ${item.country || 'Unknown'}`
        }));
    }

    /**
     * Получение статуса загрузки
     */
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

// Экспорт для использования
export default CityDataLoader;