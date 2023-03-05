import winston from 'winston';

export class Logger {
  private static _logger: winston.Logger;
  
  static get l(): winston.Logger {
    if (this._logger === undefined) {
      const level = process.env.LOGGER_LEVEL;
      
      this._logger = winston.createLogger({
        level: level || 'info',
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.timestamp(),
              winston.format.printf(({ timestamp, level, message }) => {
                return `[${timestamp}] ${level}: ${message}`;
              })
            ),
          }),
          new winston.transports.File({
            filename: 'sam-client.log',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.printf(({ timestamp, level, message }) => {
                return `[${timestamp}] ${level}: ${message}`;
              })
            ),
          }),
        ],
      });
    }

    return this._logger;
  }
}