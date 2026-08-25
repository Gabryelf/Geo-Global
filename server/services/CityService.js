// server/services/CityService.js
import { CitiesDataSource } from '../data/CitiesDataSource.js';
import { createLogger } from '../../client/src/utils/logger.js';

const logger = createLogger('CityService');

export class CityService {
    constructor(cacheManager) {
        this.cacheManager = cacheManager;
        this.dataSource = new CitiesDataSource();
        this.lastUpdate = null;
        this.refreshInterval = 24 * 60 * 60 * 1000; // 24 часа
        this.isRefreshing = false;
        this.allCities = [];
        this.continentsCache = new Map();
        this.countriesCache = new Map();
        this.cityMap = new Map(); // Для быстрого поиска по ID
    }

    async initialize() {
        logger.info('Initializing CityService...');
        await this.loadCities();
        this.startAutoRefresh();
        logger.info('CityService initialized successfully');
    }

    async loadCities() {
        // Пытаемся загрузить из кеша
        const cached = this.cacheManager.get('cities');
        if (cached && cached.data && cached.data.length > 0) {
            logger.info(`✅ Loaded ${cached.data.length} cities from cache (last update: ${new Date(cached.timestamp).toISOString()})`);
            this.allCities = cached.data;
            this.lastUpdate = new Date(cached.timestamp);
            this.buildIndexes();
            return;
        }

        // Если кеша нет — загружаем свежие данные
        logger.info('Cache is empty, fetching fresh data from APIs...');
        await this.refreshCities();
    }

    async refreshCities() {
        if (this.isRefreshing) {
            logger.warn('Refresh already in progress');
            return;
        }

        this.isRefreshing = true;
        logger.info('🔄 Starting data refresh from external APIs...');

        try {
            // Загружаем города из всех API источников
            const cities = await this.dataSource.fetchAllCities();
            
            if (!cities || cities.length === 0) {
                throw new Error('No cities loaded from any API source');
            }

            // Обогащаем данные
            const enriched = await this.enrichCities(cities);
            
            // Сохраняем в кеш
            this.cacheManager.set('cities', {
                data: enriched,
                timestamp: Date.now(),
                total: enriched.length,
                source: 'external_apis'
            });

            this.allCities = enriched;
            this.lastUpdate = new Date();
            this.buildIndexes();
            
            logger.info(`✅ Refreshed ${enriched.length} cities from external APIs`);
            logger.info(`📊 Data sources: ${this.getSourceStats(enriched)}`);
            
        } catch (error) {
            logger.error('❌ Failed to refresh cities:', error);
            // Если обновление не удалось, пробуем использовать старый кеш
            const oldCache = this.cacheManager.get('cities');
            if (oldCache && oldCache.data && oldCache.data.length > 0) {
                logger.warn(`⚠️ Using stale cache with ${oldCache.data.length} cities`);
                this.allCities = oldCache.data;
                this.lastUpdate = new Date(oldCache.timestamp);
                this.buildIndexes();
            } else {
                throw error;
            }
        } finally {
            this.isRefreshing = false;
        }
    }

    getSourceStats(cities) {
        const stats = {};
        for (const city of cities) {
            const source = city.source || 'unknown';
            stats[source] = (stats[source] || 0) + 1;
        }
        return Object.entries(stats).map(([source, count]) => `${source}: ${count}`).join(', ');
    }

    async forceRefresh() {
        logger.info('🔄 Force refresh requested by user');
        await this.refreshCities();
    }

    startAutoRefresh() {
        setInterval(() => {
            logger.info('🔄 Auto-refresh triggered (24h interval)');
            this.refreshCities().catch(err => {
                logger.error('Auto-refresh failed:', err);
            });
        }, this.refreshInterval);
    }

    buildIndexes() {
        this.continentsCache.clear();
        this.countriesCache.clear();
        this.cityMap.clear();
        
        for (const city of this.allCities) {
            // Индекс по ID
            if (city.id) {
                this.cityMap.set(city.id, city);
            }
            
            // Континенты
            const continent = city.continent || 'Unknown';
            if (!this.continentsCache.has(continent)) {
                this.continentsCache.set(continent, []);
            }
            this.continentsCache.get(continent).push(city);
            
            // Страны
            const country = city.country || 'Unknown';
            if (!this.countriesCache.has(country)) {
                this.countriesCache.set(country, []);
            }
            this.countriesCache.get(country).push(city);
        }
        
        logger.info(`Indexes built: ${this.countriesCache.size} countries, ${this.continentsCache.size} continents`);
    }

    detectContinent(city) {
        const { lat, lon } = city;
        if (lat > 0) {
            if (lon < -30) return 'North America';
            if (lon < 60) return 'Europe';
            if (lon < 130) return 'Asia';
            return 'North America';
        } else {
            if (lon < -30) return 'South America';
            if (lon < 60) return 'Africa';
            if (lon < 130) return 'Asia';
            return 'Australia/Oceania';
        }
    }

    async enrichCities(cities) {
        for (const city of cities) {
            // Добавляем континент
            city.continent = city.continent || this.detectContinent(city);
            
            // Рассчитываем важность
            city.importance = this.calculateImportance(city.population || 0);
            
            // Добавляем поля для фильтров (если нет)
            if (!city.area) {
                // Генерируем примерную площадь на основе населения
                city.area = Math.max(50, Math.round((city.population || 1000) / 10000));
            }
            
            if (!city.density && city.area && city.population) {
                city.density = Math.round(city.population / city.area);
            }
            
            // Если нет русского названия
            if (!city.nameRu) {
                city.nameRu = city.name;
            }
        }
        return cities;
    }

    calculateImportance(population) {
        if (population >= 10000000) return 5;
        if (population >= 5000000) return 4;
        if (population >= 1000000) return 3;
        if (population >= 500000) return 2;
        if (population >= 100000) return 1;
        return 0;
    }

    async getCities(filters = {}) {
        let result = [...this.allCities];

        if (filters.minPopulation !== undefined) {
            result = result.filter(c => (c.population || 0) >= filters.minPopulation);
        }

        if (filters.maxPopulation !== undefined) {
            result = result.filter(c => (c.population || 0) <= filters.maxPopulation);
        }

        if (filters.country) {
            const countryLower = filters.country.toLowerCase();
            result = result.filter(c =>
                c.country?.toLowerCase() === countryLower ||
                c.countryCode?.toLowerCase() === countryLower
            );
        }

        if (filters.continent) {
            result = result.filter(c => c.continent === filters.continent);
        }

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            result = result.filter(c =>
                c.name?.toLowerCase().includes(searchLower) ||
                c.nameRu?.toLowerCase().includes(searchLower) ||
                c.country?.toLowerCase().includes(searchLower)
            );
        }

        if (filters.isCapital) {
            result = result.filter(c => c.isCapital === true);
        }

        if (filters.onlyMajor) {
            result = result.filter(c => (c.population || 0) >= 1000000);
        }

        // Сортировка
        const sortBy = filters.sortBy || 'population';
        result.sort((a, b) => {
            const aVal = a[sortBy] || 0;
            const bVal = b[sortBy] || 0;
            return bVal - aVal;
        });

        if (filters.limit && filters.limit > 0) {
            result = result.slice(0, filters.limit);
        }

        return result;
    }

    async getCityById(id) {
        return this.cityMap.get(id) || null;
    }

    async searchCities(query, limit = 20) {
        if (!query) return [];
        
        const searchLower = query.toLowerCase();
        const results = this.allCities.filter(c => {
            return c.name?.toLowerCase().includes(searchLower) ||
                   c.nameRu?.toLowerCase().includes(searchLower) ||
                   c.country?.toLowerCase().includes(searchLower);
        });

        // Сортировка по релевантности
        results.sort((a, b) => {
            const scoreA = this.getRelevanceScore(a, query);
            const scoreB = this.getRelevanceScore(b, query);
            return scoreB - scoreA;
        });

        return results.slice(0, limit);
    }

    getRelevanceScore(city, query) {
        let score = 0;
        const name = city.name?.toLowerCase() || '';
        const nameRu = city.nameRu?.toLowerCase() || '';
        const queryLower = query.toLowerCase();

        if (name === queryLower || nameRu === queryLower) score += 100;
        if (name.startsWith(queryLower) || nameRu.startsWith(queryLower)) score += 50;
        if (name.includes(queryLower) || nameRu.includes(queryLower)) score += 20;
        
        // Бонус за население
        score += (city.population || 0) / 10000000;
        
        return score;
    }

    async getTotalCount() {
        return this.allCities.length;
    }

    getContinents() {
        return Array.from(this.continentsCache.keys()).sort();
    }

    async getCountries() {
        const countries = [];
        for (const [name, cities] of this.countriesCache) {
            if (name && name !== 'Unknown') {
                countries.push({
                    name: name,
                    count: cities.length
                });
            }
        }
        return countries.sort((a, b) => b.count - a.count);
    }

    async getStats() {
        const total = this.allCities.length;
        const byContinent = {};
        const byPopulation = { mega: 0, large: 0, medium: 0, small: 0, tiny: 0 };
        const bySource = {};
        
        let totalPopulation = 0;
        let capitals = 0;

        for (const city of this.allCities) {
            const pop = city.population || 0;
            totalPopulation += pop;
            
            if (pop >= 10000000) byPopulation.mega++;
            else if (pop >= 5000000) byPopulation.large++;
            else if (pop >= 1000000) byPopulation.medium++;
            else if (pop >= 500000) byPopulation.small++;
            else byPopulation.tiny++;

            if (city.isCapital) capitals++;

            const continent = city.continent || 'Unknown';
            if (!byContinent[continent]) {
                byContinent[continent] = { count: 0, population: 0 };
            }
            byContinent[continent].count++;
            byContinent[continent].population += pop;

            const source = city.source || 'unknown';
            bySource[source] = (bySource[source] || 0) + 1;
        }

        return {
            total,
            capitals,
            totalPopulation,
            averagePopulation: total > 0 ? Math.round(totalPopulation / total) : 0,
            byContinent,
            byPopulation,
            bySource,
            lastUpdate: this.lastUpdate,
            lastUpdateISO: this.lastUpdate?.toISOString()
        };
    }
}