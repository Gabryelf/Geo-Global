/**
 * Общие типы данных, используемые на клиенте и сервере
 */

// Экспорт констант и базовых классов для общих типов
export const GeoTypes = {
    POINT: 'Point',
    LINE_STRING: 'LineString',
    POLYGON: 'Polygon',
    FEATURE: 'Feature',
    FEATURE_COLLECTION: 'FeatureCollection'
};

/**
 * Создание географической координаты
 * @param {number} lat - Широта (-90 до 90)
 * @param {number} lon - Долгота (-180 до 180)
 * @param {number} altitude - Высота над уровнем моря (опционально)
 * @returns {Object}
 */
export function createGeoCoordinate(lat, lon, altitude) {
    return {
        lat,
        lon,
        altitude: altitude || 0
    };
}

/**
 * Создание географической позиции с временной меткой
 * @param {number} lat - Широта
 * @param {number} lon - Долгота
 * @param {Date} timestamp - Временная метка
 * @param {number} altitude - Высота (опционально)
 * @returns {Object}
 */
export function createGeoPosition(lat, lon, timestamp, altitude) {
    return {
        ...createGeoCoordinate(lat, lon, altitude),
        timestamp: timestamp || new Date()
    };
}

/**
 * Создание GeoJSON точки
 * @param {number} lon - Долгота
 * @param {number} lat - Широта
 * @param {number} alt - Высота (опционально)
 * @returns {Object}
 */
export function createGeoPoint(lon, lat, alt) {
    const coords = [lon, lat];
    if (alt !== undefined) {
        coords.push(alt);
    }
    return {
        type: 'Point',
        coordinates: coords
    };
}

/**
 * Создание GeoJSON линии
 * @param {Array} coordinates - Массив координат [lon, lat, alt]
 * @returns {Object}
 */
export function createGeoLine(coordinates) {
    return {
        type: 'LineString',
        coordinates: coordinates
    };
}

/**
 * Создание GeoJSON полигона
 * @param {Array} coordinates - Массив колец координат
 * @returns {Object}
 */
export function createGeoPolygon(coordinates) {
    return {
        type: 'Polygon',
        coordinates: coordinates
    };
}

/**
 * Создание GeoJSON фичи
 * @param {Object} geometry - GeoJSON геометрия
 * @param {Object} properties - Свойства
 * @param {string} id - ID (опционально)
 * @returns {Object}
 */
export function createGeoFeature(geometry, properties, id) {
    const feature = {
        type: 'Feature',
        geometry: geometry,
        properties: properties || {}
    };
    if (id) {
        feature.id = id;
    }
    return feature;
}

/**
 * Создание коллекции GeoJSON фич
 * @param {Array} features - Массив фич
 * @returns {Object}
 */
export function createGeoFeatureCollection(features) {
    return {
        type: 'FeatureCollection',
        features: features || []
    };
}

/**
 * Создание маркера
 * @param {string} id - ID маркера
 * @param {Object} position - Географическая позиция
 * @param {string} title - Заголовок
 * @param {string} description - Описание
 * @param {string} category - Категория
 * @param {any} data - Дополнительные данные
 * @param {Object} options - Опции (icon, color, size)
 * @returns {Object}
 */
export function createMarker(id, position, title, description, category, data, options = {}) {
    return {
        id,
        position,
        title,
        description,
        category,
        data: data || {},
        icon: options.icon || null,
        color: options.color || '#4080ff',
        size: options.size || 1
    };
}