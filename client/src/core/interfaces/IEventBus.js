/**
 * Базовый интерфейс шины событий
 * @abstract
 */
 export class IEventBus {
  /**
   * Подписка на событие
   * @param {string} event - Название события
   * @param {Function} callback - Функция-обработчик
   * @returns {Function} Функция для отписки
   */
  on(event, callback) {
    throw new Error('Method on() must be implemented');
  }

  /**
   * Подписка на событие с одноразовым выполнением
   * @param {string} event - Название события
   * @param {Function} callback - Функция-обработчик
   */
  once(event, callback) {
    throw new Error('Method once() must be implemented');
  }

  /**
   * Отписка от события
   * @param {string} event - Название события
   * @param {Function} callback - Функция-обработчик
   */
  off(event, callback) {
    throw new Error('Method off() must be implemented');
  }

  /**
   * Эмит события
   * @param {string} event - Название события
   * @param {any} data - Данные события
   */
  emit(event, data) {
    throw new Error('Method emit() must be implemented');
  }

  /**
   * Очистка всех подписок
   */
  clear() {
    throw new Error('Method clear() must be implemented');
  }

  /**
   * Получение количества подписчиков на событие
   * @param {string} event - Название события
   * @returns {number}
   */
  listenerCount(event) {
    throw new Error('Method listenerCount() must be implemented');
  }
}