// server/data/CitiesDataSource.js
import { createLogger } from '../../client/src/utils/logger.js';

const logger = createLogger('CitiesDataSource');

export class CitiesDataSource {
  constructor() {
    this.sources = [
      this.fetchFromGeoNames.bind(this),
      this.fetchFromOpenMeteo.bind(this),
      this.fetchCapitalsFromRestCountries.bind(this),
      this.fetchMajorCitiesFromAPI.bind(this)
    ];
  }

  async fetchAllCities() {
    logger.info('Fetching cities from all sources...');
    const allCities = [];
    const usedCoords = new Set();

    for (const source of this.sources) {
      try {
        const cities = await source();
        for (const city of cities) {
          const key = `${city.lat.toFixed(2)},${city.lon.toFixed(2)}`;
          if (!usedCoords.has(key)) {
            usedCoords.add(key);
            allCities.push(city);
          }
        }
        logger.info(`✅ Added ${cities.length} cities from source`);
      } catch (error) {
        logger.warn('Failed to fetch from source:', error.message);
      }
    }

    logger.info(`✅ Total unique cities: ${allCities.length}`);
    return allCities;
  }

  // 1. GeoNames API (бесплатно до 20,000 запросов/день)
  async fetchFromGeoNames() {
    const username = 'demo'; // Замените на свой username
    const cities = [];
    
    // Получаем города с населением > 5000
    try {
      const response = await fetch(
        `http://api.geonames.org/searchJSON?featureClass=P&minPopulation=5000&maxRows=1000&username=${username}&orderby=population`
      );
      
      if (!response.ok) throw new Error('GeoNames API error');
      
      const data = await response.json();
      for (const item of data.geonames || []) {
        cities.push({
          id: `gn-${item.geonameId}`,
          name: item.name,
          nameRu: item.name, // Позже транслитерируем
          country: item.countryName || 'Unknown',
          countryCode: item.countryCode || '',
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lng),
          population: parseInt(item.population) || 0,
          timezone: item.timezone?.timeZoneId || '',
          elevation: parseInt(item.elevation) || 0,
          featureCode: item.fcode || 'PPL',
          type: 'city',
          displayName: `${item.name}, ${item.countryName || 'Unknown'}`,
          isCapital: false,
          continent: '',
          importance: 0,
          source: 'geonames'
        });
      }
      logger.info(`GeoNames: loaded ${cities.length} cities`);
    } catch (error) {
      logger.error('GeoNames fetch failed:', error);
    }
    
    return cities;
  }

  // 2. Open-Meteo Geocoding API
  async fetchFromOpenMeteo() {
    const cities = [];
    const countryCodes = [
      'RU', 'US', 'CN', 'IN', 'BR', 'ID', 'PK', 'NG', 'BD', 'MX',
      'JP', 'DE', 'GB', 'FR', 'IT', 'KR', 'ZA', 'EG', 'VN', 'TR',
      'IR', 'TH', 'PH', 'UA', 'PL', 'MY', 'CA', 'AU', 'AR', 'ES'
    ];

    for (const code of countryCodes) {
      try {
        const response = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?country=${code}&count=100&format=json`
        );
        
        if (!response.ok) continue;
        
        const data = await response.json();
        for (const item of data.results || []) {
          if (item.latitude && item.longitude) {
            cities.push({
              id: `om-${item.id || Math.random()}`,
              name: item.name || 'Unknown',
              nameRu: item.name || 'Unknown',
              country: item.country || 'Unknown',
              countryCode: item.country_code || '',
              lat: parseFloat(item.latitude),
              lon: parseFloat(item.longitude),
              population: parseInt(item.population) || 0,
              timezone: item.timezone || '',
              elevation: item.elevation || 0,
              featureCode: item.feature_code || 'PPL',
              type: 'city',
              displayName: `${item.name}, ${item.country}`,
              isCapital: false,
              continent: '',
              importance: 0,
              source: 'openmeteo'
            });
          }
        }
        // Задержка между запросами
        await this.delay(200);
      } catch (error) {
        logger.warn(`Failed to fetch ${code}:`, error.message);
      }
    }

    logger.info(`Open-Meteo: loaded ${cities.length} cities`);
    return cities;
  }

  // 3. REST Countries API (столицы)
  async fetchCapitalsFromRestCountries() {
    try {
      const response = await fetch('https://restcountries.com/v3.1/all?fields=name,capital,latlng,cca2,population,region');
      if (!response.ok) throw new Error('REST Countries API error');
      
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
            isCapital: true,
            continent: country.region || '',
            importance: 3,
            source: 'restcountries'
          });
        }
      }

      logger.info(`REST Countries: loaded ${cities.length} capitals`);
      return cities;
    } catch (error) {
      logger.error('REST Countries fetch failed:', error);
      return [];
    }
  }

  // 4. Крупные города мира (hardcoded для гарантии)
  async fetchMajorCitiesFromAPI() {
    const majorCities = [
      { name: 'Tokyo', lat: 35.6762, lon: 139.6503, country: 'Japan', pop: 37400000 },
      { name: 'Delhi', lat: 28.6139, lon: 77.2090, country: 'India', pop: 29300000 },
      { name: 'Shanghai', lat: 31.2304, lon: 121.4737, country: 'China', pop: 26300000 },
      { name: 'São Paulo', lat: -23.5505, lon: -46.6333, country: 'Brazil', pop: 21800000 },
      { name: 'Mexico City', lat: 19.4326, lon: -99.1332, country: 'Mexico', pop: 21600000 },
      { name: 'Cairo', lat: 30.0444, lon: 31.2357, country: 'Egypt', pop: 20400000 },
      { name: 'Dhaka', lat: 23.8103, lon: 90.4125, country: 'Bangladesh', pop: 20300000 },
      { name: 'Mumbai', lat: 19.0760, lon: 72.8777, country: 'India', pop: 20100000 },
      { name: 'Beijing', lat: 39.9042, lon: 116.4074, country: 'China', pop: 20000000 },
      { name: 'Osaka', lat: 34.6937, lon: 135.5023, country: 'Japan', pop: 19200000 },
      { name: 'Karachi', lat: 24.8607, lon: 67.0011, country: 'Pakistan', pop: 15700000 },
      { name: 'Chongqing', lat: 29.5630, lon: 106.5516, country: 'China', pop: 15300000 },
      { name: 'Istanbul', lat: 41.0082, lon: 28.9784, country: 'Turkey', pop: 15300000 },
      { name: 'Buenos Aires', lat: -34.6037, lon: -58.3816, country: 'Argentina', pop: 15200000 },
      { name: 'Kolkata', lat: 22.5726, lon: 88.3639, country: 'India', pop: 14900000 },
      { name: 'Manila', lat: 14.5995, lon: 120.9842, country: 'Philippines', pop: 14800000 },
      { name: 'Lagos', lat: 6.5244, lon: 3.3792, country: 'Nigeria', pop: 14400000 },
      { name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729, country: 'Brazil', pop: 13700000 },
      { name: 'Tianjin', lat: 39.0842, lon: 117.2004, country: 'China', pop: 13700000 },
      { name: 'Kinshasa', lat: -4.4419, lon: 15.2663, country: 'DR Congo', pop: 13600000 },
    ];

    return majorCities.map((city, index) => ({
      id: `maj-${index}`,
      name: city.name,
      nameRu: city.name,
      country: city.country,
      countryCode: '',
      lat: city.lat,
      lon: city.lon,
      population: city.pop,
      timezone: '',
      elevation: 0,
      featureCode: 'PPL',
      type: 'city',
      displayName: `${city.name}, ${city.country}`,
      isCapital: false,
      continent: '',
      importance: 5,
      source: 'major'
    }));
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}