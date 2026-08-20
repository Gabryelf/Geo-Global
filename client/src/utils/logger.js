/**
 * Утилита для логирования с различными уровнями
 */

export const LogLevel = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
};

export class Logger {
    static instance = null;
    level = LogLevel.INFO;
    context = 'App';

    constructor() {
        if (Logger.instance) {
            return Logger.instance;
        }
        Logger.instance = this;
    }

    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Установка уровня логирования
     * @param {number} level - Уровень
     */
    setLevel(level) {
        this.level = level;
    }

    /**
     * Установка контекста
     * @param {string} context - Контекст логирования
     */
    setContext(context) {
        this.context = context;
    }

    /**
     * Форматирование временной метки
     * @returns {string} Строка с временем
     */
    formatTimestamp() {
        return new Date().toISOString().replace('T', ' ').substring(0, 19);
    }

    /**
     * Логирование ошибки
     * @param {string} message - Сообщение
     * @param {...any} args - Дополнительные аргументы
     */
    error(message, ...args) {
        if (this.level <= LogLevel.ERROR) {
            console.error(`[${this.formatTimestamp()}] [${this.context}] ERROR: ${message}`, ...args);
        }
    }

    /**
     * Логирование предупреждения
     * @param {string} message - Сообщение
     * @param {...any} args - Дополнительные аргументы
     */
    warn(message, ...args) {
        if (this.level <= LogLevel.WARN) {
            console.warn(`[${this.formatTimestamp()}] [${this.context}] WARN: ${message}`, ...args);
        }
    }

    /**
     * Логирование информационного сообщения
     * @param {string} message - Сообщение
     * @param {...any} args - Дополнительные аргументы
     */
    info(message, ...args) {
        if (this.level <= LogLevel.INFO) {
            console.info(`[${this.formatTimestamp()}] [${this.context}] INFO: ${message}`, ...args);
        }
    }

    /**
     * Логирование отладочного сообщения
     * @param {string} message - Сообщение
     * @param {...any} args - Дополнительные аргументы
     */
    debug(message, ...args) {
        if (this.level <= LogLevel.DEBUG) {
            console.debug(`[${this.formatTimestamp()}] [${this.context}] DEBUG: ${message}`, ...args);
        }
    }

    /**
     * Логирование трассировки
     * @param {string} message - Сообщение
     * @param {...any} args - Дополнительные аргументы
     */
    trace(message, ...args) {
        if (this.level <= LogLevel.TRACE) {
            console.trace(`[${this.formatTimestamp()}] [${this.context}] TRACE: ${message}`, ...args);
        }
    }
}

/**
 * Создание логгера для конкретного модуля
 * @param {string} context - Контекст модуля
 * @returns {Logger} Экземпляр логгера
 */
export function createLogger(context) {
    const logger = Logger.getInstance();
    logger.setContext(context);
    return logger;
}