/**
 * Абстрактный базовый класс для загрузки и обработки данных
 */
export class BaseDataLoader {
  /** @type {IDataProvider|null} */
  provider = null;
  /** @type {Map<string, any[]>} */
  cache = new Map();
  /** @type {number} Время жизни кэша в миллисекундах (по умолчанию 5 минут) */
  cacheTTL = 300000;
  /** @type {Date|null} Время последнего обновления */
  lastUpdated = null;
  /** @type {boolean} Статус загрузки */
  isLoading = false;

  /**
   * Конструктор загрузчика
   * @param {IDataProvider} provider - Провайдер данных
   * @param {number} cacheTTL - Время жизни кэша (опционально)
   */
  constructor(provider, cacheTTL) {
    if (provider) {
      this.provider = provider;
    }
    if (cacheTTL) {
      this.cacheTTL = cacheTTL;
    }
  }

  /**
   * Установка провайдера данных
   * @param {IDataProvider} provider - Провайдер данных
   */
  setProvider(provider) {
    this.provider = provider;
  }

  /**
   * Загрузка данных с кэшированием
   * @param {any} query - Параметры запроса
   * @returns {Promise<any[]>}
   */
  async load(query) {
    throw new Error('Method load() must be implemented');
  }

  /**
   * Загрузка данных без кэширования
   * @param {any} query - Параметры запроса
   * @returns {Promise<any[]>}
   */
  async fetchFresh(query) {
    throw new Error('Method fetchFresh() must be implemented');
  }

  /**
   * Загрузка данных по географическим границам
   * @param {Object} bounds - Географические границы
   * @param {number} limit - Лимит записей
   * @returns {Promise<any[]>}
   */
  async loadByBounds(bounds, limit) {
    if (!this.provider) {
      throw new Error('Data provider not set');
    }
    return this.provider.fetchByBounds(bounds, limit);
  }

  /**
   * Получение метаданных
   * @returns {Promise<Object|null>}
   */
  async getMetadata() {
    if (!this.provider) {
      return null;
    }
    return this.provider.getMetadata();
  }

  /**
   * Очистка кэша
   */
  clearCache() {
    this.cache.clear();
    this.lastUpdated = null;
  }

  /**
   * Проверка актуальности кэша
   * @param {string} key - Ключ кэша
   * @returns {boolean}
   */
  isCacheValid(key) {
    if (!this.lastUpdated) {
      return false;
    }
    const age = Date.now() - this.lastUpdated.getTime();
    return age < this.cacheTTL && this.cache.has(key);
  }

  /**
   * Получение ключа для кэша по параметрам запроса
   * @param {any} query - Параметры запроса
   * @returns {string}
   */
  getCacheKey(query) {
    return query ? JSON.stringify(query) : 'default';
  }

  /**
   * Обработка загруженных данных
   * @param {any[]} data - Сырые данные
   * @returns {any[]}
   */
  processData(data) {
    throw new Error('Method processData() must be implemented');
  }

  /**
   * Проверка доступности провайдера
   * @returns {Promise<boolean>}
   */
  async isProviderAvailable() {
    if (!this.provider) {
      return false;
    }
    return this.provider.healthCheck();
  }

  /**
   * Получение статуса загрузки
   * @returns {Object}
   */
  getLoadStatus() {
    return {
      isLoading: this.isLoading,
      lastUpdated: this.lastUpdated,
      cacheSize: this.cache.size
    };
  }
}