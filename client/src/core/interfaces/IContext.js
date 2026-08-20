/**
 * Состояния контекста
 */
 export const ContextState = {
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  INITIALIZED: 'initialized',
  ACTIVATING: 'activating',
  ACTIVE: 'active',
  DEACTIVATING: 'deactivating',
  ERROR: 'error'
};

/**
 * Базовый класс для всех тематических контекстов
 * @abstract
 */
export class IContext {
  /** @type {string} */
  id = '';
  /** @type {string} */
  name = '';
  /** @type {string} */
  description = '';
  /** @type {string} */
  version = '1.0.0';
  /** @type {string} */
  state = ContextState.UNINITIALIZED;

  /**
   * Инициализация контекста
   * @param {any} config - Конфигурация для инициализации
   * @returns {Promise<void>}
   */
  async initialize(config) {
    throw new Error('Method initialize() must be implemented');
  }

  /**
   * Активация контекста - вызывается при переключении на этот контекст
   * @returns {Promise<void>}
   */
  async activate() {
    throw new Error('Method activate() must be implemented');
  }

  /**
   * Деактивация контекста - вызывается при переключении на другой контекст
   * @returns {Promise<void>}
   */
  async deactivate() {
    throw new Error('Method deactivate() must be implemented');
  }

  /**
   * Обновление данных контекста
   * @param {Object} filters - Фильтры для обновления данных
   * @returns {Promise<void>}
   */
  async update(filters) {
    throw new Error('Method update() must be implemented');
  }

  /**
   * Получение данных контекста
   * @param {Object} query - Параметры запроса
   * @returns {Promise<any[]>}
   */
  async getData(query) {
    throw new Error('Method getData() must be implemented');
  }

  /**
   * Получение слоев, принадлежащих контексту
   * @returns {ILayer[]}
   */
  getLayers() {
    throw new Error('Method getLayers() must be implemented');
  }

  /**
   * Обработка события клика на объекте в сцене
   * @param {THREE.Object3D} object - Объект, по которому кликнули
   * @param {THREE.Vector3} position - Позиция клика в 3D пространстве
   */
  handleClick(object, position) {
    throw new Error('Method handleClick() must be implemented');
  }

  /**
   * Обработка события наведения на объект в сцене
   * @param {THREE.Object3D|null} object - Объект, на который навели
   * @param {THREE.Vector3} position - Позиция наведения в 3D пространстве
   */
  handleHover(object, position) {
    throw new Error('Method handleHover() must be implemented');
  }

  /**
   * Очистка всех ресурсов контекста
   */
  dispose() {
    throw new Error('Method dispose() must be implemented');
  }
}