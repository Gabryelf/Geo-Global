// client/src/contexts/history/dataLoaders/HistoricalDataLoader.js
import { BaseDataLoader } from '../../../core/abstract/BaseDataLoader';
import { createLogger } from '../../../utils/logger';
import { ApiConfig } from '../../../configs/api.config';

const logger = createLogger('HistoricalDataLoader');

export class HistoricalDataLoader extends BaseDataLoader {
    constructor() {
        super(null, 3600000);
        this.apiUrl = `${ApiConfig.baseUrl}/api/historical`;
        this.cachedData = null;
        this.isLoading = false;
        this.storageKey = 'geo_global_historical_cache';
        logger.info('HistoricalDataLoader initialized');
    }

    async load(query = {}) {
        const cacheKey = this.getCacheKey(query);
        
        // Проверяем кеш в памяти
        if (this.isCacheValid(cacheKey) && this.cachedData) {
            logger.debug('Returning cached historical data from memory');
            return this.cachedData;
        }
        
        // Проверяем localStorage
        const storedData = this.loadFromStorage();
        if (storedData && this.isStorageValid(storedData)) {
            logger.info(`✅ Loading ${storedData.data?.length || 0} historical items from localStorage cache`);
            this.cachedData = storedData.data;
            this.cache.set(cacheKey, storedData.data);
            this.lastUpdated = new Date(storedData.timestamp);
            return storedData.data;
        }
        
        // Загружаем с сервера
        try {
            this.isLoading = true;
            const data = await this.fetchFresh(query);
            
            if (data && data.length > 0) {
                this.cachedData = data;
                this.cache.set(cacheKey, data);
                this.lastUpdated = new Date();
                this.saveToStorage(data);
                logger.info(`✅ Loaded ${data.length} historical items from server`);
            }
            return data || [];
        } catch (error) {
            logger.error('Failed to load historical data:', error);
            if (storedData && storedData.data) {
                logger.info('⚠️ Using stale cache from localStorage');
                return storedData.data;
            }
            return this.getMockData(query.epoch);
        } finally {
            this.isLoading = false;
        }
    }

    async fetchFresh(query = {}) {
        const { epoch = 'all', limit = 100 } = query;
        
        // Пробуем загрузить с сервера
        try {
            const url = `${this.apiUrl}/cities?epoch=${epoch}&limit=${limit}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(10000)
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    return result.data;
                }
            }
        } catch (error) {
            logger.debug('Server not available for historical data, using mock data');
        }
        
        // Если сервер не доступен - возвращаем тестовые данные
        return this.getMockData(epoch);
    }

    getMockData(epoch = 'all') {
        // Тестовые данные для исторического контекста
        const allData = [
            // Древний мир
            { 
                id: 'ancient-egypt', 
                name: 'Древний Египет', 
                type: 'civilization',
                epoch: 'ancient',
                lat: 29.9792, 
                lon: 31.1342,
                description: 'Цивилизация Древнего Египта',
                icon: '🏛️'
            },
            { 
                id: 'ancient-greece', 
                name: 'Древняя Греция', 
                type: 'civilization',
                epoch: 'ancient',
                lat: 37.9838, 
                lon: 23.7275,
                description: 'Цивилизация Древней Греции',
                icon: '🏛️'
            },
            { 
                id: 'ancient-rome', 
                name: 'Древний Рим', 
                type: 'civilization',
                epoch: 'ancient',
                lat: 41.9028, 
                lon: 12.4964,
                description: 'Римская империя',
                icon: '🏛️'
            },
            { 
                id: 'battle-marathon', 
                name: 'Марафонская битва', 
                type: 'battle',
                epoch: 'ancient',
                lat: 38.1550, 
                lon: 23.9600,
                description: '490 г. до н.э. - Греко-персидские войны',
                icon: '⚔️'
            },
            
            // Средневековье
            { 
                id: 'byzantine', 
                name: 'Византийская империя', 
                type: 'empire',
                epoch: 'middle',
                lat: 41.0082, 
                lon: 28.9784,
                description: 'Византийская империя (Константинополь)',
                icon: '👑'
            },
            { 
                id: 'kievan-rus', 
                name: 'Киевская Русь', 
                type: 'empire',
                epoch: 'middle',
                lat: 50.4501, 
                lon: 30.5234,
                description: 'Древнерусское государство (Киев)',
                icon: '👑'
            },
            { 
                id: 'battle-hastings', 
                name: 'Битва при Гастингсе', 
                type: 'battle',
                epoch: 'middle',
                lat: 50.9040, 
                lon: 0.4820,
                description: '1066 г. - Нормандское завоевание Англии',
                icon: '⚔️'
            },
            { 
                id: 'silk-road', 
                name: 'Великий Шелковый путь', 
                type: 'trade',
                epoch: 'middle',
                lat: 40.0000, 
                lon: 80.0000,
                description: 'Торговый путь между Востоком и Западом',
                icon: '🐫'
            },
            
            // Новое время
            { 
                id: 'spanish-empire', 
                name: 'Испанская империя', 
                type: 'empire',
                epoch: 'new',
                lat: 40.4168, 
                lon: -3.7038,
                description: 'Испанская колониальная империя',
                icon: '👑'
            },
            { 
                id: 'battle-waterloo', 
                name: 'Битва при Ватерлоо', 
                type: 'battle',
                epoch: 'new',
                lat: 50.6700, 
                lon: 4.4000,
                description: '1815 г. - Битва Наполеона',
                icon: '⚔️'
            },
            { 
                id: 'age-discovery', 
                name: 'Эпоха Великих открытий', 
                type: 'trade',
                epoch: 'new',
                lat: 38.7072, 
                lon: -9.1355,
                description: 'Португалия - центр географических открытий',
                icon: '⛵'
            },
            
            // Новейшее время
            { 
                id: 'industrial-revolution', 
                name: 'Промышленная революция', 
                type: 'culture',
                epoch: 'modern',
                lat: 53.4808, 
                lon: -2.2426,
                description: 'Манчестер - центр промышленной революции',
                icon: '🏭'
            },
            { 
                id: 'battle-stalingrad', 
                name: 'Сталинградская битва', 
                type: 'battle',
                epoch: 'modern',
                lat: 48.7080, 
                lon: 44.5133,
                description: '1942-1943 гг. - Вторая мировая война',
                icon: '⚔️'
            },
            { 
                id: 'battle-normandy', 
                name: 'Высадка в Нормандии', 
                type: 'battle',
                epoch: 'modern',
                lat: 49.3700, 
                lon: -0.8500,
                description: '1944 г. - День Д, Вторая мировая война',
                icon: '⚔️'
            },
            
            // Современность
            { 
                id: 'united-nations', 
                name: 'ООН', 
                type: 'culture',
                epoch: 'contemporary',
                lat: 40.7488, 
                lon: -73.9679,
                description: 'Штаб-квартира ООН в Нью-Йорке',
                icon: '🌐'
            },
            { 
                id: 'european-union', 
                name: 'Европейский Союз', 
                type: 'culture',
                epoch: 'contemporary',
                lat: 50.8503, 
                lon: 4.3517,
                description: 'Штаб-квартира ЕС в Брюсселе',
                icon: '🇪🇺'
            },
            { 
                id: 'silicon-valley', 
                name: 'Кремниевая долина', 
                type: 'culture',
                epoch: 'contemporary',
                lat: 37.3875, 
                lon: -122.0575,
                description: 'Центр технологических инноваций',
                icon: '💻'
            }
        ];

        if (epoch === 'all') {
            return allData;
        }
        
        return allData.filter(item => item.epoch === epoch);
    }

    saveToStorage(data) {
        try {
            const cacheData = {
                timestamp: Date.now(),
                data: data,
                version: '1.0.0'
            };
            localStorage.setItem(this.storageKey, JSON.stringify(cacheData));
            logger.debug(`💾 Saved ${data.length} historical items to localStorage`);
        } catch (error) {
            logger.warn('Failed to save to localStorage:', error);
        }
    }

    loadFromStorage() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data.data || !data.timestamp) return null;
            return data;
        } catch (error) {
            logger.warn('Failed to load from localStorage:', error);
            return null;
        }
    }

    isStorageValid(storedData) {
        if (!storedData || !storedData.timestamp) return false;
        const age = Date.now() - storedData.timestamp;
        return age < 30 * 24 * 60 * 60 * 1000; // 30 дней
    }

    clearCache() {
        super.clearCache();
        this.cachedData = null;
        logger.info('Historical cache cleared');
    }

    clearAllCache() {
        this.clearCache();
        localStorage.removeItem(this.storageKey);
        logger.info('All historical cache cleared');
    }

    getMetadata() {
        return {
            source: 'Geo-Global Server / Mock Data',
            sourceUrl: this.apiUrl,
            lastUpdated: this.lastUpdated || new Date(),
            cached: this.cachedData !== null,
            total: this.cachedData?.length || 0
        };
    }

    processData(data) {
        if (!data || !Array.isArray(data)) return [];
        return data.map(item => ({
            ...item,
            id: item.id || `hist-${Math.random()}`,
            name: item.name || 'Unknown',
            type: item.type || 'unknown',
            epoch: item.epoch || 'unknown',
            lat: parseFloat(item.lat) || 0,
            lon: parseFloat(item.lon) || 0,
            description: item.description || '',
            icon: item.icon || '📌'
        }));
    }

    getLoadStatus() {
        return {
            isLoading: this.isLoading,
            lastUpdated: this.lastUpdated,
            cacheSize: this.cache.size,
            cachedDataCount: this.cachedData?.length || 0,
            storageDataCount: this.loadFromStorage()?.data?.length || 0
        };
    }
}

export default HistoricalDataLoader;