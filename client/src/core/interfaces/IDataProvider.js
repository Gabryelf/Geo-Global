/**
 * Базовый интерфейс провайдера данных
 * @abstract
 */
export class IDataProvider {
  /** @type {string} */
  baseUrl = '';
  /** @type {number} */
  timeout = 30000;
  /** @type {number} */
  retryAttempts = 3;

  /**
   * Получение данных
   * @param {any} query - Параметры запроса
   * @returns {Promise<any[]>}
   */
  async fetch(query) {
    throw new Error('Method fetch() must be implemented');
  }

  /**
   * Получение данных по ID
   * @param {string} id - Уникальный идентификатор
   * @returns {Promise<any|null>}
   */
  async fetchById(id) {
    throw new Error('Method fetchById() must be implemented');
  }

  /**
   * Поиск данных по критериям
   * @param {Object} criteria - Критерии поиска
   * @returns {Promise<any[]>}
   */
  async search(criteria) {
    throw new Error('Method search() must be implemented');
  }

  /**
   * Получение данных в диапазоне координат (для геоданных)
   * @param {Object} bounds - Географические границы
   * @param {number} limit - Максимальное количество записей
   * @returns {Promise<any[]>}
   */
  async fetchByBounds(bounds, limit) {
    throw new Error('Method fetchByBounds() must be implemented');
  }

  /**
   * Проверка доступности провайдера
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    throw new Error('Method healthCheck() must be implemented');
  }

  /**
   * Получение метаданных о данных
   * @returns {Object}
   */
  getMetadata() {
    throw new Error('Method getMetadata() must be implemented');
  }
}