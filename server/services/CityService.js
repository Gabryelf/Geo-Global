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
            logger.info(`✅ Loaded ${cached.data.length} cities from cache`);
            this.allCities = cached.data;
            this.lastUpdate = new Date(cached.timestamp);
            this.buildIndexes();
            return;
        }

        // Если кеш пуст — загружаем свежие данные
        await this.refreshCities();
    }

    async refreshCities() {
        if (this.isRefreshing) {
            logger.warn('Refresh already in progress');
            return;
        }

        this.isRefreshing = true;
        logger.info('🔄 Refreshing cities data...');

        try {
            // Загружаем города из всех источников
            const cities = await this.dataSource.fetchAllCities();
            
            if (cities && cities.length > 0) {
                // Обогащаем данные
                const enriched = await this.enrichCities(cities);
                
                // Сохраняем в кеш
                this.cacheManager.set('cities', {
                    data: enriched,
                    timestamp: Date.now(),
                    total: enriched.length
                });

                this.allCities = enriched;
                this.lastUpdate = new Date();
                this.buildIndexes();
                
                logger.info(`✅ Refreshed ${enriched.length} cities`);
            } else {
                logger.warn('⚠️ No cities loaded from data source');
            }
        } catch (error) {
            logger.error('Failed to refresh cities:', error);
        } finally {
            this.isRefreshing = false;
        }
    }

    async forceRefresh() {
        logger.info('🔄 Force refresh requested');
        await this.refreshCities();
    }

    startAutoRefresh() {
        setInterval(() => {
            logger.info('🔄 Auto-refresh triggered');
            this.refreshCities().catch(err => {
                logger.error('Auto-refresh failed:', err);
            });
        }, this.refreshInterval);
    }

    buildIndexes() {
        this.continentsCache.clear();
        this.countriesCache.clear();
        
        for (const city of this.allCities) {
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
            city.continent = city.continent || this.detectContinent(city);
            city.importance = this.calculateImportance(city);
            
            // Добавляем дополнительные поля для фильтров
            city.area = city.area || Math.random() * 1000 + 100; // Площадь (км²) - для демо
            city.density = city.density || Math.round((city.population || 0) / (city.area || 100));
            city.isCapital = city.isCapital || false;
            city.type = city.type || 'city';
            
            // Русское название
            if (!city.nameRu) {
                city.nameRu = this.transliterate(city.name);
            }
        }
        return cities;
    }

    calculateImportance(city) {
        const pop = city.population || 0;
        if (pop >= 10000000) return 5;
        if (pop >= 5000000) return 4;
        if (pop >= 1000000) return 3;
        if (pop >= 500000) return 2;
        if (pop >= 100000) return 1;
        return 0;
    }

    transliterate(name) {
        const map = {
            'a': 'а', 'b': 'б', 'c': 'к', 'd': 'д', 'e': 'е', 'f': 'ф',
            'g': 'г', 'h': 'х', 'i': 'и', 'j': 'ж', 'k': 'к', 'l': 'л',
            'm': 'м', 'n': 'н', 'o': 'о', 'p': 'п', 'q': 'к', 'r': 'р',
            's': 'с', 't': 'т', 'u': 'у', 'v': 'в', 'w': 'в', 'x': 'кс',
            'y': 'ы', 'z': 'з'
        };
        return name.toLowerCase().split('').map(ch => map[ch] || ch).join('');
    }

    async getCities(filters = {}) {
        let result = [...this.allCities];

        // Фильтр по минимальному населению
        if (filters.minPopulation !== undefined) {
            result = result.filter(c => (c.population || 0) >= filters.minPopulation);
        }

        // Фильтр по максимальному населению
        if (filters.maxPopulation !== undefined) {
            result = result.filter(c => (c.population || 0) <= filters.maxPopulation);
        }

        // Фильтр по стране
        if (filters.country) {
            const countryLower = filters.country.toLowerCase();
            result = result.filter(c =>
                c.country?.toLowerCase() === countryLower ||
                c.countryCode?.toLowerCase() === countryLower
            );
        }

        // Фильтр по континенту
        if (filters.continent) {
            result = result.filter(c => c.continent === filters.continent);
        }

        // Фильтр по поисковому запросу
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            result = result.filter(c =>
                c.name?.toLowerCase().includes(searchLower) ||
                c.nameRu?.toLowerCase().includes(searchLower) ||
                c.country?.toLowerCase().includes(searchLower)
            );
        }

        // Только столицы
        if (filters.isCapital) {
            result = result.filter(c => c.isCapital === true);
        }

        // Только крупные города
        if (filters.onlyMajor) {
            result = result.filter(c => (c.population || 0) >= 1000000);
        }

        // Фильтр по типу
        if (filters.type) {
            result = result.filter(c => c.type === filters.type);
        }

        // Фильтр по минимальной площади
        if (filters.minArea) {
            result = result.filter(c => (c.area || 0) >= filters.minArea);
        }

        // Фильтр по плотности населения
        if (filters.minDensity) {
            result = result.filter(c => (c.density || 0) >= filters.minDensity);
        }

        // Сортировка
        if (filters.sortBy) {
            result.sort((a, b) => {
                const aVal = a[filters.sortBy] || 0;
                const bVal = b[filters.sortBy] || 0;
                return bVal - aVal;
            });
        } else {
            // По умолчанию сортируем по населению
            result.sort((a, b) => (b.population || 0) - (a.population || 0));
        }

        // Лимит
        if (filters.limit && filters.limit > 0) {
            result = result.slice(0, filters.limit);
        }

        return result;
    }

    async getCityById(id) {
        return this.allCities.find(c => c.id === id) || null;
    }

    async searchCities(query, limit = 20) {
        if (!query) return [];
        
        const searchLower = query.toLowerCase();
        const results = this.allCities.filter(c => {
            const match = c.name?.toLowerCase().includes(searchLower) ||
                         c.nameRu?.toLowerCase().includes(searchLower) ||
                         c.country?.toLowerCase().includes(searchLower);
            return match;
        });

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

        if (name === queryLower) score += 100;
        if (nameRu === queryLower) score += 100;
        if (name.startsWith(queryLower)) score += 50;
        if (nameRu.startsWith(queryLower)) score += 50;
        if (name.includes(queryLower)) score += 20;
        if (nameRu.includes(queryLower)) score += 20;

        score += (city.population || 0) / 10000000;
        return score;
    }

    async getTotalCount() {
        return this.allCities.length;
    }

    getContinents() {
        return Array.from(this.continentsCache.keys());
    }

    getCitiesByContinent(continent) {
        return this.continentsCache.get(continent) || [];
    }

    async getCountries() {
        const countries = [];
        for (const [name, cities] of this.countriesCache) {
            if (name && name !== 'Unknown') {
                countries.push({
                    name: name,
                    count: cities.length,
                    cities: cities.slice(0, 5).map(c => c.name)
                });
            }
        }
        return countries.sort((a, b) => b.count - a.count);
    }

    async getStats() {
        const total = this.allCities.length;
        const byContinent = {};
        const byPopulation = {
            mega: 0, large: 0, medium: 0, small: 0, tiny: 0
        };
        
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
        }

        return {
            total,
            capitals,
            totalPopulation,
            averagePopulation: total > 0 ? Math.round(totalPopulation / total) : 0,
            byContinent,
            byPopulation,
            lastUpdate: this.lastUpdate,
            sources: {
                geonames: this.allCities.filter(c => c.source === 'geonames').length,
                openmeteo: this.allCities.filter(c => c.source === 'openmeteo').length,
                restcountries: this.allCities.filter(c => c.source === 'restcountries').length,
                major: this.allCities.filter(c => c.source === 'major').length
            }
        };
    }
}