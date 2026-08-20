import { BaseDataLoader } from '../../../core/abstract/BaseDataLoader';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('CityDataLoader');

/**
 * Загрузчик данных о городах с кешированием в localStorage
 */
export class CityDataLoader extends BaseDataLoader {
  constructor() {
    super(null, 86400000); // Кеш на 24 часа
    this.cachedData = null;
    this.storageKey = 'geo_global_cities_cache';
  }

  async load(query = {}) {
    const cacheKey = this.getCacheKey(query);
    
    // 1. Проверяем память
    if (this.isCacheValid(cacheKey) && this.cachedData) {
      logger.debug('Returning cached cities from memory');
      return this.cachedData;
    }

    // 2. Проверяем localStorage
    const storedData = this.loadFromStorage();
    if (storedData && this.isStorageValid(storedData)) {
      logger.info(`✅ Loading ${storedData.cities.length} cities from localStorage cache`);
      this.cachedData = storedData.cities;
      this.cache.set(cacheKey, storedData.cities);
      this.lastUpdated = new Date(storedData.timestamp);
      return storedData.cities;
    }

    // 3. Загружаем из API
    try {
      this.isLoading = true;
      const data = await this.fetchFresh(query);
      
      if (data && data.length > 0) {
        this.cachedData = data;
        this.cache.set(cacheKey, data);
        this.lastUpdated = new Date();
        
        // Сохраняем в localStorage
        this.saveToStorage(data);
        logger.info(`💾 Saved ${data.length} cities to localStorage cache`);
      }
      
      return data;
    } catch (error) {
      logger.error('Failed to load cities from API', error);
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
   * Сохранение данных в localStorage
   */
  saveToStorage(cities) {
    try {
      const data = {
        timestamp: Date.now(),
        cities: cities,
        version: '1.0.0'
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
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
    return age < this.cacheTTL; // 24 часа
  }

  /**
   * Принудительное обновление кеша
   */
  async refreshCache() {
    logger.info('🔄 Forcing cache refresh...');
    this.clearCache();
    localStorage.removeItem(this.storageKey);
    this.cachedData = null;
    return this.load();
  }

  async fetchFresh(query = {}) {
    const { name, limit = 100 } = query;
    let allCities = [];
    
    try {
      // 1. Если есть поиск по имени — используем его
      if (name) {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=${limit}&language=ru&format=json`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            const cities = this.processOpenMeteoData(data.results);
            logger.info(`Found ${cities.length} cities via Open-Meteo API`);
            return cities;
          }
        }
      }

      // 2. Загружаем столицы из REST Countries API
      const capitals = await this.loadCapitalsFromRestAPI();
      if (capitals.length > 0) {
        logger.info(`Loaded ${capitals.length} capitals from REST Countries API`);
        allCities = allCities.concat(capitals);
      }

      // 3. Дополнительно загружаем крупные города через поиск по имени
      const majorCities = ['Moscow', 'London', 'Paris', 'Berlin', 'Rome', 'Madrid',
                           'Tokyo', 'Beijing', 'Seoul', 'New York', 'Los Angeles',
                           'Chicago', 'Toronto', 'Mexico City', 'Sao Paulo', 'Buenos Aires',
                           'Cairo', 'Lagos', 'Nairobi', 'Sydney', 'Melbourne', 
                           'Dubai', 'Singapore', 'Mumbai', 'Delhi', 'Shanghai'];
      
      for (const cityName of majorCities) {
        try {
          const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=ru&format=json`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
              const cities = this.processOpenMeteoData(data.results);
              for (const city of cities) {
                const exists = allCities.some(c =>
                  Math.abs(c.lat - city.lat) < 0.01 && Math.abs(c.lon - city.lon) < 0.01
                );
                if (!exists) {
                  allCities.push(city);
                }
              }
            }
          }
          await this.delay(200);
        } catch (e) {
          logger.warn(`Failed to load ${cityName}:`, e.message);
        }
      }
      
      if (allCities.length > 0) {
        logger.info(`Total loaded: ${allCities.length} cities from APIs`);
        return allCities;
      }

      logger.warn('No data loaded from any API');
      return [];
    } catch (error) {
      logger.error('Error in fetchFresh:', error);
      return [];
    }
  }

  /**
   * Загрузка столиц из REST Countries API
   */
  async loadCapitalsFromRestAPI() {
    try {
      const response = await fetch('https://restcountries.com/v3.1/all?fields=name,capital,latlng,cca2,population');
      if (!response.ok) throw new Error('Failed to fetch countries');
      
      const countries = await response.json();
      const cities = [];
      
      for (const country of countries) {
        const capital = country.capital?.[0];
        const latlng = country.latlng;
        
        if (capital && latlng && latlng.length === 2) {
          cities.push({
            id: `cap-${country.cca2}`,
            name: capital,
            nameRu: capital,
            country: country.name?.common || 'Unknown',
            countryCode: country.cca2 || '',
            lat: latlng[0],
            lon: latlng[1],
            population: country.population || 0,
            timezone: '',
            elevation: 0,
            featureCode: 'PPLC',
            type: 'city',
            displayName: `${capital}, ${country.name?.common || 'Unknown'}`,
            importance: 3,
            isCapital: true
          });
        }
      }
      
      return cities;
    } catch (error) {
      logger.error('Error loading capitals from REST API:', error);
      return [];
    }
  }

  /**
   * Задержка для соблюдения лимитов API
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  processOpenMeteoData(results) {
    return results
      .filter(item => item.latitude && item.longitude)
      .map(item => ({
        id: `om-${item.id || Math.random()}`,
        name: item.name || 'Unknown',
        nameRu: item.name || 'Unknown',
        country: item.country || 'Unknown',
        countryCode: item.country_code || '',
        lat: parseFloat(item.latitude),
        lon: parseFloat(item.longitude),
        population: item.population || 0,
        timezone: item.timezone || '',
        elevation: item.elevation || 0,
        featureCode: item.feature_code || 'PPL',
        type: 'city',
        displayName: `${item.name}, ${item.country}`,
        importance: this.calculateImportance(item),
        isCapital: false
      }));
  }

  calculateImportance(item) {
    const population = item.population || 0;
    if (population >= 10000000) return 5;
    if (population >= 5000000) return 4;
    if (population >= 1000000) return 3;
    if (population >= 500000) return 2;
    if (population >= 100000) return 1;
    return 0;
  }

  async healthCheck() {
    try {
      const response = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=London&count=1&format=json');
      return response.ok;
    } catch {
      return false;
    }
  }

  getMetadata() {
    return {
      source: 'Open-Meteo Geocoding API / REST Countries API',
      sourceUrl: 'https://open-meteo.com/',
      lastUpdated: this.lastUpdated || new Date(),
      license: 'Open Data Commons Open Database License (ODbL)',
      cached: this.cachedData !== null
    };
  }
}