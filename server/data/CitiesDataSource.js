// server/data/CitiesDataSource.js (альтернативная версия)

import { createLogger } from '../../client/src/utils/logger.js';

const logger = createLogger('CitiesDataSource');

export class CitiesDataSource {
    constructor() {
        this.sources = [
            this.fetchFromOpenMeteo.bind(this),
            this.fetchCapitalsFromRestCountries.bind(this),
        ];
    }

    async fetchAllCities() {
        logger.info('🌍 Fetching cities from external APIs...');
        const allCities = [];
        const usedCoords = new Set();

        for (const source of this.sources) {
            try {
                const cities = await source();
                let added = 0;
                for (const city of cities) {
                    const key = `${city.lat.toFixed(3)},${city.lon.toFixed(3)}`;
                    if (!usedCoords.has(key)) {
                        usedCoords.add(key);
                        allCities.push(city);
                        added++;
                    }
                }
                logger.info(`✅ Added ${added} new cities`);
            } catch (error) {
                logger.error(`❌ Failed to fetch: ${error.message}`);
            }
        }

        logger.info(`✅ Total unique cities: ${allCities.length}`);
        return allCities;
    }

    // Загружаем города по списку крупных городов
    async fetchFromOpenMeteo() {
        const cities = [];
        
        // Список крупных городов для поиска
        const cityNames = [
            // Россия и СНГ
            'Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Nizhny Novgorod',
            'Kazan', 'Chelyabinsk', 'Omsk', 'Samara', 'Rostov-on-Don', 'Ufa', 'Krasnoyarsk',
            'Voronezh', 'Perm', 'Volgograd', 'Kiev', 'Minsk', 'Tashkent', 'Almaty', 'Baku',
            'Tbilisi', 'Yerevan', 'Chisinau', 'Astana',
            
            // Европа
            'London', 'Paris', 'Berlin', 'Madrid', 'Rome', 'Vienna', 'Prague', 'Budapest',
            'Warsaw', 'Bucharest', 'Sofia', 'Belgrade', 'Zagreb', 'Ljubljana', 'Bratislava',
            'Tallinn', 'Riga', 'Vilnius', 'Helsinki', 'Stockholm', 'Oslo', 'Copenhagen',
            'Reykjavik', 'Amsterdam', 'Brussels', 'Zurich', 'Geneva', 'Munich', 'Hamburg',
            'Frankfurt', 'Milan', 'Naples', 'Barcelona', 'Valencia', 'Seville', 'Porto',
            'Lisbon', 'Dublin', 'Glasgow', 'Manchester', 'Birmingham', 'Lyon', 'Marseille',
            
            // Азия
            'Tokyo', 'Osaka', 'Nagoya', 'Seoul', 'Busan', 'Beijing', 'Shanghai',
            'Hong Kong', 'Taipei', 'Singapore', 'Kuala Lumpur', 'Jakarta', 'Bangkok',
            'Ho Chi Minh City', 'Manila', 'Mumbai', 'Delhi', 'Bangalore', 'Chennai',
            'Hyderabad', 'Karachi', 'Lahore', 'Dhaka', 'Tehran', 'Baghdad', 'Riyadh',
            'Dubai', 'Abu Dhabi', 'Tel Aviv', 'Beirut', 'Amman', 'Kuwait City', 'Doha',
            'Muscat', 'Sanaa', 'Damascus', 'Jerusalem', 'Ankara', 'Izmir', 'Antalya',
            'Bursa', 'Tehran', 'Isfahan', 'Shiraz', 'Mashhad',
            
            // Африка
            'Cairo', 'Alexandria', 'Lagos', 'Kano', 'Abidjan', 'Nairobi', 'Dar es Salaam',
            'Johannesburg', 'Cape Town', 'Casablanca', 'Tunis', 'Algiers', 'Tripoli',
            'Khartoum', 'Addis Ababa', 'Accra', 'Dakar', 'Bamako', 'Ouagadougou',
            'Kinshasa', 'Lubumbashi', 'Kampala', 'Mogadishu', 'Antananarivo', 'Maputo',
            
            // Северная Америка
            'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
            'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Toronto', 'Montreal',
            'Vancouver', 'Mexico City', 'Guadalajara', 'Monterrey', 'Havana', 'Santo Domingo',
            'Port-au-Prince', 'Kingston', 'Panama City', 'San Jose', 'Guatemala City',
            'Managua', 'San Salvador', 'Tegucigalpa',
            
            // Южная Америка
            'Sao Paulo', 'Rio de Janeiro', 'Brasilia', 'Buenos Aires', 'Cordoba',
            'Santiago', 'Valparaiso', 'Lima', 'Bogota', 'Medellin', 'Cali',
            'Caracas', 'Maracaibo', 'Quito', 'Guayaquil', 'La Paz', 'Asuncion',
            'Montevideo', 'Paramaribo', 'Georgetown',
            
            // Австралия и Океания
            'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Auckland',
            'Wellington', 'Christchurch', 'Port Moresby', 'Suva', 'Noumea'
        ];

        let totalLoaded = 0;

        for (const name of cityNames) {
            try {
                await this.delay(150);
                
                const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=3&language=ru&format=json`;
                
                const response = await fetch(url, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Geo-Global/1.0'
                    }
                });
                
                if (!response.ok) {
                    logger.debug(`Open-Meteo: ${name} - HTTP ${response.status}`);
                    continue;
                }
                
                const data = await response.json();
                const results = data.results || [];
                
                for (const item of results) {
                    if (!item.latitude || !item.longitude || !item.name) continue;
                    
                    const population = item.population || 0;
                    if (population > 0 && population < 10000) continue;
                    
                    cities.push({
                        id: `om-${item.id || Math.random().toString(36).substring(2, 10)}`,
                        name: item.name,
                        nameRu: item.name,
                        country: item.country || 'Unknown',
                        countryCode: item.country_code || '',
                        lat: parseFloat(item.latitude),
                        lon: parseFloat(item.longitude),
                        population: population,
                        timezone: item.timezone || '',
                        elevation: item.elevation || 0,
                        featureCode: item.feature_code || 'PPL',
                        type: 'city',
                        displayName: `${item.name}, ${item.country || 'Unknown'}`,
                        isCapital: false,
                        continent: '',
                        importance: this.calculateImportance(population),
                        source: 'openmeteo'
                    });
                    totalLoaded++;
                }
            } catch (error) {
                logger.debug(`Open-Meteo: ${name} - ${error.message}`);
            }
        }

        logger.info(`Open-Meteo: loaded ${totalLoaded} cities`);
        return cities;
    }

    // REST Countries API (столицы)
    async fetchCapitalsFromRestCountries() {
        try {
            const response = await fetch(
                'https://restcountries.com/v3.1/all?fields=name,capital,latlng,cca2,population,region'
            );
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const countries = await response.json();
            const cities = [];

            for (const country of countries) {
                const capital = country.capital?.[0];
                const latlng = country.latlng;
                const population = country.population || 0;
                
                if (capital && latlng && latlng.length === 2) {
                    cities.push({
                        id: `cap-${country.cca2}`,
                        name: capital,
                        nameRu: capital,
                        country: country.name?.common || 'Unknown',
                        countryCode: country.cca2 || '',
                        lat: latlng[0],
                        lon: latlng[1],
                        population: population,
                        timezone: '',
                        elevation: 0,
                        featureCode: 'PPLC',
                        type: 'city',
                        displayName: `${capital}, ${country.name?.common || 'Unknown'}`,
                        isCapital: true,
                        continent: country.region || '',
                        importance: this.calculateImportance(population),
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

    calculateImportance(population) {
        if (population >= 10000000) return 5;
        if (population >= 5000000) return 4;
        if (population >= 1000000) return 3;
        if (population >= 500000) return 2;
        if (population >= 100000) return 1;
        return 0;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}