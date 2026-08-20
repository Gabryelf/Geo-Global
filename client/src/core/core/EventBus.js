/**
 * Реализация шины событий для межмодульной коммуникации
 * Реализует паттерн Pub/Sub
 */
export class EventBus {
  /** @type {Map<string, Set<Function>>} */
  listeners = new Map();
  /** @type {Map<string, Set<Function>>} */
  onceListeners = new Map();

  /**
   * Подписка на событие
   * @param {string} event - Название события
   * @param {Function} callback - Функция-обработчик
   * @returns {Function} Функция для отписки
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Подписка на событие с одноразовым выполнением
   * @param {string} event - Название события
   * @param {Function} callback - Функция-обработчик
   */
  once(event, callback) {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event).add(callback);
  }

  /**
   * Отписка от события
   * @param {string} event - Название события
   * @param {Function} callback - Функция-обработчик
   */
  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      onceListeners.delete(callback);
    }
  }

  /**
   * Эмит события
   * @param {string} event - Название события
   * @param {any} data - Данные события
   */
  emit(event, data) {
    // Вызов постоянных подписчиков
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      }
    }

    // Вызов одноразовых подписчиков
    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      for (const callback of onceListeners) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in once event listener for ${event}:`, error);
        }
      }
      this.onceListeners.delete(event);
    }
  }

  /**
   * Очистка всех подписок
   */
  clear() {
    this.listeners.clear();
    this.onceListeners.clear();
  }

  /**
   * Получение количества подписчиков на событие
   * @param {string} event - Название события
   * @returns {number}
   */
  listenerCount(event) {
    const listeners = this.listeners.get(event);
    const onceListeners = this.onceListeners.get(event);
    return (listeners?.size || 0) + (onceListeners?.size || 0);
  }
}