import { Gpio } from "pigpio";
import chalk from "chalk";
import { Logger } from './logger';

enum LEDState {
  ON = 1,
  OFF = 0,
}

export class LEDManager {
  private readonly ledPins: { num: number, pin: Gpio}[];
  private readonly ledDuration: number;
  private readonly DEFAULT_LED_DURATION = 30;

  private currentTimeout: ReturnType<typeof setInterval> | null;

  constructor() {
    const ledPinsConf = process.env.LED_PINS;
    const ledDurationConf = process.env.LED_DURATION;
    
    if (ledPinsConf === undefined) {
      this.ledPins = [];
      Logger.l.warn('LED_PINS was not set in .env - LEDs won\'t flash on new alerts');
    } else {
      this.ledPins = ledPinsConf.split(',').map(el => {
        const parsedEl = parseInt(el);

        if (Number.isNaN(parsedEl)) {
          throw new Error(`LED_PINS contains non numeric element ${el}`);
        }

        Logger.l.info(`Adding GPIO ${parsedEl} as output`);
        
        const pin = new Gpio(parsedEl, { mode: Gpio.OUTPUT });

        return {
          num: parsedEl,
          pin,
        };
      });
    }

    if (ledDurationConf === undefined) {
      Logger.l.warn(`LED_DURATION was not set in .env - Setting to default duration of ${this.DEFAULT_LED_DURATION} seconds`);
      this.ledDuration = this.DEFAULT_LED_DURATION;
    } else {
      const parsedEl = parseInt(ledDurationConf);

      if (Number.isNaN(parsedEl)) {
        throw new Error(`LED_DURATION is non numeric ${ledDurationConf}`);
      }

      this.ledDuration = parsedEl;
    }

    this.currentTimeout = null;

    process.once('SIGTERM', () => this.shutdown());
    process.once('SIGINT', () => this.shutdown());
  }

  startFlashing(duration = this.ledDuration) {
    this.reset();
    Logger.l.debug(`Starting LEDs for ${duration} seconds`);
    this.setLeds(LEDState.ON);
    this.currentTimeout = setTimeout(() => {
      Logger.l.debug(`Flashing for ${duration} seconds finished`);
      this.reset();
    }, duration * 1000);
  }

  reset() {
    Logger.l.debug(`Resetting LEDs`);
    if (this.currentTimeout !== null) {
      clearTimeout(this.currentTimeout);
    }
    this.setLeds(LEDState.OFF);
  }

  private shutdown() {
    Logger.l.info('Shutting down LEDs');
    this.reset();
  }

  private setLeds(state: LEDState) {
    for (const led of this.ledPins) {
      try {
        Logger.l.debug(`Setting new state for GPIO ${led.num}: ${this.getTextForBinary(state)}`);
        led.pin.digitalWrite(LEDState.ON ? 1 : 0);
      } catch (err) {
        Logger.l.error(`Failed setting GPIO ${led.num} to ${this.getTextForBinary(state)}: ${err}`);
      }
    }
  }

  private getTextForBinary(binary: 0 | 1) {
    return binary === 1 ? chalk.green('ON') : chalk.red('OFF');
  }
}
