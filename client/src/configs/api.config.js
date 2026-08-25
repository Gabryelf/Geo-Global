// client/src/configs/api.config.js

export const ApiConfig = {
    // Базовые URL
    baseUrl: window.location.origin,
    apiUrl: `${window.location.origin}/api`,
    
    // Эндпоинты
    endpoints: {
        // Общие
        status: '/api/status',
        refresh: '/api/refresh',
        stats: '/api/stats',
        
        // География
        cities: '/api/cities',
        city: (id) => `/api/cities/${id}`,
        citiesSearch: '/api/cities/search',
        countries: '/api/countries',
        continents: '/api/continents',
        
        // История
        historicalEpochs: '/api/historical/epochs',
        historicalCities: '/api/historical/cities',
        historicalCity: (id) => `/api/historical/cities/${id}`,
        historicalEvents: '/api/historical/events',
        
        // Биология (будущее)
        biologySpecies: '/api/biology/species',
        biologyRegions: '/api/biology/regions',
        
        // Техника (будущее)
        technicalProjects: '/api/technical/projects',
        technicalAchievements: '/api/technical/achievements',
    },
    
    // Настройки запросов
    defaults: {
        timeout: 15000,
        retries: 3,
        retryDelay: 1000,
    },
    
    // Кеширование
    cache: {
        cities: 7 * 24 * 60 * 60 * 1000, // 7 дней
        historical: 30 * 24 * 60 * 60 * 1000, // 30 дней
        biology: 7 * 24 * 60 * 60 * 1000,
        technical: 7 * 24 * 60 * 60 * 1000,
    }
};

// Создаем универсальный метод для запросов
export async function apiRequest(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${ApiConfig.baseUrl}${endpoint}`;
    
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(ApiConfig.defaults.timeout),
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    let lastError;
    for (let attempt = 0; attempt < ApiConfig.defaults.retries; attempt++) {
        try {
            const response = await fetch(url, finalOptions);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            lastError = error;
            if (attempt < ApiConfig.defaults.retries - 1) {
                await new Promise(resolve => setTimeout(resolve, ApiConfig.defaults.retryDelay));
            }
        }
    }
    
    throw lastError;
}